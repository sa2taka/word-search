import { performance } from 'node:perf_hooks';

const model = process.argv[2] ?? 'qwen2.5:3b';

// 500 Japanese words across various categories
const words = [
  // Original 100
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
  // 101-200: Animals, body, clothing
  'うさぎ', 'くま', 'さる', 'ぞう', 'きりん', 'ぺんぎん', 'いるか', 'くじら', 'わし', 'からす',
  'すずめ', 'はと', 'かえる', 'へび', 'かめ', 'さかな', 'えび', 'かに', 'たこ', 'いか',
  'あたま', 'かお', 'め', 'はな', 'くち', 'みみ', 'て', 'あし', 'ゆび', 'かた',
  'むね', 'おなか', 'せなか', 'こし', 'ひざ', 'かかと', 'つめ', 'かみのけ', 'ひげ', 'ほね',
  'しゃつ', 'ずぼん', 'すかーと', 'わんぴーす', 'じゃけっと', 'こーと', 'せーたー', 'くつした', 'すりっぱ', 'さんだる',
  'ねくたい', 'べると', 'めがね', 'ゆびわ', 'ねっくれす', 'いやりんぐ', 'うでどけい', 'はんかち', 'かさ', 'てぶくろ',
  'まふらー', 'ぶーつ', 'すにーかー', 'りゅっく', 'ぽけっと', 'ぼたん', 'ふぁすなー', 'きぬ', 'めん', 'うーる',
  'あいろん', 'せんたくもの', 'ものほし', 'たんす', 'くろーぜっと', 'はんがー', 'しみ', 'ほころび', 'ぬいもの', 'みしん',
  'おしゃれ', 'りぼん', 'ぶろーち', 'ばっじ', 'わっぺん', 'すとーる', 'ばんだな', 'きゃっぷ', 'べれーぼう', 'さんぐらす',
  'こんたくと', 'ますく', 'えぷろん', 'みずぎ', 'ぱじゃま', 'ゆかた', 'きもの', 'はかま', 'おび', 'たび',
  // 201-300: Food, kitchen, nature
  'しょうゆ', 'みそ', 'さとう', 'しお', 'こしょう', 'す', 'みりん', 'さけ', 'わさび', 'からし',
  'まよねーず', 'けちゃっぷ', 'そーす', 'ばたー', 'ちーず', 'よーぐると', 'あいす', 'けーき', 'ちょこれーと', 'くっきー',
  'ぜりー', 'ぷりん', 'だいふく', 'ようかん', 'せんべい', 'もち', 'だんご', 'まんじゅう', 'どーなつ', 'くれーぷ',
  'ふらいぱん', 'なべ', 'やかん', 'まないた', 'ほうちょう', 'おたま', 'ざる', 'ぼうる', 'みきさー', 'おーぶん',
  'とーすたー', 'すいはんき', 'でんしれんじ', 'しょっき', 'ちゃわん', 'おわん', 'ゆのみ', 'きゅうす', 'とっくり', 'おちょこ',
  'たき', 'いずみ', 'いけ', 'みずうみ', 'ぬま', 'しま', 'はんとう', 'みさき', 'がけ', 'どうくつ',
  'さばく', 'おあしす', 'じゃんぐる', 'くさはら', 'たんぼ', 'はたけ', 'にわ', 'こうえん', 'はやし', 'たけやぶ',
  'すぎ', 'まつ', 'たけ', 'うめ', 'もみじ', 'いちょう', 'つばき', 'ひまわり', 'ゆり', 'すみれ',
  'ばら', 'たんぽぽ', 'あさがお', 'こすもす', 'きく', 'あじさい', 'らべんだー', 'ちゅーりっぷ', 'かーねーしょん', 'おーきっど',
  'きのこ', 'しいたけ', 'まつたけ', 'こけ', 'しだ', 'わらび', 'ぜんまい', 'どんぐり', 'くり', 'まめ',
  // 301-400: Society, work, abstract
  'せいふ', 'こっかい', 'さいばんしょ', 'けいさつ', 'しょうぼうしょ', 'やくしょ', 'たいしかん', 'りょうじかん', 'ぐんたい', 'かいぐん',
  'りくぐん', 'くうぐん', 'せんそう', 'ぶき', 'へいし', 'しょうぐん', 'さむらい', 'にんじゃ', 'ろうにん', 'しょうにん',
  'のうみん', 'りょうし', 'きこり', 'いしゃ', 'かんごし', 'べんごし', 'けんちくか', 'えんじにあ', 'かがくしゃ', 'きょうじゅ',
  'さっか', 'しじん', 'がか', 'ちょうこくか', 'しゃしんか', 'かんとく', 'はいゆう', 'かしゅ', 'ぴあにすと', 'しきしゃ',
  'こうじょう', 'のうじょう', 'ぎょこう', 'こうざん', 'はつでんしょ', 'だむ', 'くうこう', 'みなと', 'えき', 'ばすてい',
  'きょうかい', 'じんじゃ', 'てら', 'もすく', 'はくぶつかん', 'びじゅつかん', 'としょかん', 'すたじあむ', 'げきじょう', 'おんがくどう',
  'しゅうきょう', 'てつがく', 'しんり', 'ろんり', 'すうがく', 'ぶつり', 'かがく', 'せいぶつ', 'ちり', 'てんもん',
  'けいざい', 'しゃかい', 'せいじ', 'ほうりつ', 'けんぽう', 'みんしゅ', 'じんけん', 'びょうどう', 'さべつ', 'へんけん',
  'どりょく', 'こんき', 'ゆうき', 'にんたい', 'けんきょ', 'かんしゃ', 'どうじょう', 'しんらい', 'そんけい', 'あいじょう',
  'しっと', 'うらみ', 'にくしみ', 'こうかい', 'ざんねん', 'むなしい', 'さびしい', 'なつかしい', 'うれしい', 'たのしい',
  // 401-500: Modern life, technology, misc
  'すまほ', 'たぶれっと', 'のーとぱそこん', 'でじかめ', 'いやほん', 'すぴーかー', 'まいく', 'ぷりんたー', 'すきゃなー', 'るーたー',
  'わいふぁい', 'ぶるーとぅーす', 'えすえぬえす', 'あぷり', 'げーむ', 'あにめ', 'まんが', 'どらま', 'にゅーす', 'ぶろぐ',
  'どうが', 'はいしん', 'すとりーみんぐ', 'さぶすく', 'くらうど', 'さーばー', 'でーたべーす', 'ぷろぐらむ', 'あるごりずむ', 'えーあい',
  'ろぼっと', 'どろーん', 'でんきじどうしゃ', 'じどううんてん', 'たいようこう', 'ふうりょく', 'げんしりょく', 'りさいくる', 'えこ', 'えすでぃーじーず',
  'いんふれ', 'でふれ', 'かぶしき', 'とうし', 'ちょきん', 'ろーん', 'ほけん', 'ねんきん', 'ぜいきん', 'よさん',
  'まーけてぃんぐ', 'ぶらんど', 'こうこく', 'せーるす', 'ぷれぜん', 'かいぎ', 'ざんぎょう', 'ゆうきゅう', 'しゅうしょく', 'てんしょく',
  'りれきしょ', 'めんせつ', 'きゅうよ', 'ぼーなす', 'しょうしん', 'いどう', 'たいしょく', 'きぎょう', 'べんちゃー', 'すたーとあっぷ',
  'とっきょ', 'ちょさくけん', 'しょうひょう', 'けいやく', 'ほしょう', 'ばいしょう', 'そしょう', 'わかい', 'ちょうてい', 'さいけつ',
  'でもくらしー', 'きゃぴたりずむ', 'そーしゃりずむ', 'ぐろーばる', 'なしょなりずむ', 'てろ', 'なんみん', 'いみん', 'たようせい', 'きょうせい',
  'さすてなぶる', 'いのべーしょん', 'でぃすらぷしょん', 'ぱらだいむ', 'りてらしー', 'めんたるへるす', 'うぇるびーいんぐ', 'まいんどふるねす', 'れじりえんす', 'えんぱしー',
];

