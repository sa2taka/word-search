import { performance } from 'node:perf_hooks';

const model = process.argv[2] ?? 'qwen2.5:3b';
const CONCURRENCY = 3;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const words = [
  'ねこ', 'いぬ', 'りんご', 'みかん', 'でんしゃ', 'とうきょう', 'さくら', 'がっこう', 'こども', 'せかい',
  'でんき', 'じしょ', 'てがみ', 'しんぶん', 'えいが', 'おんがく', 'じてんしゃ', 'ひこうき', 'くすり', 'びょういん',
  'やま', 'かわ', 'うみ', 'そら', 'つき', 'たいよう', 'ほし', 'あめ', 'ゆき', 'かぜ',
  'はな', 'き', 'もり', 'みち', 'いえ', 'へや', 'まど', 'つくえ', 'いす', 'ほん',
  'えんぴつ', 'けしごむ', 'かばん', 'くつ', 'ぼうし', 'とけい', 'でんわ', 'ぱそこん', 'かめら', 'てれび',
  'れいぞうこ', 'せんたくき', 'そうじき', 'ふとん', 'まくら', 'たおる', 'こっぷ', 'さら', 'はし', 'すぷーん',
  'らーめん', 'すし', 'てんぷら', 'おにぎり', 'みそしる', 'ぎゅうにゅう', 'ぱん', 'たまご', 'やさい', 'くだもの',
  'ともだち', 'せんせい', 'がくせい', 'かぞく', 'おとうさん', 'おかあさん', 'おじいさん', 'おばあさん', 'あかちゃん', 'こいびと',
  'みらい', 'かこ', 'げんざい', 'じゆう', 'へいわ', 'せいぎ', 'ゆめ', 'きぼう', 'しあわせ', 'かなしい',
  'もじ', 'ことば', 'ぶんしょう', 'なぞ', 'ぱずる', 'くろすわーど', 'しりとり', 'なまえ', 'ちず', 'れきし',
];

// ========== Phase 1: Bing scraping ==========

function parseBingResult(html) {
  const sbMatch = html.match(/sb_count[^>]*>([^<]+)/);
  if (sbMatch) {
    const num = sbMatch[1].replace(/[,\s約件の結果resultsa-zA-Z]/g, '').match(/(\d+)/);
    if (num) return { count: parseInt(num[1], 10), source: 'bing' };
  }
  const algoMatches = html.match(/class="b_algo"/g);
  const algoCount = algoMatches ? algoMatches.length : 0;
  if (algoCount > 0) return { count: undefined, pageResults: algoCount, source: 'bing_no_count' };
  return { count: undefined, pageResults: 0, source: 'none' };
}

