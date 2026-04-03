#!/usr/bin/env node
// Score ALL dictionary words with LLM (resumable, randomized order)
// Usage: node scripts/bench/llm-score-all.mjs
// Ctrl+C safe: saves after every batch
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';

const OLLAMA = 'http://localhost:11434/api/generate';
const MODEL = 'llama3:8b';
const BATCH_SIZE = 50;
const INPUT_TSV = 'dist-dict/word-scores.tsv';
const SCORES_TSV = 'dist-dict/llm-scores-all.tsv';
const SHUFFLE_FILE = 'dist-dict/llm-shuffle-order.json';

// --- Prompt D (puzzle-optimized) ---

function buildPrompt(words) {
  const numbered = words.map((w, i) => `${i + 1}. ${w}`).join('\n');
  return `あなたは日本語の語彙評価者です。以下はすべて辞書見出し語のひらがな表記です。元の漢字・カタカナ表記を推測した上で、各単語の「一般的な知名度」を1〜10で評価してください。

この評価はワードパズル（クロスワード・しりとり・ワードサーチ等）の出題用辞書に使います。解答者が「ああ、その言葉ね！」とわかる単語ほど高スコアです。

【スコア基準】
10: 誰でもすぐわかる基本語。パズルの定番（例: やま→山, いぬ→犬, さくら→桜, たべる→食べる）
8-9: 日常語で、答えに出たら「簡単！」と感じる語（例: けいざい→経済, てれび→テレビ, しんぶん→新聞）
6-7: 一般成人なら「ああ、それね」と納得できる語。出題にちょうどいい難度（例: こすたりか→コスタリカ, ぎじゅつ→技術, せきじゆうじ→赤十字）
4-5: 知っている人は知っている語。やや難問向き（例: でんまるく→デンマーク, かいりゅう→海流）
2-3: 専門的で多くの解答者が「知らない…」となる語（例: せぐめんと→セグメント, きんまくえん→筋膜炎）
1: パズルに出たら「何これ？」となる語。出題に不向き（例: げんしりよくはつでんかんきようせいびきこう→原子力発電環境整備機構）

各行を「番号\\t単語\\tスコア」の形式で出力してください。説明は不要です。

${numbered}`;
}

// --- Parse numbered response ---

function parseResponse(text, words) {
  const scores = new Map();
  for (const line of text.split('\n')) {
    const cleaned = line.replace(/\\t/g, '\t').replace(/<TAB>/g, '\t');
    const m = cleaned.match(/^(\d+)[\.\t\s]+(.+?)[\t\s]+(\d+)\s*$/);
    if (m) {
      const idx = parseInt(m[1]) - 1;
      const score = parseInt(m[3]);
      if (idx >= 0 && idx < words.length && score >= 1 && score <= 10) {
        scores.set(idx, score);
      }
    }
  }
  return scores;
}

// --- Shuffle (Fisher-Yates with seed for reproducibility) ---

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  function rand() {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Load / Save ---

function loadAllWords() {
  const lines = readFileSync(INPUT_TSV, 'utf8').trim().split('\n').slice(1);
  return lines.map(l => {
    const [lang, word] = l.split('\t');
    return { lang, word };
  });
}

function loadOrCreateShuffleOrder(totalCount) {
  if (existsSync(SHUFFLE_FILE)) {
    const data = JSON.parse(readFileSync(SHUFFLE_FILE, 'utf8'));
    console.log(`Loaded existing shuffle order (seed=${data.seed}, ${data.indices.length} words)`);
    return data.indices;
  }
  const seed = 20260402;
  const indices = seededShuffle(Array.from({ length: totalCount }, (_, i) => i), seed);
  writeFileSync(SHUFFLE_FILE, JSON.stringify({ seed, indices }), 'utf-8');
  console.log(`Created new shuffle order (seed=${seed}, ${indices.length} words)`);
  return indices;
}

function loadExistingScores() {
  if (!existsSync(SCORES_TSV)) return new Set();
  const lines = readFileSync(SCORES_TSV, 'utf8').split('\n');
  const scored = new Set();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const parts = lines[i].split('\t');
    if (parts.length >= 3) scored.add(`${parts[0]}\t${parts[1]}`);
  }
  return scored;
}

// --- LLM call ---

async function scoreBatch(words, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(OLLAMA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          prompt: buildPrompt(words),
          stream: false,
          options: { temperature: 0, num_predict: words.length * 25 },
        }),
      });
      const data = await res.json();
      const elapsed = data.total_duration / 1e9;
      return { scores: parseResponse(data.response, words), elapsed };
    } catch (err) {
      if (attempt < retries) {
        console.error(`\n  Retry ${attempt + 1}: ${err.message}`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        console.error(`\n  Failed after ${retries + 1} attempts: ${err.message}`);
        return { scores: new Map(), elapsed: 0 };
      }
    }
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`;
}

// --- Main ---

async function main() {
  const allWords = loadAllWords();
  const shuffleOrder = loadOrCreateShuffleOrder(allWords.length);
  const scored = loadExistingScores();

  // Init output file
  if (!existsSync(SCORES_TSV)) {
    writeFileSync(SCORES_TSV, 'lang\tword\tllm_score\n', 'utf-8');
  }

  // Build work queue: shuffled indices, skip already scored
  const work = [];
  for (const idx of shuffleOrder) {
    const e = allWords[idx];
    if (!scored.has(`${e.lang}\t${e.word}`)) work.push(idx);
  }

  console.log('=== LLM Score All Words ===');
  console.log(`Model: ${MODEL}, Batch: ${BATCH_SIZE}`);
  console.log(`Total words: ${allWords.length}`);
  console.log(`Already scored: ${scored.size}`);
  console.log(`Remaining: ${work.length}`);
  if (work.length === 0) {
    console.log('All words already scored!');
    return;
  }

  const speed = 7.0;
  const estH = (work.length / speed / 3600).toFixed(1);
  console.log(`Estimated: ~${estH}h at ${speed}/s\n`);

  const start = performance.now();
  let done = 0;
  let totalScored = scored.size;

  for (let i = 0; i < work.length; i += BATCH_SIZE) {
    const batchIndices = work.slice(i, i + BATCH_SIZE);
    const batchEntries = batchIndices.map(idx => allWords[idx]);
    const words = batchEntries.map(e => e.word);

    const { scores, elapsed } = await scoreBatch(words);

    // Save immediately
    let chunk = '';
    for (let j = 0; j < batchEntries.length; j++) {
      const score = scores.get(j);
      if (score != null) {
        chunk += `${batchEntries[j].lang}\t${batchEntries[j].word}\t${score}\n`;
        totalScored++;
      }
    }
    if (chunk) appendFileSync(SCORES_TSV, chunk, 'utf-8');

    done = Math.min(i + BATCH_SIZE, work.length);
    const wallElapsed = (performance.now() - start) / 1000;
    const rate = done / wallElapsed;
    const eta = (work.length - done) / rate;
    const pct = ((totalScored / allWords.length) * 100).toFixed(1);
    const batchRate = (words.length / elapsed).toFixed(1);
    process.stderr.write(
      `\r  ${totalScored}/${allWords.length} (${pct}%) | batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(work.length / BATCH_SIZE)} [${scores.size}/${words.length}] ${batchRate}/s | ETA ${formatTime(eta)}   `
    );
  }

  process.stderr.write('\n');
  const wallElapsed = (performance.now() - start) / 1000;
  console.log(`\nDone in ${formatTime(wallElapsed)}`);
  console.log(`Total scored: ${totalScored}/${allWords.length}`);
}

main().catch(console.error);
