import { describe, test, expect } from 'vitest';
import type { Database } from 'sql.js';
import type { Lang } from '../../src/shared/types';
import { initSqlite, openDb } from '../../src/worker/db';
import { executeCaesarSearch } from '../../src/worker/caesar-search';
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
  { lang: 'ja', word: 'けいゆ', score: 8 },
  { lang: 'ja', word: 'しおり', score: 9 }, // けいゆ を +3
  { lang: 'ja', word: 'しおる', score: 6 }, // ずらし量が一定でない
  { lang: 'ja', word: 'ねこ', score: 10 },  // 長さが違う
  { lang: 'ja', word: 'しおりん', score: 5 }, // 長さが違う
];

describe('executeCaesarSearch', () => {
  test('when searching けいゆ, should find しおり as a +3 shift', async () => {
    const db = await createTestDb(SAMPLE_JA);

    const result = executeCaesarSearch(db, { lang: 'ja', query: 'けいゆ', limit: 50 });

    expect(result.matches).toEqual([
      expect.objectContaining({ shift: 3, entry: expect.objectContaining({ word: 'しおり' }) }),
    ]);
    db.close();
  });

  test('when searching しおり, should find けいゆ as a -3 shift', async () => {
    const db = await createTestDb(SAMPLE_JA);

    const result = executeCaesarSearch(db, { lang: 'ja', query: 'しおり', limit: 50 });

    expect(result.matches).toEqual([
      expect.objectContaining({ shift: -3, entry: expect.objectContaining({ word: 'けいゆ' }) }),
    ]);
    db.close();
  });

  test('when the query itself is in the dictionary, should not return it', async () => {
    const db = await createTestDb(SAMPLE_JA);

    const result = executeCaesarSearch(db, { lang: 'ja', query: 'けいゆ', limit: 50 });

    expect(result.matches.map((m) => m.entry.word)).not.toContain('けいゆ');
    db.close();
  });

  test('when the query is katakana, should find the same matches as hiragana', async () => {
    const db = await createTestDb(SAMPLE_JA);

    const result = executeCaesarSearch(db, { lang: 'ja', query: 'ケイユ', limit: 50 });

    expect(result.matches.map((m) => m.entry.word)).toEqual(['しおり']);
    db.close();
  });

  test('when a dictionary word differs only by dakuten, should still match the shift', async () => {
    const db = await createTestDb([
      { lang: 'ja', word: 'けいゆ', score: 8 },
      { lang: 'ja', word: 'じおり', score: 5 },
    ]);

    const result = executeCaesarSearch(db, { lang: 'ja', query: 'けいゆ', limit: 50 });

    expect(result.matches).toEqual([
      expect.objectContaining({ shift: 3, entry: expect.objectContaining({ word: 'じおり' }) }),
    ]);
    db.close();
  });

  test('when the shift wraps past ん, should find the word', async () => {
    const db = await createTestDb([
      { lang: 'ja', word: 'あい', score: 5 },
      { lang: 'ja', word: 'んあ', score: 5 }, // あい を -1 (あ の手前は ん へ循環)
    ]);

    const result = executeCaesarSearch(db, { lang: 'ja', query: 'あい', limit: 50 });

    expect(result.matches).toEqual([
      expect.objectContaining({ shift: -1, entry: expect.objectContaining({ word: 'んあ' }) }),
    ]);
    db.close();
  });

  test('when multiple shifts match, should order them by the smallest shift first', async () => {
    const db = await createTestDb([
      { lang: 'ja', word: 'なつ', score: 9 },
      { lang: 'ja', word: 'しおり', score: 9 },
      { lang: 'ja', word: 'とち', score: 5 }, // なつ を -1
      { lang: 'ja', word: 'にて', score: 4 }, // なつ を +1
      { lang: 'ja', word: 'ぬと', score: 3 }, // なつ を +2
    ]);

    const result = executeCaesarSearch(db, { lang: 'ja', query: 'なつ', limit: 50 });

    expect(result.matches.map((m) => [m.entry.word, m.shift])).toEqual([
      ['にて', 1],
      ['とち', -1],
      ['ぬと', 2],
    ]);
    db.close();
  });

  test('when more matches exist than the limit, should return only the limit', async () => {
    const db = await createTestDb([
      { lang: 'ja', word: 'なつ', score: 9 },
      { lang: 'ja', word: 'にて', score: 4 },
      { lang: 'ja', word: 'ぬと', score: 3 },
    ]);

    const result = executeCaesarSearch(db, { lang: 'ja', query: 'なつ', limit: 1 });

    expect(result.matches.map((m) => m.entry.word)).toEqual(['にて']);
    db.close();
  });

  test('when no shift produces a word, should return no matches', async () => {
    const db = await createTestDb([
      { lang: 'ja', word: 'けいゆ', score: 8 },
      { lang: 'ja', word: 'しおる', score: 6 },
    ]);

    const result = executeCaesarSearch(db, { lang: 'ja', query: 'けいゆ', limit: 50 });

    expect(result.matches).toEqual([]);
    db.close();
  });

  test('when searching english, should find the word shifted through z', async () => {
    const db = await createTestDb([
      { lang: 'en', word: 'zoo', score: 5 },
      { lang: 'en', word: 'app', score: 9 },
      { lang: 'en', word: 'cat', score: 9 },
    ]);

    const result = executeCaesarSearch(db, { lang: 'en', query: 'zoo', limit: 50 });

    expect(result.matches).toEqual([
      expect.objectContaining({ shift: 1, entry: expect.objectContaining({ word: 'app' }) }),
    ]);
    db.close();
  });

  test('when the query is empty, should throw QUERY_EMPTY', async () => {
    const db = await createTestDb(SAMPLE_JA);

    expect(() => executeCaesarSearch(db, { lang: 'ja', query: '   ', limit: 50 })).toThrow(
      WorkerError,
    );
    db.close();
  });

  test('when the query has no shiftable character, should throw QUERY_EMPTY', async () => {
    const db = await createTestDb(SAMPLE_JA);

    try {
      executeCaesarSearch(db, { lang: 'ja', query: '経由', limit: 50 });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkerError);
      expect((error as WorkerError).code).toBe('QUERY_EMPTY');
    }
    db.close();
  });
});
