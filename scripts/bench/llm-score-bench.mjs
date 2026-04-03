/**
 * Benchmark: LLM pointwise scoring with anchor calibration.
 * Tests C=50 and C=100 batch sizes with qwen3:8b.
 * Measures: time per batch, parse success rate, score distribution, anchor stability.
 */
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';

const MODEL = 'qwen3:8b';

// Anchor words (included in every batch for calibration)
const ANCHORS = [
  { w: '猫', expected: 10 },
  { w: '経済', expected: 8 },
  { w: '矛盾', expected: 6 },
  { w: '邂逅', expected: 3 },
  { w: '蟠り', expected: 1 },
];

function buildScoringPrompt(words) {
  const anchorsStr = ANCHORS.map((a) => `${a.w}=${a.expected}`).join(', ');
  return [
    '/no_think',
    '以下の日本語の単語を「一般的な日本語話者がどの程度知っているか」で1〜10の整数スコアで評価してください。',
    '',
    'スコアの目安:',
    '10 = 小学生でも知っている基本語（食べる、猫、大きい）',
    '8-9 = 日常会話で普通に使う語（経済、提案、恐竜）',
    '6-7 = 新聞やニュースで見かける語（概念、憂鬱、是非）',
    '4-5 = 教養ある人が知っている語（齟齬、忖度、瑕疵）',
    '2-3 = 専門家や古文研究者が知る語（邂逅、諧謔、韜晦）',
    '1 = ほぼ誰も知らない極めて稀な語',
    '',
    `アンカー（これらのスコアは固定です）: ${anchorsStr}`,
    '',
    'JSON配列のみ返してください。余計なテキストは不要です。',
    '形式: [{"w":"猫","s":10},{"w":"経済","s":8}]',
    '',
    `単語: ${words.join(', ')}`,
  ].join('\n');
}

function parseScoreResponse(response) {
  // Try direct JSON parse
  let parsed;
  try {
    parsed = JSON.parse(response);
  } catch {
    // Strip <think> tags if present
    const cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    // Try to extract JSON array
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        parsed = JSON.parse(arrMatch[0]);
      } catch {
        // Try fixing common issues: trailing comma
        const fixed = arrMatch[0].replace(/,\s*\]/, ']').replace(/,\s*\}/, '}');
        parsed = JSON.parse(fixed);
      }
    } else {
      // Try extracting from {"items": [...]} wrapper
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objMatch) {
        const obj = JSON.parse(objMatch[0]);
        parsed = obj.items ?? obj.results ?? obj.words ?? [];
      } else {
        throw new Error('No JSON found');
      }
    }
  }
  // Handle both array and object wrapper formats
  const arr = Array.isArray(parsed) ? parsed : parsed.items ?? parsed.results ?? parsed.words ?? parsed.data ?? [];
  return arr
    .filter((item) => item && (item.w || item.word) && (item.s != null || item.score != null))
    .map((item) => ({
      word: item.w || item.word,
      score: Number(item.s ?? item.score),
    }));
}

