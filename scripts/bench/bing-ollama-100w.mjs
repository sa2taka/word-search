import { performance } from 'node:perf_hooks';

const model = 'qwen3:8b';
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

function buildPrompt(batch) {
  return [
    '/no_think',
    '次の日本語単語を、一般性で3段階分類してください。',
    '分類は common, known, obscure のいずれかだけを使ってください。',
    'JSONのみ返してください。',
    '形式: {"items":[{"word":"ねこ","label":"common"}]}',
    `単語: ${batch.join(', ')}`,
  ].join('\n');
}

async function classify(batch) {
  const start = performance.now();
  const res = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: false, format: 'json', prompt: buildPrompt(batch), options: { temperature: 0 } }),
  });
  const body = await res.json();
  let payload;
  try { payload = JSON.parse(body.response); } catch { payload = { items: [] }; }
  return { elapsedMs: performance.now() - start, items: payload.items ?? [] };
}

async function fetchBing(word) {
  const query = `"${word}" 日本語 単語`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=ja`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.9' } });
  if (!res.ok) return { word, count: undefined };
  const html = await res.text();
  const m = html.match(/sb_count[^>]*>([^<]+)/);
  if (m) {
    const n = m[1].replace(/[,\s約件の結果resultsa-zA-Z]/g, '').match(/(\d+)/);
    if (n) return { word, count: parseInt(n[1], 10) };
  }
  return { word, count: undefined };
}

async function bingBatch(wordList, conc) {
  const results = [];
  for (let i = 0; i < wordList.length; i += conc) {
    const batch = wordList.slice(i, i + conc);
    results.push(...await Promise.all(batch.map((w) => fetchBing(w).catch(() => ({ word: w, count: undefined })))));
    if (i + conc < wordList.length) await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}

// Warmup Ollama
await classify(words.slice(0, 5));

// === Run 1: Parallel (Bing + Ollama 50w x 2 simultaneously) ===
console.log('=== Parallel: Bing(conc=3) + Ollama(50w x 2) simultaneously ===');
const parStart = performance.now();
const [bingPar, ollama1, ollama2] = await Promise.all([
  bingBatch(words, 3),
  classify(words.slice(0, 50)),
  classify(words.slice(50, 100)),
]);
const parTotal = performance.now() - parStart;
const bingParOk = bingPar.filter((r) => r.count != null).length;
const ollamaParItems = ollama1.items.length + ollama2.items.length;
console.log(`Total wall time: ${(parTotal / 1000).toFixed(1)}s`);
console.log(`Bing: ${bingParOk}/100 exact counts`);
console.log(`Ollama: ${ollamaParItems}/100 classified`);
console.log(`Ollama chunks: ${(ollama1.elapsedMs / 1000).toFixed(1)}s + ${(ollama2.elapsedMs / 1000).toFixed(1)}s`);

// === Run 2: Sequential (Bing first, then Ollama) ===
console.log('\n=== Sequential: Bing then Ollama ===');
const seqStart = performance.now();
const bingSeq = await bingBatch(words, 3);
const bingSeqTime = performance.now() - seqStart;
const ollamaSeq1 = await classify(words.slice(0, 50));
const ollamaSeq2 = await classify(words.slice(50, 100));
const seqTotal = performance.now() - seqStart;
const ollamaSeqTime = seqTotal - bingSeqTime;
console.log(`Total wall time: ${(seqTotal / 1000).toFixed(1)}s`);
console.log(`  Bing: ${(bingSeqTime / 1000).toFixed(1)}s`);
console.log(`  Ollama: ${(ollamaSeqTime / 1000).toFixed(1)}s (${(ollamaSeq1.elapsedMs / 1000).toFixed(1)}s + ${(ollamaSeq2.elapsedMs / 1000).toFixed(1)}s)`);

// === Comparison ===
console.log('\n=== Summary ===');
console.log(`Parallel:   ${(parTotal / 1000).toFixed(1)}s`);
console.log(`Sequential: ${(seqTotal / 1000).toFixed(1)}s`);
console.log(`Speedup:    ${(seqTotal / parTotal).toFixed(2)}x`);
