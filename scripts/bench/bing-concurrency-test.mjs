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

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function parseBingCount(html) {
  const m = html.match(/sb_count[^>]*>([^<]+)/);
  if (!m) return undefined;
  const n = m[1].replace(/[,\s約件の結果resultsa-zA-Z]/g, '').match(/(\d+)/);
  return n ? parseInt(n[1], 10) : undefined;
}

async function fetchBing(word) {
  const query = `"${word}" 日本語 単語`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=ja`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.9' } });
  if (!res.ok) return { word, count: undefined, status: res.status };
  const html = await res.text();
  return { word, count: parseBingCount(html), status: 200 };
}

async function runTest(concurrency, delayMs, label) {
  const results = [];
  const start = performance.now();

  for (let i = 0; i < words.length; i += concurrency) {
    const batch = words.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((w) => fetchBing(w).catch((e) => ({ word: w, count: undefined, status: `err:${e.message}` }))),
    );
    results.push(...batchResults);
    if (delayMs > 0 && i + concurrency < words.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const elapsed = performance.now() - start;
  const ok = results.filter((r) => r.count != null).length;
  const http200 = results.filter((r) => r.status === 200).length;
  const errors = results.filter((r) => typeof r.status === 'string').length;

  console.log(`${label.padEnd(28)} ${(elapsed / 1000).toFixed(1).padStart(6)}s  ok=${String(ok).padStart(3)}/100  http200=${http200}  errors=${errors}`);
  return { label, elapsed, ok, http200, errors };
}

console.log('Testing Bing concurrency/delay combos on 100 words...\n');
console.log('Config'.padEnd(28) + '  Time'.padStart(6) + '  Counts  HTTP200  Errors');
console.log('-'.repeat(72));

// Progressive tests: from conservative to aggressive
await runTest(3, 500, 'conc=3  delay=500ms (base)');
await runTest(5, 200, 'conc=5  delay=200ms');
await runTest(10, 100, 'conc=10 delay=100ms');
await runTest(10, 0, 'conc=10 delay=0ms');
await runTest(20, 0, 'conc=20 delay=0ms');
await runTest(50, 0, 'conc=50 delay=0ms');
await runTest(100, 0, 'conc=100 delay=0ms');