console.log(`Model: ${model}`);
console.log(`Words: ${words.length}\n`);

function buildPrompt(batch) {
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

async function classify(batch) {
  const start = performance.now();
  const response = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      prompt: buildPrompt(batch),
      options: { temperature: 0 },
    }),
  });
  const elapsedMs = performance.now() - start;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  const payload = JSON.parse(body.response);
  return {
    elapsedMs,
    itemCount: Array.isArray(payload.items) ? payload.items.length : 0,
    labels: payload.items ?? [],
    rawLength: body.response.length,
    evalCount: body.eval_count,
    promptEvalCount: body.prompt_eval_count,
  };
}

// --- One-shot (all 500) ---
console.log('=== One-shot (500 words at once) ===');
const oneShotStart = performance.now();
let oneShot;
try {
  oneShot = await classify(words);
  console.log(`Time: ${(oneShot.elapsedMs / 1000).toFixed(1)}s`);
  console.log(`Items returned: ${oneShot.itemCount}/${words.length}`);
  console.log(`Eval tokens: ${oneShot.evalCount}, Prompt tokens: ${oneShot.promptEvalCount}`);
} catch (err) {
  console.log(`FAILED: ${err.message}`);
  oneShot = null;
}

// --- Chunked (25 words x 20) ---
console.log('\n=== Chunked (25 words x 20 batches) ===');
const chunkedStart = performance.now();
const chunkResults = [];
for (let i = 0; i < words.length; i += 25) {
  const chunk = words.slice(i, i + 25);
  process.stderr.write(`\r  Batch ${Math.floor(i / 25) + 1}/20`);
  chunkResults.push(await classify(chunk));
}
process.stderr.write('\n');
const chunkedElapsed = performance.now() - chunkedStart;
const totalChunkedItems = chunkResults.reduce((s, r) => s + r.itemCount, 0);

