export interface TestEntry {
  lang: 'ja' | 'en';
  word: string;
  pos?: string;
  sources?: string[];
  score?: number;
}

const jaBaseWords: TestEntry[] = [
  { lang: 'ja', word: 'ねこ', pos: '名詞', score: 10 },
  { lang: 'ja', word: 'いぬ', pos: '名詞', score: 9 },
  { lang: 'ja', word: 'とうきよう', pos: '名詞', score: 8 },
  { lang: 'ja', word: 'おおさか', pos: '名詞', score: 7 },
  { lang: 'ja', word: 'きようと', pos: '名詞', score: 7 },
  { lang: 'ja', word: 'ほつかいどう', pos: '名詞', score: 6 },
  { lang: 'ja', word: 'たべる', pos: '動詞', score: 10 },
  { lang: 'ja', word: 'はしる', pos: '動詞', score: 9 },
  { lang: 'ja', word: 'うつくしい', pos: '形容詞', score: 7 },
  { lang: 'ja', word: 'おおきい', pos: '形容詞', score: 9 },
  // TDN検索用 (た行・だ行・な行)
  { lang: 'ja', word: 'たなか', pos: '名詞', score: 8 },   // T=た, N=な, K=か
  { lang: 'ja', word: 'どなべ', pos: '名詞', score: 6 },   // D=だ行, N=な行, B=ば行
  { lang: 'ja', word: 'なつ', pos: '名詞', score: 7 },     // N=な行, T=た行
  { lang: 'ja', word: 'にく', pos: '名詞', score: 7 },     // N=な行, K=か行
  { lang: 'ja', word: 'はた', pos: '名詞', score: 7 },     // は+T(た行): mixed kana+consonant test
  // 数字パターン検索用 (は112 → はいいろ, か111き → かたたたき)
  { lang: 'ja', word: 'はいいろ', pos: '名詞', score: 8 }, // は+い+い+ろ (は112型)
  { lang: 'ja', word: 'かたたたき', pos: '名詞', score: 7 }, // か+た+た+た+き (か111き型)
  { lang: 'ja', word: 'ききかいかい', pos: '名詞', score: 6 }, // 112323型
  // 単語分割用 (ごじ + さんじ = ごんじじさ)
  { lang: 'ja', word: 'ごじ', pos: '名詞', score: 8 },
  { lang: 'ja', word: 'さんじ', pos: '名詞', score: 8 },
  { lang: 'ja', word: 'じかん', pos: '名詞', score: 9 },
  { lang: 'ja', word: 'かんじ', pos: '名詞', score: 9 },
  // クロス検索用 (は112 + 12がみ → はいいろ + いろがみ)
  { lang: 'ja', word: 'いろがみ', pos: '名詞', score: 8 }, // い+ろ+が+み (12がみ型)
  // 母音検索用: aaai パターン (なまあし, わたがし)
  { lang: 'ja', word: 'なまあし', pos: '名詞', score: 6 }, // な(a)ま(a)あ(a)し(i) = 'aaai'
  { lang: 'ja', word: 'わたがし', pos: '名詞', score: 6 }, // わ(a)た(a)が(a)し(i) = 'aaai'
  // 母音検索用: aaa パターン (さかな, たなか は既存)
  { lang: 'ja', word: 'さかな', pos: '名詞', score: 9 },   // さ(a)か(a)な(a) = 'aaa'
  // 母音検索用: au パターン (なつ は既存)
  { lang: 'ja', word: 'はる', pos: '名詞', score: 9 },     // は(a)る(u) = 'au'
];

const enBaseWords: TestEntry[] = [
  { lang: 'en', word: 'act', pos: 'verb' },
  { lang: 'en', word: 'cat', pos: 'noun' },
  { lang: 'en', word: 'dog', pos: 'noun' },
  { lang: 'en', word: 'tokyo', pos: 'noun' },
  { lang: 'en', word: 'apple', pos: 'noun' },
  { lang: 'en', word: 'application', pos: 'noun' },
  { lang: 'en', word: 'beautiful', pos: 'adjective' },
  { lang: 'en', word: 'run', pos: 'verb' },
  { lang: 'en', word: 'running', pos: 'noun' },
  { lang: 'en', word: 'runner', pos: 'noun' },
  { lang: 'en', word: 'sunset', pos: 'noun' },
  // 数字パターン: aabb → 1122パターン
  { lang: 'en', word: 'aabb', pos: 'noun' },
  // 単語分割用: cat + dog = catdog (アナグラム的に acdgot)
  { lang: 'en', word: 'sun', pos: 'noun' },
  { lang: 'en', word: 'set', pos: 'noun' },
];

function generatePrefixTestWords(lang: 'ja' | 'en', prefix: string, count: number): TestEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    lang,
    word: `${prefix}${String(i + 1).padStart(3, '0')}`,
    pos: lang === 'ja' ? '名詞' : 'noun',
  }));
}

function generateRegexTestWords(lang: 'ja' | 'en'): TestEntry[] {
  if (lang === 'ja') {
    return [
      { lang: 'ja', word: 'あかいろ', pos: '名詞' },
      { lang: 'ja', word: 'あおいろ', pos: '名詞' },
      { lang: 'ja', word: 'きいろ', pos: '名詞' },
    ];
  }
  return [
    { lang: 'en', word: 'test123', pos: 'noun' },
    { lang: 'en', word: 'test456', pos: 'noun' },
    { lang: 'en', word: 'data789', pos: 'noun' },
  ];
}

// 50件超のデータ群（ページネーション検証用）
const jaPaginationWords = generatePrefixTestWords('ja', 'たんご', 55);
const enPaginationWords = generatePrefixTestWords('en', 'word', 55);

export const TEST_ENTRIES: TestEntry[] = [
  ...jaBaseWords,
  ...enBaseWords,
  ...generateRegexTestWords('ja'),
  ...generateRegexTestWords('en'),
  ...jaPaginationWords,
  ...enPaginationWords,
];

export const TEST_META = {
  version: '1.0.0',
  url: '/dict.sqlite',
  sha256: '',
  bytes: 0,
  created_at: '2025-01-01T00:00:00Z',
  schema: 2,
  sources: [
    {
      name: 'Test Dictionary',
      license: 'MIT',
      version: '1.0.0',
      attribution: 'Test Attribution',
    },
  ],
};
