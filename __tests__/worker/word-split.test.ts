import { describe, test, expect } from 'vitest';
import type { Database } from 'sql.js';
import type { Lang } from '../../src/shared/types';
import { initSqlite, openDb } from '../../src/worker/db';
import { executeWordSplit } from '../../src/worker/word-split';
import { WorkerError } from '../../src/worker/worker-error';

interface TestEntry {
  lang: Lang;
  word: string;
  score?: number;
}

async function createTestDb(entries: TestEntry[]): Promise<Database> {
  const SQL = await initSqlite();
  const db = openDb(SQL);
  db.run(`
    CREATE TABLE entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lang TEXT NOT NULL,
      word TEXT NOT NULL,
      pos TEXT,
      sources TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 1
    )
  `);
  const stmt = db.prepare(
    'INSERT INTO entries (lang, word, pos, sources, score) VALUES (?, ?, ?, ?, ?)',
  );
  for (const e of entries) {
    stmt.run([e.lang, e.word, null, JSON.stringify(['test']), e.score ?? 1]);
  }
  stmt.free();
  return db;
}

const SAMPLE_JA: TestEntry[] = [
  { lang: 'ja', word: 'ごじ', score: 8 },
  { lang: 'ja', word: 'さんじ', score: 8 },
  { lang: 'ja', word: 'じかん', score: 9 },
  { lang: 'ja', word: 'かんじ', score: 9 },
  { lang: 'ja', word: 'ねこ', score: 10 },
  { lang: 'ja', word: 'いぬ', score: 9 },
];

describe('executeWordSplit', () => {
  test('should find ごじ + さんじ from ごんじじさ', async () => {
    const db = await createTestDb(SAMPLE_JA);

    const result = executeWordSplit(db, {
      lang: 'ja',
      query: 'ごんじじさ',
      limit: 50,
    });

    const words = result.pairs.flatMap(([a, b]) => [a.word, b.word]);
    expect(words).toContain('ごじ');
    expect(words).toContain('さんじ');
    db.close();
  });

  test('should find じかん + かんじ from じかんかんじ', async () => {
    const db = await createTestDb(SAMPLE_JA);

    const result = executeWordSplit(db, {
      lang: 'ja',
      query: 'じかんかんじ',
      limit: 50,
    });

    const words = result.pairs.flatMap(([a, b]) => [a.word, b.word]);
    expect(words).toContain('じかん');
    expect(words).toContain('かんじ');
    db.close();
  });

  test('should not return pairs that do not cover exact input chars', async () => {
    const db = await createTestDb(SAMPLE_JA);

    const result = executeWordSplit(db, {
      lang: 'ja',
      query: 'ねこ',
      limit: 50,
    });

    // ねこ を2単語で表せる組み合わせはSAMPLE_JAにない
    for (const [a, b] of result.pairs) {
      const chars = (a.word + b.word).split('').sort().join('');
      const inputChars = 'ねこ'.split('').sort().join('');
      expect(chars).toBe(inputChars);
    }
    db.close();
  });

  test('should not return duplicate pairs (a+b and b+a)', async () => {
    const db = await createTestDb(SAMPLE_JA);

    const result = executeWordSplit(db, {
      lang: 'ja',
      query: 'ごんじじさ',
      limit: 50,
    });

    const seen = new Set<string>();
    for (const [a, b] of result.pairs) {
      const key = [a.id, b.id].sort().join(':');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    db.close();
  });

  test('should filter by lang', async () => {
    const entries: TestEntry[] = [
      { lang: 'en', word: 'sun' },
      { lang: 'en', word: 'set' },
      { lang: 'ja', word: 'さん' },
      { lang: 'ja', word: 'せつ' },
    ];
    const db = await createTestDb(entries);

    const enResult = executeWordSplit(db, {
      lang: 'en',
      query: 'sunset',
      limit: 50,
    });
    const enWords = enResult.pairs.flatMap(([a, b]) => [a.word, b.word]);
    expect(enWords.every((w) => /^[a-z]+$/.test(w))).toBe(true);
    db.close();
  });

  test('should respect limit', async () => {
    const db = await createTestDb(SAMPLE_JA);

    const result = executeWordSplit(db, {
      lang: 'ja',
      query: 'じかんかんじ',
      limit: 1,
    });

    expect(result.pairs.length).toBeLessThanOrEqual(1);
    db.close();
  });

  test('should return pairs as [EntryRow, EntryRow] with all fields', async () => {
    const db = await createTestDb(SAMPLE_JA);

    const result = executeWordSplit(db, {
      lang: 'ja',
      query: 'ごんじじさ',
      limit: 50,
    });

    expect(result.pairs.length).toBeGreaterThan(0);
    const [a, b] = result.pairs[0]!;
    expect(a).toMatchObject({ id: expect.any(Number), lang: 'ja', word: expect.any(String) });
    expect(b).toMatchObject({ id: expect.any(Number), lang: 'ja', word: expect.any(String) });
    db.close();
  });

  test('when query is empty, should throw QUERY_EMPTY', async () => {
    const db = await createTestDb(SAMPLE_JA);
    let error: unknown;

    try {
      executeWordSplit(db, { lang: 'ja', query: '', limit: 50 });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(WorkerError);
    expect((error as WorkerError).code).toBe('QUERY_EMPTY');
    db.close();
  });

  test('when query is too long (>10 chars), should throw WORD_TOO_LONG', async () => {
    const db = await createTestDb(SAMPLE_JA);
    let error: unknown;

    try {
      executeWordSplit(db, { lang: 'ja', query: 'あいうえおかきくけこさ', limit: 50 });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(WorkerError);
    expect((error as WorkerError).code).toBe('WORD_TOO_LONG');
    db.close();
  });
});
