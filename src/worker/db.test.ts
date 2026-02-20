import { describe, test, expect } from 'vitest';
import { initSqlite, openDb } from './db';

describe('openDb', () => {
  test('should create database with regexp UDF available in SQL queries', async () => {
    const SQL = await initSqlite();
    const db = openDb(SQL);

    db.run('CREATE TABLE words (surface TEXT)');
    db.run("INSERT INTO words VALUES ('hello'), ('world'), ('help')");

    const result = db.exec(
      "SELECT surface FROM words WHERE surface REGEXP '^hel' ORDER BY surface",
    );

    expect(result[0]?.values).toEqual([['hello'], ['help']]);
    db.close();
  });

  test('when opening with existing data, should load the database', async () => {
    const SQL = await initSqlite();
    const original = openDb(SQL);

    original.run('CREATE TABLE test (id INTEGER, name TEXT)');
    original.run("INSERT INTO test VALUES (1, 'alice'), (2, 'bob')");
    const exported = original.export();
    original.close();

    const restored = openDb(SQL, exported);
    const result = restored.exec('SELECT name FROM test ORDER BY id');

    expect(result[0]?.values).toEqual([['alice'], ['bob']]);
    restored.close();
  });
});
