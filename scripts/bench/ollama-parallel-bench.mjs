import { performance } from 'node:perf_hooks';

const model = process.argv[2] ?? 'qwen2.5:3b';
const PARALLEL = parseInt(process.argv[3] ?? '4', 10);

// Same 500 words as ollama-500w-bench.mjs
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

function buildPrompt(batch) {
  // /no_think disables qwen3's thinking mode for cleaner JSON output
  return [
    '/no_think',
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

async function classify(batch, id) {
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
  let payload;
  try {
    payload = JSON.parse(body.response);
  } catch {
    // Strip thinking tags if present, then retry
    const cleaned = body.response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    payload = jsonMatch ? JSON.parse(jsonMatch[0]) : { items: [] };
  }
  return {
    id,
    elapsedMs,
    itemCount: Array.isArray(payload.items) ? payload.items.length : 0,
    inputCount: batch.length,
    evalCount: body.eval_count,
  };
}

// Split words into chunks
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function runSequential(chunks, label) {
  const start = performance.now();
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    process.stderr.write(`\r  ${label}: ${i + 1}/${chunks.length}`);
    results.push(await classify(chunks[i], i));
  }
  process.stderr.write('\n');
  const totalMs = performance.now() - start;
  const totalItems = results.reduce((s, r) => s + r.itemCount, 0);
  return { label, mode: 'sequential', totalMs, totalItems, results };
}

async function runParallel(chunks, concurrency, label) {
  const start = performance.now();
  const results = [];
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const batchNum = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(chunks.length / concurrency);
    process.stderr.write(`\r  ${label}: wave ${batchNum}/${totalBatches}`);
    const batchResults = await Promise.all(
      batch.map((c, j) => classify(c, i + j)),
    );
    results.push(...batchResults);
  }
  process.stderr.write('\n');
  const totalMs = performance.now() - start;
  const totalItems = results.reduce((s, r) => s + r.itemCount, 0);
  return { label, mode: `parallel(${concurrency})`, totalMs, totalItems, results };
}

console.log(`Model: ${model}`);
console.log(`Words: ${words.length}`);
console.log(`OLLAMA_NUM_PARALLEL: ${PARALLEL}\n`);

// Warmup
await classify(words.slice(0, 5), -1);

const chunks25 = chunk(words, 25); // 20 chunks
const chunks50 = chunk(words, 50); // 10 chunks

// Sequential baseline (25-word chunks)
const seqResult = await runSequential(chunks25, '25w x 20 seq');

// Parallel with 2 concurrent (25-word chunks)
const par2Result = await runParallel(chunks25, 2, '25w x 20 par2');

// Parallel with 4 concurrent (25-word chunks)
const par4Result = await runParallel(chunks25, 4, '25w x 20 par4');

// Parallel with 4 concurrent (50-word chunks)
const par4_50Result = await runParallel(chunks50, 4, '50w x 10 par4');

// Parallel with 2 concurrent (50-word chunks)
const par2_50Result = await runParallel(chunks50, 2, '50w x 10 par2');

const allResults = [seqResult, par2Result, par4Result, par4_50Result, par2_50Result];

console.log('\n=== Results ===');
console.log('Config'.padEnd(22) + 'Time'.padStart(8) + 'Items'.padStart(8) + 'Coverage'.padStart(10));
console.log('-'.repeat(48));
for (const r of allResults) {
  const time = `${(r.totalMs / 1000).toFixed(1)}s`;
  console.log(
    `${r.label} (${r.mode})`.padEnd(22).slice(0, 22)
    + time.padStart(8)
    + `${r.totalItems}`.padStart(8)
    + `${r.totalItems}/${words.length}`.padStart(10),
  );
}

console.log('\n=== Per-batch times ===');
for (const r of allResults) {
  const times = r.results.map((b) => `${(b.elapsedMs / 1000).toFixed(1)}`).join(', ');
  console.log(`${r.label}: ${times}`);
}

console.log('\n=== JSON ===');
console.log(JSON.stringify({
  model,
  wordCount: words.length,
  parallel: PARALLEL,
  results: allResults.map((r) => ({
    label: r.label,
    mode: r.mode,
    totalMs: Math.round(r.totalMs),
    totalItems: r.totalItems,
    coverage: `${r.totalItems}/${words.length}`,
    batchTimes: r.results.map((b) => Math.round(b.elapsedMs)),
    batchItems: r.results.map((b) => b.itemCount),
  })),
}, null, 2));
