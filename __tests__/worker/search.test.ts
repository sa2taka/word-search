import { describe, test, expect } from 'vitest';
import type { Database } from 'sql.js';
import type { Lang } from '../../src/shared/types';
import { initSqlite, openDb } from '../../src/worker/db';
import { executeSearch } from '../../src/worker/search';
import { WorkerError } from '../../src/worker/worker-error';

interface TestEntry {
  lang: Lang;
  word: string;
  pos?: string;
  sources?: string[];
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
    'INSERT INTO entries (lang, word, pos, sources) VALUES (?, ?, ?, ?)',
  );
  for (const e of entries) {
    stmt.run([e.lang, e.word, e.pos ?? null, JSON.stringify(e.sources ?? ['test'])]);
  }
  stmt.free();
  return db;
}

const SAMPLE_ENTRIES: TestEntry[] = [
  { lang: 'ja', word: 'たべる', pos: '動詞' },
  { lang: 'ja', word: 'たべもの', pos: '名詞' },
  { lang: 'ja', word: 'はしる', pos: '動詞' },
  { lang: 'en', word: 'eat', pos: 'verb' },
  { lang: 'en', word: 'eating', pos: 'verb' },
  { lang: 'en', word: 'run', pos: 'verb' },
];

describe('executeSearch', () => {
  describe('contains mode', () => {
    test('should match partial text in word', async () => {
      const db = await createTestDb(SAMPLE_ENTRIES);

      const result = executeSearch(db, {
        mode: 'contains',
        lang: 'ja',
        query: 'たべ',
        limit: 50,
        offset: 0,
      });

      expect(result.items.map((i) => i.word)).toEqual(
        expect.arrayContaining(['たべる', 'たべもの']),
      );
      expect(result.items).toHaveLength(2);
      db.close();
    });

    test('should normalize query before searching', async () => {
      const db = await createTestDb(SAMPLE_ENTRIES);

      const result = executeSearch(db, {
        mode: 'contains',
        lang: 'ja',
        query: 'タベ',
        limit: 50,
        offset: 0,
      });

      expect(result.items.map((i) => i.word)).toEqual(
        expect.arrayContaining(['たべる', 'たべもの']),
      );
      expect(result.items).toHaveLength(2);
      db.close();
    });

    test('should escape LIKE special characters', async () => {
      const entries: TestEntry[] = [
        { lang: 'en', word: '100%' },
        { lang: 'en', word: '100' },
        { lang: 'en', word: 'abc' },
      ];
      const db = await createTestDb(entries);

      const result = executeSearch(db, {
        mode: 'contains',
        lang: 'en',
        query: '%',
        limit: 50,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.word).toBe('100%');
      db.close();
    });
  });

  describe('prefix mode', () => {
    test('should match beginning of word', async () => {
      const db = await createTestDb(SAMPLE_ENTRIES);

      const result = executeSearch(db, {
        mode: 'prefix',
        lang: 'en',
        query: 'eat',
        limit: 50,
        offset: 0,
      });

      expect(result.items.map((i) => i.word)).toEqual(
        expect.arrayContaining(['eat', 'eating']),
      );
      expect(result.items).toHaveLength(2);
      db.close();
    });

    test('should match beginning of hiragana word', async () => {
      const db = await createTestDb(SAMPLE_ENTRIES);

      const result = executeSearch(db, {
        mode: 'prefix',
        lang: 'ja',
        query: 'たべ',
        limit: 50,
        offset: 0,
      });

      expect(result.items.map((i) => i.word)).toEqual(
        expect.arrayContaining(['たべる', 'たべもの']),
      );
      expect(result.items).toHaveLength(2);
      db.close();
    });
  });

  describe('regex mode', () => {
    test('should match by regex pattern', async () => {
      const db = await createTestDb(SAMPLE_ENTRIES);

      const result = executeSearch(db, {
        mode: 'regex',
        lang: 'en',
        query: '^eat',
        limit: 50,
        offset: 0,
      });

      expect(result.items.map((i) => i.word)).toEqual(
        expect.arrayContaining(['eat', 'eating']),
      );
      expect(result.items).toHaveLength(2);
      db.close();
    });

    test('should match by regex pattern in word', async () => {
      const db = await createTestDb(SAMPLE_ENTRIES);

      const result = executeSearch(db, {
        mode: 'regex',
        lang: 'ja',
        query: '^はし',
        limit: 50,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.word).toBe('はしる');
      db.close();
    });

    test('when pattern is invalid regex, should throw REGEX_INVALID', async () => {
      const db = await createTestDb(SAMPLE_ENTRIES);
      let error: unknown;

      try {
        executeSearch(db, {
          mode: 'regex',
          lang: 'en',
          query: '[invalid',
          limit: 50,
          offset: 0,
        });
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(WorkerError);
      expect((error as WorkerError).code).toBe('REGEX_INVALID');
      db.close();
    });
  });

  test('should filter by lang', async () => {
    const db = await createTestDb(SAMPLE_ENTRIES);

    const result = executeSearch(db, {
      mode: 'contains',
      lang: 'en',
      query: 'e',
      limit: 50,
      offset: 0,
    });

    expect(result.items.every((i) => i.lang === 'en')).toBe(true);
    db.close();
  });

  test('should respect limit', async () => {
    const db = await createTestDb(SAMPLE_ENTRIES);

    const result = executeSearch(db, {
      mode: 'contains',
      lang: 'en',
      query: 'e',
      limit: 1,
      offset: 0,
    });

    expect(result.items).toHaveLength(1);
    db.close();
  });

  test('should respect offset for paging', async () => {
    const db = await createTestDb(SAMPLE_ENTRIES);

    const page1 = executeSearch(db, {
      mode: 'prefix',
      lang: 'en',
      query: 'eat',
      limit: 1,
      offset: 0,
    });
    const page2 = executeSearch(db, {
      mode: 'prefix',
      lang: 'en',
      query: 'eat',
      limit: 1,
      offset: 1,
    });

    expect(page1.items).toHaveLength(1);
    expect(page2.items).toHaveLength(1);
    expect(page1.items[0]?.word).not.toBe(page2.items[0]?.word);
    db.close();
  });

  test('when offset is 0, should return totalApprox', async () => {
    const db = await createTestDb(SAMPLE_ENTRIES);

    const result = executeSearch(db, {
      mode: 'prefix',
      lang: 'en',
      query: 'eat',
      limit: 1,
      offset: 0,
    });

    expect(result.totalApprox).toBe(2);
    db.close();
  });

  test('when offset > 0, should not return totalApprox', async () => {
    const db = await createTestDb(SAMPLE_ENTRIES);

    const result = executeSearch(db, {
      mode: 'prefix',
      lang: 'en',
      query: 'eat',
      limit: 1,
      offset: 1,
    });

    expect(result.totalApprox).toBeUndefined();
    db.close();
  });

  test('should return EntryRow with all fields', async () => {
    const db = await createTestDb(SAMPLE_ENTRIES);

    const result = executeSearch(db, {
      mode: 'contains',
      lang: 'ja',
      query: 'たべる',
      limit: 50,
      offset: 0,
    });

    expect(result.items[0]).toEqual({
      id: expect.any(Number),
      lang: 'ja',
      word: 'たべる',
      pos: '動詞',
      sources: ['test'],
      score: 1,
    });
    db.close();
  });
});
