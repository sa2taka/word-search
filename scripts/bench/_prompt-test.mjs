#!/usr/bin/env node
// Test improved prompt on 1000 random words
import { readFileSync } from 'fs';

const OLLAMA = 'http://localhost:11434/api/generate';
const BATCH = 25;

const lines = readFileSync('dist-dict/word-scores.tsv', 'utf8').trim().split('\n').slice(1);
const allWords = lines.map(l => l.split('\t')[1]);

// Random 1000
const sample = [];
const used = new Set();
while (sample.length < 1000) {
  const idx = Math.floor(Math.random() * allWords.length);
  if (!used.has(idx)) { used.add(idx); sample.push(allWords[idx]); }
}

function buildPrompt(words) {
  return `/no_think
以下は日本語辞書の見出し語（ひらがな読み）です。元の表記（漢字・カタカナ）を推測し、その語の「一般的な日本語話者にとっての知名度」を1〜10で評価してください。

10 = 誰でも知っている基本語（例：たべる→食べる、てれび→テレビ）
7-9 = 日常会話や一般ニュースで普通に使われる語
4-6 = 教養ある大人なら知っている語
2-3 = 専門分野や趣味の人が知っている語
1 = 極めて専門的・古語・難語

単語<TAB>スコア のTSV形式で出力してください。説明不要。

${words.join('\n')}`;
}

function parseResponse(text, words) {
  const scores = new Map();
  for (const line of text.split('\n')) {
    // Handle real tab, literal \t, and literal <TAB>
    const normalized = line.replace(/\\t/g, '\t').replace(/<TAB>/g, '\t').trim();
    const m = normalized.match(/^(.+?)\t(\d+)/);
    if (m && words.includes(m[1].trim())) {
      const s = parseInt(m[2]);
      if (s >= 0 && s <= 10) scores.set(m[1].trim(), s);
    }
  }
  return scores;
}

async function scoreBatch(words, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(OLLAMA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'qwen3:8b', prompt: buildPrompt(words), stream: false, options: { temperature: 0.3, num_ctx: 4096 } })
      });
      const data = await res.json();
      return parseResponse(data.response, words);
    } catch (err) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 3000)); continue; }
      return new Map();
    }
  }
}

async function main() {
  console.log('=== New Prompt Test (1000 words) ===\n');
  const allScores = new Map();
  const start = Date.now();

  for (let i = 0; i < sample.length; i += BATCH) {
    const batch = sample.slice(i, i + BATCH);
    const scores = await scoreBatch(batch);
    for (const [w, s] of scores) allScores.set(w, s);
    process.stderr.write(`\r  ${Math.min(i + BATCH, sample.length)}/${sample.length} (${allScores.size} parsed)`);
  }

  const elapsed = (Date.now() - start) / 1000;
  console.log(`\n\nTime: ${elapsed.toFixed(0)}s (${(sample.length / elapsed).toFixed(1)} words/s)`);
  console.log(`Parsed: ${allScores.size}/${sample.length} (${(allScores.size / sample.length * 100).toFixed(0)}%)`);

  // Distribution
  const dist = {};
  for (const [, s] of allScores) dist[s] = (dist[s] || 0) + 1;
  console.log('\nScore distribution:');
  for (let i = 10; i >= 0; i--) {
    const count = dist[i] || 0;
    const bar = '█'.repeat(Math.round(count / 3));
    const pct = (count / allScores.size * 100).toFixed(1);
    console.log(`  ${String(i).padStart(2)}: ${String(count).padStart(4)} (${pct.padStart(5)}%) ${bar}`);
  }

  const avg = [...allScores.values()].reduce((a, b) => a + b, 0) / allScores.size;
  console.log(`\nAverage: ${avg.toFixed(2)}`);

  // Show 50 random samples sorted by score
  console.log('\nRandom 50 samples (sorted by score):');
  const entries = [...allScores.entries()];
  const show = [];
  while (show.length < 50 && entries.length > 0) {
    const idx = Math.floor(Math.random() * entries.length);
    show.push(entries.splice(idx, 1)[0]);
  }
  show.sort((a, b) => b[1] - a[1]);
  for (const [w, s] of show) console.log(`  ${s}\t${w}`);
}

main().catch(console.error);
