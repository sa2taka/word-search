#!/usr/bin/env node
// Compare multiple models on same 100 words
import { readFileSync } from 'fs';

const OLLAMA = 'http://localhost:11434/api/generate';
const BATCH = 25;

const lines = readFileSync('dist-dict/word-scores.tsv', 'utf8').trim().split('\n').slice(1);
const allWords = lines.map(l => l.split('\t')[1]);

// Fixed 100 random words (reproducible) - mix of likely common and obscure
const sample = [];
const used = new Set();
let seed = 42;
function rand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
while (sample.length < 100) {
  const idx = Math.floor(rand() * allWords.length);
  if (!used.has(idx)) { used.add(idx); sample.push(allWords[idx]); }
}

function buildPrompt(words) {
  return `/no_think
以下の日本語の単語それぞれについて、一般的な日本語話者にとっての「よく知られている度」を1〜10で評価してください。
10=誰でも知っている日常語、5=教養ある人なら知っている、1=極めて専門的・古語・難語。

TSV形式（単語<TAB>スコア）で出力してください。説明不要。

${words.join('\n')}`;
}

function parseResponse(text, words) {
  const scores = new Map();
  for (const line of text.split('\n')) {
    const normalized = line.replace(/\\t/g, '\t').replace(/<TAB>/g, '\t').trim();
    const m = normalized.match(/^(.+?)\t(\d+)/);
    if (m && words.includes(m[1].trim())) {
      const s = parseInt(m[2]);
      if (s >= 0 && s <= 10) scores.set(m[1].trim(), s);
    }
  }
  return scores;
}

async function testModel(model) {
  console.log(`\n=== ${model} ===`);
  
  // Pull if needed (will skip if already present)
  console.log(`  Ensuring model is loaded...`);
  
  const allScores = new Map();
  const start = Date.now();

  for (let i = 0; i < sample.length; i += BATCH) {
    const batch = sample.slice(i, i + BATCH);
    try {
      const res = await fetch(OLLAMA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: buildPrompt(batch), stream: false, options: { temperature: 0.3, num_ctx: 4096 } })
      });
      const data = await res.json();
      if (data.error) { console.log(`  ERROR: ${data.error}`); return null; }
      const scores = parseResponse(data.response, batch);
      for (const [w, s] of scores) allScores.set(w, s);
      process.stderr.write(`\r  ${Math.min(i + BATCH, sample.length)}/${sample.length} (${allScores.size} parsed)`);
    } catch (err) {
      console.log(`  FETCH ERROR: ${err.message}`);
      return null;
    }
  }

  const elapsed = (Date.now() - start) / 1000;
  console.log(`\n  Time: ${elapsed.toFixed(0)}s (${(100 / elapsed).toFixed(2)} words/s)`);
  console.log(`  Parsed: ${allScores.size}/100 (${allScores.size}%)`);

  const dist = {};
  for (const [, s] of allScores) dist[s] = (dist[s] || 0) + 1;
  console.log('  Distribution:');
  for (let i = 10; i >= 1; i--) {
    const count = dist[i] || 0;
    const bar = '█'.repeat(count);
    console.log(`    ${String(i).padStart(2)}: ${String(count).padStart(3)} ${bar}`);
  }
  if (dist[0]) console.log(`     0: ${dist[0]}`);

  const vals = [...allScores.values()];
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  console.log(`  Average: ${avg.toFixed(2)}`);

  // Show 20 samples
  console.log('  Sample scores:');
  const entries = [...allScores.entries()];
  entries.sort((a, b) => b[1] - a[1]);
  entries.slice(0, 10).forEach(([w, s]) => console.log(`    ${s}\t${w}`));
  console.log('    ...');
  entries.slice(-10).forEach(([w, s]) => console.log(`    ${s}\t${w}`));

  return { avg, parsed: allScores.size, elapsed, scores: allScores };
}

async function main() {
  console.log('Sample words (first 20):');
  sample.slice(0, 20).forEach(w => console.log('  ' + w));

  // Test available models
  const models = ['qwen3:8b', 'llama3:8b', 'qwen2.5:3b'];
  
  const results = {};
  for (const m of models) {
    results[m] = await testModel(m);
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log('Model            | Parsed | Avg  | Speed  | Time');
  for (const [m, r] of Object.entries(results)) {
    if (!r) { console.log(`${m.padEnd(17)}| FAILED`); continue; }
    console.log(`${m.padEnd(17)}| ${String(r.parsed).padStart(3)}%   | ${r.avg.toFixed(2)} | ${(100/r.elapsed).toFixed(2)}/s | ${r.elapsed.toFixed(0)}s`);
  }

  // Side-by-side on same words
  const allModels = Object.entries(results).filter(([, r]) => r);
  if (allModels.length > 1) {
    console.log('\n=== Side-by-side comparison (first 30 words) ===');
    const header = 'word'.padEnd(30) + allModels.map(([m]) => m.padStart(12)).join('');
    console.log(header);
    for (const w of sample.slice(0, 30)) {
      const row = w.padEnd(30) + allModels.map(([, r]) => {
        const s = r.scores.get(w);
        return (s != null ? String(s) : '-').padStart(12);
      }).join('');
      console.log(row);
    }
  }
}

main().catch(console.error);