async function fetchBingCount(word) {
  const query = `"${word}" 日本語 単語`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=ja`;
  const response = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.9' },
  });
  if (!response.ok) return { word, count: undefined, source: 'http_error' };
  const html = await response.text();
  return { word, ...parseBingResult(html) };
}

async function scrapeBing(wordList) {
  const results = [];
  const start = performance.now();
  for (let i = 0; i < wordList.length; i += CONCURRENCY) {
    const batch = wordList.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((w) => fetchBingCount(w).catch(() => ({ word: w, count: undefined, source: 'error' }))),
    );
    results.push(...batchResults);
    if (i + CONCURRENCY < wordList.length) await new Promise((r) => setTimeout(r, 500));
    process.stderr.write(`\r  Bing: ${Math.min(i + CONCURRENCY, wordList.length)}/${wordList.length}`);
  }
  process.stderr.write('\n');
  return { results, elapsedMs: performance.now() - start };
}

// ========== Phase 2: Ollama batch classification ==========

function buildClassifyPrompt(batch) {
  return [
    '次の日本語単語を、一般性で3段階分類してください。',
    '分類は common, known, obscure のいずれかだけを使ってください。',
    'common = 頻出で非常によく知られている',
    'known = 知られてはいる',
    'obscure = あまり知られていない',
    'JSONのみ返してください。',
    '形式: {"items":[{"word":"ねこ","label":"common"}]}',
    `単語: ${batch.join(', ')}`,
  ].join('\n');
}

async function ollamaClassify(batch) {
  const start = performance.now();
  const response = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      prompt: buildClassifyPrompt(batch),
      options: { temperature: 0 },
    }),
  });
  const body = await response.json();
  const payload = JSON.parse(body.response);
  return {
    items: payload.items ?? [],
    elapsedMs: performance.now() - start,
  };
}

async function classifyAll(wordList) {
  const start = performance.now();
  const chunkSize = 25;
  const allItems = [];
  for (let i = 0; i < wordList.length; i += chunkSize) {
    const chunk = wordList.slice(i, i + chunkSize);
    process.stderr.write(`\r  Ollama classify: ${Math.min(i + chunkSize, wordList.length)}/${wordList.length}`);
    const result = await ollamaClassify(chunk);
    allItems.push(...result.items);
  }
  process.stderr.write('\n');
  return { items: allItems, elapsedMs: performance.now() - start };
}

// ========== Phase 3a: Category median imputation ==========

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function imputeByMedian(bingResults, ollamaItems) {
  const labelMap = new Map(ollamaItems.map((item) => [item.word, item.label]));

  // Group known Bing counts by category
  const countsByLabel = { common: [], known: [], obscure: [] };
  for (const r of bingResults) {
    if (r.count != null) {
      const label = labelMap.get(r.word) ?? 'known';
      if (countsByLabel[label]) countsByLabel[label].push(r.count);
    }
  }

  const medians = {
    common: median(countsByLabel.common),
    known: median(countsByLabel.known),
    obscure: median(countsByLabel.obscure),
  };

  return bingResults.map((r) => {
    if (r.count != null) return { ...r, finalCount: r.count, method: 'bing' };
    const label = labelMap.get(r.word) ?? 'known';
    return { ...r, finalCount: medians[label], label, method: `median_${label}` };
  });
}

// ========== Phase 3b: Direct LLM estimation ==========

function buildEstimationPrompt(knownPairs, unknownWords) {
  const examples = knownPairs
    .slice(0, 20)
    .map((p) => `${p.word}: ${p.count}`)
    .join(', ');

  return [
    '以下のBing検索ヒット数の例を参考に、不明な単語のヒット数を推定してください。',
    `クエリ形式: "単語" 日本語 単語`,
    `例: ${examples}`,
    'JSONのみ返してください。',
    '形式: {"items":[{"word":"ねこ","estimated":50000}]}',
    `推定してほしい単語: ${unknownWords.join(', ')}`,
  ].join('\n');
}

async function ollamaEstimate(knownPairs, unknownWords) {
  const start = performance.now();
  const response = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      prompt: buildEstimationPrompt(knownPairs, unknownWords),
      options: { temperature: 0 },
    }),
  });
  const body = await response.json();
  const payload = JSON.parse(body.response);
  return {
    items: payload.items ?? [],
    elapsedMs: performance.now() - start,
  };
}

function imputeByEstimation(bingResults, estimatedItems) {
  const estimateMap = new Map(estimatedItems.map((item) => [item.word, item.estimated]));
  return bingResults.map((r) => {
    if (r.count != null) return { ...r, finalCount: r.count, method: 'bing' };
    const estimated = estimateMap.get(r.word);
    return { ...r, finalCount: estimated ?? 0, method: estimated != null ? 'llm_estimate' : 'fallback_0' };
  });
}

// ========== Main ==========

console.log(`Model: ${model}`);
console.log(`Words: ${words.length}\n`);

// Phase 1: Bing (always needed)
console.log('=== Phase 1: Bing Scraping ===');
const bing = await scrapeBing(words);
const withCount = bing.results.filter((r) => r.count != null);
const missing = bing.results.filter((r) => r.count == null);
console.log(`Time: ${(bing.elapsedMs / 1000).toFixed(1)}s`);
console.log(`Exact count: ${withCount.length}, Missing: ${missing.length}\n`);

// Phase 2: Ollama classify (for both approaches)
console.log('=== Phase 2: Ollama Batch Classification ===');
const classify = await classifyAll(words);
console.log(`Time: ${(classify.elapsedMs / 1000).toFixed(1)}s`);
console.log(`Classified: ${classify.items.length} words\n`);

// Phase 3a: Median imputation
console.log('=== Phase 3a: Category Median Imputation ===');
const medianStart = performance.now();
const medianResults = imputeByMedian(bing.results, classify.items);
const medianElapsed = performance.now() - medianStart;

// Compute category medians for display
const labelMap = new Map(classify.items.map((item) => [item.word, item.label]));
const countsByLabel = { common: [], known: [], obscure: [] };
for (const r of bing.results) {
  if (r.count != null) {
    const label = labelMap.get(r.word) ?? 'known';
    if (countsByLabel[label]) countsByLabel[label].push(r.count);
  }
}
console.log(`Category medians:`);
for (const [label, counts] of Object.entries(countsByLabel)) {
  console.log(`  ${label}: ${median(counts).toLocaleString()} (n=${counts.length})`);
}

// Phase 3b: Direct LLM estimation
console.log('\n=== Phase 3b: Direct LLM Estimation ===');
const knownPairs = withCount.map((r) => ({ word: r.word, count: r.count }));
const missingWords = missing.map((r) => r.word);
process.stderr.write(`  Estimating ${missingWords.length} words...\n`);
const estimation = await ollamaEstimate(knownPairs, missingWords);
console.log(`Time: ${(estimation.elapsedMs / 1000).toFixed(1)}s`);
console.log(`Estimated: ${estimation.items.length} words\n`);
const estimateResults = imputeByEstimation(bing.results, estimation.items);

// ========== Comparison ==========

console.log('=== Comparison: Imputed values for missing words ===');
console.log('word'.padEnd(12) + 'median_method'.padStart(20) + 'median_val'.padStart(12) + '  |  ' + 'llm_val'.padStart(12));
console.log('-'.repeat(70));
for (const word of missingWords) {
  const mr = medianResults.find((r) => r.word === word);
  const er = estimateResults.find((r) => r.word === word);
  const label = labelMap.get(word) ?? '?';
  console.log(
    word.padEnd(12)
    + `${mr.method}`.padStart(20)
    + `${mr.finalCount?.toLocaleString() ?? '-'}`.padStart(12)
    + '  |  '
    + `${er.finalCount?.toLocaleString() ?? '-'}`.padStart(12),
  );
}

// ========== Timing Summary ==========

const totalMedianMs = bing.elapsedMs + classify.elapsedMs + medianElapsed;
const totalEstimateMs = bing.elapsedMs + estimation.elapsedMs;

console.log('\n=== Timing Summary ===');
console.log(`Bing scraping:         ${(bing.elapsedMs / 1000).toFixed(1)}s`);
console.log(`Ollama classify:       ${(classify.elapsedMs / 1000).toFixed(1)}s`);
console.log(`Ollama direct estimate: ${(estimation.elapsedMs / 1000).toFixed(1)}s`);
console.log(`---`);
console.log(`Approach A (Bing + classify + median): ${(totalMedianMs / 1000).toFixed(1)}s  [100% coverage]`);
console.log(`Approach B (Bing + direct estimate):   ${(totalEstimateMs / 1000).toFixed(1)}s  [100% coverage]`);

console.log('\n=== JSON Summary ===');
console.log(JSON.stringify({
  model,
  wordCount: words.length,
  bingExactCount: withCount.length,
  bingMissing: missing.length,
  missingWords,
  approachA: {
    name: 'Bing + Ollama classify + category median',
    totalMs: Math.round(totalMedianMs),
    bingMs: Math.round(bing.elapsedMs),
    classifyMs: Math.round(classify.elapsedMs),
    imputedSample: medianResults.filter((r) => r.method !== 'bing').slice(0, 8),
  },
  approachB: {
    name: 'Bing + Ollama direct estimation',
    totalMs: Math.round(totalEstimateMs),
    bingMs: Math.round(bing.elapsedMs),
    estimateMs: Math.round(estimation.elapsedMs),
    imputedSample: estimateResults.filter((r) => r.method !== 'bing').slice(0, 8),
  },
}, null, 2));
