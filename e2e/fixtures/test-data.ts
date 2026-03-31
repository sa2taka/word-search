export interface TestEntry {
  lang: 'ja' | 'en';
  word: string;
  pos?: string;
  sources?: string[];
}

const jaBaseWords: TestEntry[] = [
  { lang: 'ja', word: 'ねこ', pos: '名詞' },
  { lang: 'ja', word: 'いぬ', pos: '名詞' },
  { lang: 'ja', word: 'とうきよう', pos: '名詞' },
  { lang: 'ja', word: 'おおさか', pos: '名詞' },
  { lang: 'ja', word: 'きようと', pos: '名詞' },
  { lang: 'ja', word: 'ほつかいどう', pos: '名詞' },
  { lang: 'ja', word: 'たべる', pos: '動詞' },
  { lang: 'ja', word: 'はしる', pos: '動詞' },
  { lang: 'ja', word: 'うつくしい', pos: '形容詞' },
  { lang: 'ja', word: 'おおきい', pos: '形容詞' },
];

const enBaseWords: TestEntry[] = [
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
  schema: 1,
  sources: [
    {
      name: 'Test Dictionary',
      license: 'MIT',
      version: '1.0.0',
      attribution: 'Test Attribution',
    },
  ],
};