async function ollamaScore(words) {
  const prompt = buildScoringPrompt(words);
  const res = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      format: 'json',
      prompt,
      options: { temperature: 0, num_predict: 4096 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const body = await res.json();
  return { items: parseScoreResponse(body.response), raw: body.response, evalDuration: body.eval_duration };
}

// Load sample words from TSV
function loadSampleWords(tsvPath, count) {
  const lines = readFileSync(tsvPath, 'utf-8').split('\n').slice(1).filter(Boolean);
  // Stratified sample: pick evenly from the file
  const step = Math.floor(lines.length / count);
  const words = [];
  for (let i = 0; i < count && i * step < lines.length; i++) {
    const parts = lines[i * step].split('\t');
    words.push(parts[1]); // word column
  }
  return words;
}

// ============ Benchmark ============

async function benchBatchSize(allWords, C, trials = 3) {
  console.log(`\n--- Batch size C=${C} (${trials} trials) ---`);
  const results = [];

  for (let t = 0; t < trials; t++) {
    // Pick C words from allWords (different slice each trial)
    const offset = t * C;
    const targetWords = allWords.slice(offset, offset + C);
    const batchWords = [...ANCHORS.map((a) => a.w), ...targetWords];

    const start = performance.now();
    try {
      const { items, evalDuration } = await ollamaScore(batchWords);
      const elapsed = (performance.now() - start) / 1000;

      // Analyze results
      const coverage = items.length;
      const anchorResults = ANCHORS.map((a) => {
        const found = items.find((i) => i.word === a.w);
        return { word: a.w, expected: a.expected, got: found?.score ?? null };
      });
      const anchorAccuracy = anchorResults.filter((a) => a.got === a.expected).length;

      // Score distribution
      const scores = items.filter((i) => !ANCHORS.some((a) => a.w === i.word)).map((i) => i.score);
      const dist = {};
      for (const s of scores) dist[s] = (dist[s] || 0) + 1;

      results.push({
        trial: t + 1,
        elapsed,
        evalMs: evalDuration ? (evalDuration / 1e6).toFixed(0) : '?',
        coverage,
        expected: batchWords.length,
        coverageRate: ((coverage / batchWords.length) * 100).toFixed(1),
        anchorAccuracy: `${anchorAccuracy}/5`,
        anchorDetails: anchorResults,
        dist,
        wordsPerSec: (batchWords.length / elapsed).toFixed(1),
      });

      console.log(
        `  Trial ${t + 1}: ${elapsed.toFixed(1)}s, ${coverage}/${batchWords.length} parsed (${((coverage / batchWords.length) * 100).toFixed(0)}%), ` +
          `anchors ${anchorAccuracy}/5, ${(batchWords.length / elapsed).toFixed(1)} w/s`,
      );
      console.log(`    Anchors: ${anchorResults.map((a) => `${a.word}:${a.got ?? '?'}(exp${a.expected})`).join(', ')}`);
      console.log(`    Score dist: ${Object.entries(dist).sort(([a],[b]) => a-b).map(([k,v]) => `${k}:${v}`).join(' ')}`);
    } catch (err) {
      console.log(`  Trial ${t + 1}: FAILED - ${err.message}`);
      results.push({ trial: t + 1, failed: true, error: err.message });
    }
  }
  return results;
}

// ============ Main ============

const TSV_PATH = 'dist-dict/word-scores.tsv';
console.log('Loading sample words...');
const allWords = loadSampleWords(TSV_PATH, 1000);
console.log(`Loaded ${allWords.length} sample words`);

// Warm up Ollama
console.log('\nWarming up Ollama...');
await ollamaScore(['テスト']);
console.log('Ready.\n');

// Benchmark C=50
const r50 = await benchBatchSize(allWords, 50, 3);

// Benchmark C=100
const r100 = await benchBatchSize(allWords, 100, 3);

// Benchmark C=200
const r200 = await benchBatchSize(allWords, 200, 2);

// ============ Summary ============

console.log('\n=== SUMMARY ===');
for (const [label, results] of [
  ['C=50', r50],
  ['C=100', r100],
  ['C=200', r200],
]) {
  const good = results.filter((r) => !r.failed);
  if (good.length === 0) {
    console.log(`${label}: ALL FAILED`);
    continue;
  }
  const avgTime = good.reduce((s, r) => s + r.elapsed, 0) / good.length;
  const avgCoverage = good.reduce((s, r) => s + parseFloat(r.coverageRate), 0) / good.length;
  const avgWps = good.reduce((s, r) => s + parseFloat(r.wordsPerSec), 0) / good.length;
  const batchSize = label.match(/\d+/)[0];
  const totalCalls = Math.ceil(327551 / parseInt(batchSize));
  const totalHours = (totalCalls * avgTime) / 3600;
  console.log(
    `${label}: avg ${avgTime.toFixed(1)}s/batch, ${avgCoverage.toFixed(0)}% coverage, ${avgWps.toFixed(1)} w/s` +
      ` → 327K words: ${totalCalls} calls, ~${totalHours.toFixed(1)}h`,
  );
}
