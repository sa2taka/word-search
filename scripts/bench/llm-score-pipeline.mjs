/**
 * LLM Pointwise Scoring Pipeline for dictionary words.
 *
 * Scores words that have no Bing hit count, using Ollama qwen3:8b.
 * Each word gets a 1-10 "commonness" score via no-format-json approach
 * (the only method that produces varied, quality scores from qwen3).
 *
 * Saves progress incrementally — safe to resume after crash.
 * After completion, run with --merge to produce final ranked TSV.
 *
 * Usage:
 *   node scripts/bench/llm-score-pipeline.mjs                  # Score missing words
 *   node scripts/bench/llm-score-pipeline.mjs --merge           # Merge into final ranking
 *   node scripts/bench/llm-score-pipeline.mjs --resume          # Resume interrupted scoring
 */
import { performance } from 'node:perf_hooks';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';

// ---------- Config ----------
const args = process.argv.slice(2);
const MERGE_ONLY = args.includes('--merge');
const RESUME = args.includes('--resume');
const MODEL = 'qwen3:8b';
const BATCH_SIZE = 25;
const INPUT_TSV = 'dist-dict/word-scores.tsv';
const SCORES_TSV = 'dist-dict/llm-scores.tsv';
const OUTPUT_TSV = 'dist-dict/word-ranking.tsv';
const MAX_RETRIES = 3;

// ---------- Scoring ----------

function buildPrompt(words) {
  return [
    '/no_think',
    '以下の日本語の単語それぞれについて、「一般的な日本語話者がどの程度知っているか」を1〜10の整数スコアで評価してください。',
    '',
    'スコアの目安:',
    '10 = 小学生でも知っている基本語（食べる、猫、大きい）',
    '8-9 = 日常会話で普通に使う語（天気、友達、電車）',
    '6-7 = 新聞やニュースで見かける語（概念、憂鬱、是非）',
    '4-5 = 教養ある人が知っている語（齟齬、忖度、瑕疵）',
    '2-3 = 専門家や古文研究者が知る語（邂逅、諧謔、韜晦）',
    '1 = ほぼ誰も知らない極めて稀な語',
    '',
    '各行「単語[TAB]スコア」の形式のみ出力してください。他のテキストは不要です。',
    '',
    '以下を評価:',
    ...words,
  ].join('\n');
}

function parseResponse(response, expectedWords) {
  const cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const results = new Map();
  for (const line of cleaned.split('\n')) {
    // Try tab-separated: word\tscore
    let match = line.match(/^(.+?)\t(\d+)\s*$/);
    if (!match) {
      // Try space-separated: word  score
      match = line.match(/^(.+?)\s+(\d+)\s*$/);
    }
    if (!match) continue;
    const word = match[1].trim();
    const score = parseInt(match[2]);
    if (score >= 1 && score <= 10) {
      results.set(word, score);
    }
  }
  return results;
}

async function scoreBatch(words, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          stream: false,
          prompt: buildPrompt(words),
          options: { temperature: 0, num_predict: 4096 },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return parseResponse(body.response, words);
    } catch (err) {
      if (attempt < retries - 1) {
        process.stderr.write(`\n  Retry ${attempt + 1}: ${err.message}`);
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      } else {
        process.stderr.write(`\n  FAILED after ${retries} attempts: ${err.message}`);
        return new Map();
      }
    }
  }
  return new Map();
}

// ---------- Load data ----------

function loadInputTsv() {
  const lines = readFileSync(INPUT_TSV, 'utf-8').split('\n');
  const header = lines[0];
  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const parts = line.split('\t');
    entries.push({
      lang: parts[0],
      word: parts[1],
      bingCount: parts[2] || null,
      ollamaLabel: parts[3] || null,
    });
  }
  return entries;
}

function loadExistingScores() {
  if (!existsSync(SCORES_TSV)) return new Map();
  const lines = readFileSync(SCORES_TSV, 'utf-8').split('\n');
  const scores = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const parts = lines[i].split('\t');
    if (parts.length >= 3) {
      scores.set(`${parts[0]}\t${parts[1]}`, parseInt(parts[2]));
    }
  }
  return scores;
}

// ---------- Scoring phase ----------

