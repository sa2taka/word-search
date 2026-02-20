import { describe, test, expect } from 'vitest';
import type { Database } from 'sql.js';
import type { Lang } from '../shared/types';
import { initSqlite, openDb } from './db';
import { executeSearch } from './search';
import { WorkerError } from './worker-error';

interface TestEntry {
  lang: Lang;
  surface: string;
  reading?: string;
  pos?: string;
}

async function createTestDb(entries: TestEntry[]): Promise<Database> {
  const SQL = await initSqlite();
  const db = openDb(SQL);
  db.run(`
    CREATE TABLE entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lang TEXT NOT NULL,
      surface TEXT NOT NULL,
      reading TEXT,
      pos TEXT
    )
  `);
  const stmt = db.prepare(
    'INSERT INTO entries (lang, surface, reading, pos) VALUES (?, ?, ?, ?)',
  );
  for (const e of entries) {
    stmt.run([e.lang, e.surface, e.reading ?? null, e.pos ?? null]);
  }
  stmt.free();
  return db;
}

const SAMPLE_ENTRIES: TestEntry[] = [
  { lang: 'ja', surface: '食べる', reading: 'たべる', pos: '動詞' },
  { lang: 'ja', surface: '食べ物', reading: 'たべもの', pos: '名詞' },
  { lang: 'ja', surface: '走る', reading: 'はしる', pos: '動詞' },
  { lang: 'en', surface: 'eat', pos: 'verb' },
  { lang: 'en', surface: 'eating', pos: 'verb' },
  { lang: 'en', surface: 'run', pos: 'verb' },
];

describe('executeSearch', () => {
  describe('contains mode', () => {
    test('should match partial text in surface', async () => {
      const db = await createTestDb(SAMPLE_ENTRIES);

      const result = executeSearch(db, {
        mode: 'contains',
        lang: 'ja',
        query: '食べ',
        limit: 50,
        offset: 0,
      });

      expect(result.items.map((i) => i.surface)).toEqual(
        expect.arrayContaining(['食べる', '食べ物']),
      );
      expect(result.items).toHaveLength(2);
      db.close();
    });

    test('should escape LIKE special characters', async () => {
      const entries: TestEntry[] = [
        { lang: 'en', surface: '100%' },
        { lang: 'en', surface: '100' },
        { lang: 'en', surface: 'abc' },
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
      expect(result.items[0]?.surface).toBe('100%');
      db.close();
    });
  });

  describe('prefix mode', () => {
    test('should match beginning of surface', async () => {
      const db = await createTestDb(SAMPLE_ENTRIES);

      const result = executeSearch(db, {
        mode: 'prefix',
        lang: 'en',
        query: 'eat',
        limit: 50,
        offset: 0,
      });

      expect(result.items.map((i) => i.surface)).toEqual(
        expect.arrayContaining(['eat', 'eating']),
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

      expect(result.items.map((i) => i.surface)).toEqual(
        expect.arrayContaining(['eat', 'eating']),
      );
      expect(result.items).toHaveLength(2);
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
    expect(page1.items[0]?.surface).not.toBe(page2.items[0]?.surface);
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
      query: '食べる',
      limit: 50,
      offset: 0,
    });

    expect(result.items[0]).toEqual({
      id: expect.any(Number),
      lang: 'ja',
      surface: '食べる',
      reading: 'たべる',
      pos: '動詞',
    });
    db.close();
  });
});
