import { performance } from 'node:perf_hooks';

const model = process.argv[2] ?? 'qwen2.5:3b';

const datasets = {
  ja10: ['ねこ', 'いぬ', 'りんご', 'みかん', 'でんしゃ', 'とうきょう', 'さくら', 'がっこう', 'こども', 'せかい'],
  ja20: [
    'ねこ', 'いぬ', 'りんご', 'みかん', 'でんしゃ', 'とうきょう', 'さくら', 'がっこう', 'こども', 'せかい',
    'でんき', 'じしょ', 'てがみ', 'しんぶん', 'えいが', 'おんがく', 'じてんしゃ', 'ひこうき', 'くすり', 'びょういん',
  ],
  en10: ['cat', 'dog', 'apple', 'orange', 'train', 'tokyo', 'school', 'music', 'movie', 'world'],
};

function buildPrompt(a, b) {
  return [
    '2つの単語 A/B を比べて、より一般的に使われ、一般的に知られている単語を選んでください。',
    '出力は必ず A または B の1文字のみ。説明禁止。',
    `A: ${a}`,
    `B: ${b}`,
  ].join('\n');
}

async function compareWords(a, b, stats) {
  stats.calls += 1;
  const start = performance.now();
  const response = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      prompt: buildPrompt(a, b),
      options: { temperature: 0 },
    }),
  });
  const elapsed = performance.now() - start;
  stats.elapsedMs += elapsed;

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const json = await response.json();
  const text = String(json.response ?? '').trim().toUpperCase();
  return text.startsWith('A') ? -1 : 1;
}

async function runDataset(name, words) {
  const stats = { calls: 0, elapsedMs: 0 };
  const warmupStats = { calls: 0, elapsedMs: 0 };
  await compareWords(words[0], words[1], warmupStats);

  const sorted = [];
  const start = performance.now();

  for (const word of words) {
    let inserted = false;

    for (let i = 0; i < sorted.length; i++) {
      const cmp = await compareWords(word, sorted[i], stats);
      if (cmp < 0) {
        sorted.splice(i, 0, word);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      sorted.push(word);
    }
  }

  return {
    name,
    n: words.length,
    calls: stats.calls,
    warmupMs: warmupStats.elapsedMs,
    compareAvgMs: stats.elapsedMs / Math.max(stats.calls, 1),
    totalMs: performance.now() - start,
    sorted,
  };
}

const results = [];
for (const [name, words] of Object.entries(datasets)) {
  results.push(await runDataset(name, words));
}

console.log(JSON.stringify({ model, results }, null, 2));
