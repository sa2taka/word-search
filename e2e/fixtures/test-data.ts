export interface TestEntry {
  lang: 'ja' | 'en';
  surface: string;
  reading?: string;
  pos?: string;
}

const jaBaseWords: TestEntry[] = [
  { lang: 'ja', surface: '猫', reading: 'ねこ', pos: '名詞' },
  { lang: 'ja', surface: '犬', reading: 'いぬ', pos: '名詞' },
  { lang: 'ja', surface: '東京', reading: 'とうきょう', pos: '名詞' },
  { lang: 'ja', surface: '大阪', reading: 'おおさか', pos: '名詞' },
  { lang: 'ja', surface: '京都', reading: 'きょうと', pos: '名詞' },
  { lang: 'ja', surface: '北海道', reading: 'ほっかいどう', pos: '名詞' },
  { lang: 'ja', surface: '食べる', reading: 'たべる', pos: '動詞' },
  { lang: 'ja', surface: '走る', reading: 'はしる', pos: '動詞' },
  { lang: 'ja', surface: '美しい', reading: 'うつくしい', pos: '形容詞' },
  { lang: 'ja', surface: '大きい', reading: 'おおきい', pos: '形容詞' },
];

const enBaseWords: TestEntry[] = [
  { lang: 'en', surface: 'cat', pos: 'noun' },
  { lang: 'en', surface: 'dog', pos: 'noun' },
  { lang: 'en', surface: 'tokyo', pos: 'noun' },
  { lang: 'en', surface: 'apple', pos: 'noun' },
  { lang: 'en', surface: 'application', pos: 'noun' },
  { lang: 'en', surface: 'beautiful', pos: 'adjective' },
  { lang: 'en', surface: 'run', pos: 'verb' },
  { lang: 'en', surface: 'running', pos: 'noun' },
  { lang: 'en', surface: 'runner', pos: 'noun' },
  { lang: 'en', surface: 'sunset', pos: 'noun' },
];

function generatePrefixTestWords(lang: 'ja' | 'en', prefix: string, count: number): TestEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    lang,
    surface: `${prefix}${String(i + 1).padStart(3, '0')}`,
    pos: lang === 'ja' ? '名詞' : 'noun',
  }));
}

function generateRegexTestWords(lang: 'ja' | 'en'): TestEntry[] {
  if (lang === 'ja') {
    return [
      { lang: 'ja', surface: '赤色', reading: 'あかいろ', pos: '名詞' },
      { lang: 'ja', surface: '青色', reading: 'あおいろ', pos: '名詞' },
      { lang: 'ja', surface: '黄色', reading: 'きいろ', pos: '名詞' },
    ];
  }
  return [
    { lang: 'en', surface: 'test123', pos: 'noun' },
    { lang: 'en', surface: 'test456', pos: 'noun' },
    { lang: 'en', surface: 'data789', pos: 'noun' },
  ];
}

// 50件超のデータ群（ページネーション検証用）
const jaPaginationWords = generatePrefixTestWords('ja', '単語', 55);
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