console.log(`Time: ${(chunkedElapsed / 1000).toFixed(1)}s`);
console.log(`Items returned: ${totalChunkedItems}/${words.length}`);
console.log(`Batch times: ${chunkResults.map((r) => (r.elapsedMs / 1000).toFixed(1) + 's').join(', ')}`);

// --- Chunked (50 words x 10) ---
console.log('\n=== Chunked (50 words x 10 batches) ===');
const chunked50Start = performance.now();
const chunk50Results = [];
for (let i = 0; i < words.length; i += 50) {
  const chunk = words.slice(i, i + 50);
  process.stderr.write(`\r  Batch ${Math.floor(i / 50) + 1}/10`);
  chunk50Results.push(await classify(chunk));
}
process.stderr.write('\n');
const chunked50Elapsed = performance.now() - chunked50Start;
const totalChunked50Items = chunk50Results.reduce((s, r) => s + r.itemCount, 0);

console.log(`Time: ${(chunked50Elapsed / 1000).toFixed(1)}s`);
console.log(`Items returned: ${totalChunked50Items}/${words.length}`);
console.log(`Batch times: ${chunk50Results.map((r) => (r.elapsedMs / 1000).toFixed(1) + 's').join(', ')}`);

// --- Summary ---
console.log('\n=== Summary ===');
console.log(JSON.stringify({
  model,
  wordCount: words.length,
  oneShot: oneShot ? {
    elapsedMs: Math.round(oneShot.elapsedMs),
    itemCount: oneShot.itemCount,
    coverage: `${oneShot.itemCount}/${words.length}`,
  } : 'FAILED',
  chunked25: {
    elapsedMs: Math.round(chunkedElapsed),
    batches: chunkResults.length,
    itemCounts: chunkResults.map((r) => r.itemCount),
    totalItems: totalChunkedItems,
    coverage: `${totalChunkedItems}/${words.length}`,
  },
  chunked50: {
    elapsedMs: Math.round(chunked50Elapsed),
    batches: chunk50Results.length,
    itemCounts: chunk50Results.map((r) => r.itemCount),
    totalItems: totalChunked50Items,
    coverage: `${totalChunked50Items}/${words.length}`,
  },
}, null, 2));
