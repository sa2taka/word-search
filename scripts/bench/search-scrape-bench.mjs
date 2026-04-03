import { performance } from 'node:perf_hooks';

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

const CONCURRENCY = parseInt(process.argv[2] ?? '3', 10);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ---------- Bing scraping ----------

function parseBingResult(html) {
  // 1. Primary: <span class="sb_count">約 52,800 件の結果</span>
  const sbMatch = html.match(/sb_count[^>]*>([^<]+)/);
  if (sbMatch) {
    const num = sbMatch[1].replace(/[,\s約件の結果resultsa-zA-Z]/g, '').match(/(\d+)/);
    if (num) return { count: parseInt(num[1], 10), source: 'sb_count' };
  }

  // 2. Fallback: "X results" / "X 件" anywhere in b_tween
  const tweenMatch = html.match(/id="b_tween_searchResults"[^>]*>([\s\S]{0,500}?)<\/div>/);
  if (tweenMatch) {
    const num = tweenMatch[1].replace(/[,\s]/g, '').match(/(\d+)/);
    if (num) return { count: parseInt(num[1], 10), source: 'b_tween' };
  }

  // 3. Fallback: count b_algo items on page (0-10, indicates "has results")
  const algoMatches = html.match(/class="b_algo"/g);
  const algoCount = algoMatches ? algoMatches.length : 0;

  // If we got result items, Bing just hid the total count (common for popular words)
  if (algoCount > 0) {
    return { count: undefined, pageResults: algoCount, source: 'b_algo_only' };
  }

  return { count: undefined, pageResults: 0, source: 'none' };
}

async function fetchBingCount(word) {
  const query = `"${word}" 日本語 単語`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=ja`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'ja,en;q=0.9',
    },
  });
  if (!response.ok) {
    return { word, count: undefined, pageResults: 0, source: 'http_error', status: response.status };
  }
  const html = await response.text();
  const { count, pageResults, source } = parseBingResult(html);
  return { word, count, pageResults, source, status: response.status };
}

// ---------- Runner with concurrency control ----------

async function runWithConcurrency(items, fetcher, concurrency) {
  const results = [];
  let errors = 0;
  const start = performance.now();

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((word) => fetcher(word).catch((err) => {
      errors++;
      return { word, count: undefined, pageResults: 0, source: `error: ${err.message}` };
    })));
    results.push(...batchResults);

    if (i + concurrency < items.length) {
      await new Promise((r) => setTimeout(r, 500));
    }

    const done = Math.min(i + concurrency, items.length);
    process.stderr.write(`\r  ${done}/${items.length}`);
  }

  process.stderr.write('\n');
  const elapsedMs = performance.now() - start;
  return { results, elapsedMs, errors };
}

// ---------- Main ----------

console.log(`Concurrency: ${CONCURRENCY}`);
console.log(`Words: ${words.length}\n`);

console.log('--- Bing ---');
const bing = await runWithConcurrency(words, fetchBingCount, CONCURRENCY);

const withCount = bing.results.filter((r) => r.count != null);
const withPageOnly = bing.results.filter((r) => r.count == null && r.pageResults > 0);
const noData = bing.results.filter((r) => r.count == null && (!r.pageResults || r.pageResults === 0));

console.log(`Time: ${(bing.elapsedMs / 1000).toFixed(1)}s`);
console.log(`Exact count:  ${withCount.length}/${words.length}`);
console.log(`Page results only (no total): ${withPageOnly.length}/${words.length}`);
console.log(`No data:      ${noData.length}/${words.length}`);
console.log(`Errors:       ${bing.errors}`);

console.log('\nAll results:');
for (const r of bing.results) {
  const countStr = r.count != null ? r.count.toLocaleString() : '-';
  const pageStr = r.pageResults != null ? r.pageResults : '-';
  console.log(`  ${r.word.padEnd(10)} count=${countStr.padStart(12)}  page=${String(pageStr).padStart(2)}  src=${r.source}`);
}

// Summary JSON
console.log('\n--- Summary ---');
console.log(JSON.stringify({
  concurrency: CONCURRENCY,
  wordCount: words.length,
  elapsedMs: Math.round(bing.elapsedMs),
  exactCount: withCount.length,
  pageResultsOnly: withPageOnly.length,
  noData: noData.length,
  errors: bing.errors,
  failedWords: [...withPageOnly, ...noData].map((r) => r.word),
}, null, 2));