async function runScoring() {
  console.log('=== LLM Scoring Pipeline ===');
  console.log(`Model: ${MODEL}, Batch: ${BATCH_SIZE}`);
  console.log(`Input: ${INPUT_TSV}`);
  console.log(`Scores: ${SCORES_TSV}\n`);

  const entries = loadInputTsv();
  const noBing = entries.filter((e) => !e.bingCount);
  console.log(`Total entries: ${entries.length}`);
  console.log(`No Bing count: ${noBing.length}\n`);

  // Load existing scores for resume
  const existing = RESUME ? loadExistingScores() : new Map();
  const toScore = noBing.filter((e) => !existing.has(`${e.lang}\t${e.word}`));

  if (RESUME) {
    console.log(`Already scored: ${existing.size}`);
    console.log(`Remaining: ${toScore.length}\n`);
  }

  if (toScore.length === 0) {
    console.log('All words already scored!');
    return;
  }

  // Initialize output file
  if (!RESUME || !existsSync(SCORES_TSV)) {
    writeFileSync(SCORES_TSV, 'lang\tword\tllm_score\n', 'utf-8');
  }

  const start = performance.now();
  let done = 0;
  let scored = existing.size;
  const total = toScore.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = toScore.slice(i, i + BATCH_SIZE);
    const words = batch.map((e) => e.word);

    const results = await scoreBatch(words);

    // Save results incrementally
    let chunk = '';
    for (const entry of batch) {
      const score = results.get(entry.word);
      if (score != null) {
        chunk += `${entry.lang}\t${entry.word}\t${score}\n`;
        scored++;
      }
    }
    if (chunk) appendFileSync(SCORES_TSV, chunk, 'utf-8');

    done = Math.min(i + BATCH_SIZE, total);
    const elapsed = (performance.now() - start) / 1000;
    const rate = done / elapsed;
    const eta = (total - done) / rate;
    const coverageRate = ((scored / (existing.size + done)) * 100).toFixed(0);
    process.stderr.write(
      `\r  Score: ${done}/${total} (${rate.toFixed(1)}/s, ETA ${formatTime(eta)}) scored=${scored} (${coverageRate}%)`,
    );
  }
  process.stderr.write('\n');
  const elapsed = (performance.now() - start) / 1000;
  console.log(`\nScoring complete in ${formatTime(elapsed)}`);
  console.log(`Scored: ${scored}/${noBing.length} (${((scored / noBing.length) * 100).toFixed(1)}%)`);
}

// ---------- Merge phase ----------

// Map LLM 1-10 scores to synthetic Bing-equivalent counts for unified ranking
const LLM_TO_SYNTHETIC_COUNT = {
  10: 1_000_000,
  9: 300_000,
  8: 50_000,
  7: 10_000,
  6: 3_000,
  5: 500,
  4: 200,
  3: 50,
  2: 10,
  1: 1,
};

// Map old 3-category labels to LLM-equivalent scores
const LABEL_TO_SCORE = {
  common: 8,
  known: 5,
  obscure: 2,
};

function runMerge() {
  console.log('=== Merge Phase ===');

  const entries = loadInputTsv();
  const llmScores = loadExistingScores();
  console.log(`Entries: ${entries.length}`);
  console.log(`LLM scores: ${llmScores.size}`);

  // Compute effective score for each entry
  const ranked = entries.map((e) => {
    const key = `${e.lang}\t${e.word}`;
    let effectiveCount;

    if (e.bingCount && parseInt(e.bingCount) > 0) {
      effectiveCount = parseInt(e.bingCount);
    } else if (llmScores.has(key)) {
      const score = llmScores.get(key);
      effectiveCount = LLM_TO_SYNTHETIC_COUNT[score] ?? 1;
    } else if (e.ollamaLabel && LABEL_TO_SCORE[e.ollamaLabel]) {
      const score = LABEL_TO_SCORE[e.ollamaLabel];
      effectiveCount = LLM_TO_SYNTHETIC_COUNT[score] ?? 1;
    } else {
      effectiveCount = 0; // No signal at all
    }

    return {
      lang: e.lang,
      word: e.word,
      bingCount: e.bingCount || '',
      llmScore: llmScores.get(key) ?? '',
      ollamaLabel: e.ollamaLabel || '',
      effectiveCount,
    };
  });

  // Sort: descending by effective count, then alphabetical
  ranked.sort((a, b) => {
    if (b.effectiveCount !== a.effectiveCount) return b.effectiveCount - a.effectiveCount;
    return a.word.localeCompare(b.word, 'ja');
  });

  // Write output
  const header = 'rank\tlang\tword\tbing_count\tllm_score\tollama_label\teffective_count\n';
  let output = header;
  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    output += `${i + 1}\t${r.lang}\t${r.word}\t${r.bingCount}\t${r.llmScore}\t${r.ollamaLabel}\t${r.effectiveCount}\n`;
  }
  writeFileSync(OUTPUT_TSV, output, 'utf-8');

  // Stats
  const withBing = ranked.filter((r) => r.bingCount).length;
  const withLlm = ranked.filter((r) => r.llmScore !== '').length;
  const withLabel = ranked.filter((r) => r.ollamaLabel).length;
  const noSignal = ranked.filter((r) => r.effectiveCount === 0).length;
  console.log(`\nRanking saved: ${OUTPUT_TSV}`);
  console.log(`With Bing count: ${withBing}`);
  console.log(`With LLM score: ${withLlm}`);
  console.log(`With label only: ${withLabel - withLlm}`);
  console.log(`No signal: ${noSignal}`);
  console.log(`\nTop 20:`);
  for (let i = 0; i < 20 && i < ranked.length; i++) {
    const r = ranked[i];
    console.log(`  ${i + 1}. ${r.word} (bing=${r.bingCount || '-'}, llm=${r.llmScore || '-'}, eff=${r.effectiveCount})`);
  }
  console.log(`\nBottom 20:`);
  for (let i = Math.max(0, ranked.length - 20); i < ranked.length; i++) {
    const r = ranked[i];
    console.log(`  ${i + 1}. ${r.word} (bing=${r.bingCount || '-'}, llm=${r.llmScore || '-'}, eff=${r.effectiveCount})`);
  }
}

// ---------- Utils ----------

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '??';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h${m}m${s}s`;
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

// ---------- Main ----------

if (MERGE_ONLY) {
  runMerge();
} else {
  await runScoring();
  console.log('\nNow running merge...\n');
  runMerge();
}
