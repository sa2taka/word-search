#!/usr/bin/env node
// Compare old vs new prompt on 1000 random words
import { readFileSync } from 'fs';

const OLLAMA = 'http://localhost:11434/api/generate';
const BATCH = 25;

// Load all words
const lines = readFileSync('dist-dict/word-scores.tsv', 'utf8').trim().split('\n').slice(1);
const allWords = lines.map(l => l.split('\t')[1]);

// Random 1000
const sample = [];
const used = new Set();
while (sample.length < 1000) {
  const idx = Math.floor(Math.random() * allWords.length);
  if (!used.has(idx)) { used.add(idx); sample.push(allWords[idx]); }
}

const promptOld = (words) => `/no_think
以下の日本語の単語それぞれについて、一般的な日本語話者にとっての「よく知られている度」を1〜10で評価してください。
10=誰でも知っている日常語、5=教養ある人なら知っている、1=極めて専門的・古語・難語。

TSV形式（単語<TAB>スコア）で出力してください。説明不要。

${words.join('\n')}`;

const promptNew = (words) => `/no_think
以下は日本語辞書の見出し語（ひらがな読み）です。元の表記（漢字・カタカナ）を推測し、その語の「一般的な日本語話者にとっての知名度」を1〜10で評価してください。

10 = 誰でも知っている基本語（例：たべる→食べる、てれび→テレビ）
7-9 = 日常会話や一般ニュースで普通に使われる語
4-6 = 教養ある大人なら知っている語
2-3 = 専門分野や趣味の人が知っている語
1 = 極めて専門的・古語・難語

TSV形式（単語<TAB>スコア）で出力してください。説明不要。

${words.join('\n')}`;

function parseResponse(text, words) {
  const scores = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^(.+?)\t(\d+)/);
    if (m && words.includes(m[1])) {
      const s = parseInt(m[2]);
      if (s >= 0 && s <= 10) scores.set(m[1], s);
    }
  }
  return scores;
}

async function scoreBatch(words, promptFn) {
  const res = await fetch(OLLAMA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'qwen3:8b', prompt: promptFn(words), stream: false, options: { temperature: 0.3, num_ctx: 4096 } })
  });
  const data = await res.json();
  return { scores: parseResponse(data.response, words), elapsed: data.total_duration / 1e9 };
}

async function runTest(label, promptFn, words) {
  console.log(`\n=== ${label} ===`);
  const allScores = new Map();
  const start = Date.now();
  
  for (let i = 0; i < words.length; i += BATCH) {
    const batch = words.slice(i, i + BATCH);
    const { scores } = await scoreBatch(batch, promptFn);
    for (const [w, s] of scores) allScores.set(w, s);
    process.stderr.write(`\r  ${Math.min(i + BATCH, words.length)}/${words.length} (${allScores.size} parsed)`);
  }
  
  const elapsed = (Date.now() - start) / 1000;
  console.log(`\n  Time: ${elapsed.toFixed(0)}s, Parsed: ${allScores.size}/${words.length} (${(allScores.size/words.length*100).toFixed(0)}%)`);
  
  // Distribution
  const dist = {};
  for (const [, s] of allScores) dist[s] = (dist[s] || 0) + 1;
  console.log('  Distribution:');
  for (let i = 10; i >= 1; i--) {
    const count = dist[i] || 0;
    const bar = '█'.repeat(Math.round(count / 5));
    console.log(`    ${String(i).padStart(2)}: ${String(count).padStart(4)} ${bar}`);
  }
  if (dist[0]) console.log(`     0: ${dist[0]}`);
  
  const avg = [...allScores.values()].reduce((a, b) => a + b, 0) / allScores.size;
  console.log(`  Average: ${avg.toFixed(2)}`);
  
  // Spot check known words
  const checks = ['でんまーく', 'こすたりか', 'てれび', 'がつこう', 'でんわ', 'しごと',
    'けいざい', 'さくら', 'かんじ', 'ぱそこん', 'すまーとふおん', 'とうきよう',
    'おおさか', 'にほん', 'せかい', 'じどうしや', 'びようしつ', 'くうき'];
  console.log('\n  Spot check:');
  for (const w of checks) {
    if (allScores.has(w)) console.log(`    ${w} = ${allScores.get(w)}`);
  }
  
  return allScores;
}

async function main() {
  // Test both prompts on same 1000 words
  // First 100 with old, first 100 with new for quick comparison
  const quick = sample.slice(0, 100);
  
  console.log('=== Quick comparison (100 words) ===');
  const oldScores = await runTest('OLD prompt', promptOld, quick);
  const newScores = await runTest('NEW prompt', promptNew, quick);
  
  // Side by side comparison
  console.log('\n=== Side-by-side (where both scored) ===');
  let higher = 0, lower = 0, same = 0, diffSum = 0;
  const examples = [];
  for (const [w, oldS] of oldScores) {
    if (newScores.has(w)) {
      const newS = newScores.get(w);
      if (newS > oldS) higher++;
      else if (newS < oldS) lower++;
      else same++;
      diffSum += newS - oldS;
      if (newS !== oldS) examples.push({ word: w, old: oldS, new: newS, diff: newS - oldS });
    }
  }
  console.log(`  New > Old: ${higher}, New < Old: ${lower}, Same: ${same}`);
  console.log(`  Avg difference: ${(diffSum / (higher + lower + same)).toFixed(2)}`);
  
  examples.sort((a, b) => b.diff - a.diff);
  console.log('\n  Biggest improvements:');
  examples.slice(0, 15).forEach(e => console.log(`    ${e.word}: ${e.old} → ${e.new} (+${e.diff})`));
  console.log('\n  Biggest drops:');
  examples.slice(-10).forEach(e => console.log(`    ${e.word}: ${e.old} → ${e.new} (${e.diff})`));
  
  // If new looks good, run full 1000
  console.log('\n=== Full 1000 with NEW prompt ===');
  await runTest('NEW prompt (1000)', promptNew, sample);
}

main().catch(console.error);
