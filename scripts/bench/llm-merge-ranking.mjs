#!/usr/bin/env node
// Merge LLM scores with penalty → produce final word-ranking.tsv
// Usage: node scripts/bench/llm-merge-ranking.mjs
import { readFileSync, writeFileSync } from 'fs';

const INPUT_TSV = 'dist-dict/word-scores.tsv';
const LLM_SCORES_TSV = 'dist-dict/llm-scores-all.tsv';
const OUTPUT_TSV = 'dist-dict/word-ranking.tsv';

// --- Penalty v3 ---

function rawPenalty(word) {
  let p = 0;
  const parts = word.split('・');
  if (parts.length >= 3) p += 5;
  else if (parts.length === 2) p += 2;
  const len = word.replace(/・/g, '').length;
  if (len >= 20) p += 6;
  else if (len >= 15) p += 3;
  else if (len >= 12) p += 2;
  else if (len >= 9) p += 1;
  if (/をいう$|をする$|をもつ$|になる$|にする$|がする$|がある$|ができる$|である$|ではない$|のように$|ようなきがする$|ようにする$|ことがある$|ないように$|をかける$|をつける$|をとる$/.test(word)) p += 3;
  if (word.length > 8 && /ない$|する$|した$|ている$|される$|なければ$|ならない$|ばならない$/.test(word)) p += 2;
  return p;
}

function penalty(word) {
  const r = rawPenalty(word);
  if (r <= 2) return r;
  return 2 + Math.floor(r / 3);
}

// --- LLM score → synthetic count (for unified ranking with Bing) ---

const LLM_TO_SYNTHETIC = {
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

const LABEL_TO_SCORE = { common: 8, known: 5, obscure: 2 };

// --- Load ---

function loadInput() {
  const lines = readFileSync(INPUT_TSV, 'utf8').trim().split('\n').slice(1);
  return lines.map(l => {
    const [lang, word, bingCount, ollamaLabel] = l.split('\t');
    return { lang, word, bingCount: bingCount || '', ollamaLabel: ollamaLabel || '' };
  });
}

function loadLlmScores() {
  const lines = readFileSync(LLM_SCORES_TSV, 'utf8').trim().split('\n').slice(1);
  const scores = new Map();
  for (const line of lines) {
    if (!line) continue;
    const [lang, word, score] = line.split('\t');
    scores.set(`${lang}\t${word}`, parseInt(score));
  }
  return scores;
}

// --- Merge ---

function main() {
  const entries = loadInput();
  const llmScores = loadLlmScores();

  console.log('=== Merge: LLM scores + Penalty → Ranking ===');
  console.log(`Entries: ${entries.length}`);
  console.log(`LLM scores: ${llmScores.size}`);

  let penaltyApplied = 0;
  const penDist = {};

  const ranked = entries.map(e => {
    const key = `${e.lang}\t${e.word}`;
    const rawLlm = llmScores.get(key);
    let finalScore;
    let effectiveCount;

    if (rawLlm != null) {
      const pen = penalty(e.word);
      finalScore = Math.max(1, rawLlm - pen);
      if (pen > 0) penaltyApplied++;
      penDist[pen] = (penDist[pen] || 0) + 1;
    } else if (e.ollamaLabel && LABEL_TO_SCORE[e.ollamaLabel]) {
      finalScore = LABEL_TO_SCORE[e.ollamaLabel];
    } else {
      finalScore = null;
    }

    if (finalScore != null) {
      effectiveCount = LLM_TO_SYNTHETIC[finalScore] ?? 1;
    } else {
      effectiveCount = 0;
    }

    return {
      lang: e.lang,
      word: e.word,
      bingCount: e.bingCount,
      llmRaw: rawLlm ?? '',
      llmFinal: finalScore ?? '',
      ollamaLabel: e.ollamaLabel,
      effectiveCount,
    };
  });

  // Sort: descending by effective count, then alphabetical
  ranked.sort((a, b) => {
    if (b.effectiveCount !== a.effectiveCount) return b.effectiveCount - a.effectiveCount;
    return a.word.localeCompare(b.word, 'ja');
  });

  // Write output
  const header = 'rank\tlang\tword\tbing_count\tllm_raw\tllm_final\tollama_label\teffective_count\n';
  const lines = [header];
  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    lines.push(`${i + 1}\t${r.lang}\t${r.word}\t${r.bingCount}\t${r.llmRaw}\t${r.llmFinal}\t${r.ollamaLabel}\t${r.effectiveCount}\n`);
  }
  writeFileSync(OUTPUT_TSV, lines.join(''), 'utf-8');

  // --- Stats ---
  const withBing = ranked.filter(r => r.bingCount && parseInt(r.bingCount) > 0).length;
  const withLlm = ranked.filter(r => r.llmRaw !== '').length;
  const noSignal = ranked.filter(r => r.effectiveCount === 0).length;

  console.log(`\nPenalty applied: ${penaltyApplied} words`);
  console.log('Penalty distribution:');
  for (const p of Object.keys(penDist).sort((a, b) => a - b)) {
    console.log(`  pen=${p}: ${penDist[p]}`);
  }

  // LLM final score distribution
  const finalScores = ranked.map(r => r.llmFinal).filter(v => v !== '');
  console.log('\nLLM final score distribution (after penalty):');
  for (let s = 1; s <= 10; s++) {
    const c = finalScores.filter(v => v === s).length;
    console.log(`  ${s}: ${c} (${((c / finalScores.length) * 100).toFixed(1)}%)`);
  }

  console.log(`\nRanking saved: ${OUTPUT_TSV}`);
  console.log(`With Bing: ${withBing}, With LLM: ${withLlm}, No signal: ${noSignal}`);

  console.log('\nTop 30:');
  for (let i = 0; i < 30; i++) {
    const r = ranked[i];
    console.log(`  ${i + 1}. ${r.word} (bing=${r.bingCount || '-'}, llm=${r.llmRaw}→${r.llmFinal}, eff=${r.effectiveCount})`);
  }
  console.log('\nBottom 20:');
  for (let i = Math.max(0, ranked.length - 20); i < ranked.length; i++) {
    const r = ranked[i];
    console.log(`  ${i + 1}. ${r.word} (bing=${r.bingCount || '-'}, llm=${r.llmRaw}→${r.llmFinal}, eff=${r.effectiveCount})`);
  }
}

main();
