import { describe, test, expect } from 'vitest';
import type { Database } from 'sql.js';
import type { Lang } from '../../src/shared/types';
import { initSqlite, openDb } from '../../src/worker/db';
import { executeCrossSearch } from '../../src/worker/cross-search';
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
  { lang: 'ja', word: 'はいいろ', score: 8 }, // は+い+い+ろ → matches は112 with 1=い, 2=ろ
  { lang: 'ja', word: 'いろがみ', score: 8 }, // い+ろ+が+み → matches 12がみ with 1=い, 2=ろ
  { lang: 'ja', word: 'ねこ', score: 10 },
  { lang: 'ja', word: 'いぬ', score: 9 },
];

describe('executeCrossSearch', () => {
  test('should find (はいいろ, いろがみ) from は112 + 12がみ', async () => {
    const db = await createTestDb(SAMPLE_JA);

    const result = executeCrossSearch(db, {
      lang: 'ja',
      query1: 'は112',
      query2: '12がみ',
      limit: 50,
    });

    expect(result.pairs.length).toBeGreaterThan(0);
    const words1 = result.pairs.map(([a]) => a.word);
    const words2 = result.pairs.map(([, b]) => b.word);
    expect(words1).toContain('はいいろ');
    expect(words2).toContain('いろがみ');
    db.close();
  });

  test('should not find pair when variables do not match', async () => {
    const entries: TestEntry[] = [
      { lang: 'ja', word: 'はいいろ', score: 8 }, // 1=い, 2=ろ
      { lang: 'ja', word: 'うえがみ', score: 7 }, // 1=う, 2=え → 1≠い
    ];
    const db = await createTestDb(entries);

    const result = executeCrossSearch(db, {
      lang: 'ja',
      query1: 'は112',
      query2: '12がみ',
      limit: 50,
    });

    expect(result.pairs.length).toBe(0);
    db.close();
  });

  test('should filter by lang', async () => {
    const entries: TestEntry[] = [
      { lang: 'ja', word: 'はいいろ', score: 8 },
      { lang: 'ja', word: 'いろがみ', score: 8 },
      { lang: 'en', word: 'hairo', score: 5 },
    ];
    const db = await createTestDb(entries);

    const result = executeCrossSearch(db, {
      lang: 'ja',
      query1: 'は112',
      query2: '12がみ',
      limit: 50,
    });

    for (const [a, b] of result.pairs) {
      expect(a.lang).toBe('ja');
      expect(b.lang).toBe('ja');
    }
    db.close();
  });

  test('should respect limit', async () => {
    const entries: TestEntry[] = [
      { lang: 'ja', word: 'はいいろ', score: 8 },
      { lang: 'ja', word: 'いろがみ', score: 8 },
      { lang: 'ja', word: 'はああろ', score: 7 }, // も は112 型: 1=あ, 2=ろ
      { lang: 'ja', word: 'あろがみ', score: 6 }, // 1=あ, 2=ろ → matches 12がみ
    ];
    const db = await createTestDb(entries);

    const result = executeCrossSearch(db, {
      lang: 'ja',
      query1: 'は112',
      query2: '12がみ',
      limit: 1,
    });

    expect(result.pairs.length).toBeLessThanOrEqual(1);
    db.close();
  });

  test('should return pairs as [EntryRow, EntryRow] with all fields', async () => {
    const db = await createTestDb(SAMPLE_JA);

    const result = executeCrossSearch(db, {
      lang: 'ja',
      query1: 'は112',
      query2: '12がみ',
      limit: 50,
    });

    expect(result.pairs.length).toBeGreaterThan(0);
    const [a, b] = result.pairs[0]!;
    expect(a).toMatchObject({ id: expect.any(Number), lang: 'ja', word: expect.any(String) });
    expect(b).toMatchObject({ id: expect.any(Number), lang: 'ja', word: expect.any(String) });
    db.close();
  });

  test('when query1 is empty, should throw QUERY_EMPTY', async () => {
    const db = await createTestDb(SAMPLE_JA);
    let error: unknown;

    try {
      executeCrossSearch(db, { lang: 'ja', query1: '', query2: '12がみ', limit: 50 });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(WorkerError);
    expect((error as WorkerError).code).toBe('QUERY_EMPTY');
    db.close();
  });

  test('when query2 is empty, should throw QUERY_EMPTY', async () => {
    const db = await createTestDb(SAMPLE_JA);
    let error: unknown;

    try {
      executeCrossSearch(db, { lang: 'ja', query1: 'は112', query2: '', limit: 50 });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(WorkerError);
    expect((error as WorkerError).code).toBe('QUERY_EMPTY');
    db.close();
  });

  test('when no matching pairs exist, should return empty pairs', async () => {
    const db = await createTestDb([{ lang: 'ja', word: 'ねこ' }]);

    const result = executeCrossSearch(db, {
      lang: 'ja',
      query1: 'は112',
      query2: '12がみ',
      limit: 50,
    });

    expect(result.pairs).toEqual([]);
    db.close();
  });
});
