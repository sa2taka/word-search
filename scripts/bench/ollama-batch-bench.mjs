import { performance } from 'node:perf_hooks';

const model = process.argv[2] ?? 'qwen2.5:3b';
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

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

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

const oneShot = await classify(words);

const chunkedStart = performance.now();
const chunkResults = [];
for (let i = 0; i < words.length; i += 25) {
  chunkResults.push(await classify(words.slice(i, i + 25)));
}

console.log(JSON.stringify({
  model,
  oneShot: {
    elapsedMs: oneShot.elapsedMs,
    itemCount: oneShot.itemCount,
    rawLength: oneShot.rawLength,
    evalCount: oneShot.evalCount,
    promptEvalCount: oneShot.promptEvalCount,
    sample: oneShot.labels.slice(0, 12),
  },
  chunked: {
    elapsedMs: performance.now() - chunkedStart,
    batches: chunkResults.length,
    itemCounts: chunkResults.map((result) => result.itemCount),
    elapsedEachMs: chunkResults.map((result) => Math.round(result.elapsedMs)),
    sample: chunkResults[0]?.labels.slice(0, 8) ?? [],
  },
}, null, 2));
