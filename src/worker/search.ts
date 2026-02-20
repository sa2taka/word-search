import type { Database } from 'sql.js';
import type { EntryRow, Lang, SearchMode } from '../shared/types';
import { REGEX_TIMEOUT_MS } from '../shared/constants';
import { WorkerError } from './worker-error';
import { setRegexpDeadline, clearRegexpDeadline } from './regexp-udf';

function escapeLike(query: string): string {
  return query.replace(/[%_\\]/g, '\\$&');
}

function buildWhereSql(mode: SearchMode): string {
  switch (mode) {
    case 'regex':
      return 'lang = ? AND regexp(?, surface)';
    case 'contains':
    case 'prefix':
      return "lang = ? AND surface LIKE ? ESCAPE '\\'";
  }
}

function buildPattern(mode: SearchMode, query: string): string {
  switch (mode) {
    case 'contains':
      return `%${escapeLike(query)}%`;
    case 'prefix':
      return `${escapeLike(query)}%`;
    case 'regex':
      return query;
  }
}

function parseRows(
  result: { columns: string[]; values: unknown[][] }[],
): EntryRow[] {
  if (!result[0]) return [];

  const { columns, values } = result[0];
  const idx = Object.fromEntries(columns.map((col, i) => [col, i]));

  return values.map((row) => ({
    id: row[idx['id']!] as number,
    lang: row[idx['lang']!] as Lang,
    surface: row[idx['surface']!] as string,
    reading: (row[idx['reading']!] ?? undefined) as string | undefined,
    pos: (row[idx['pos']!] ?? undefined) as string | undefined,
  }));
}

export function executeSearch(
  db: Database,
  params: {
    mode: SearchMode;
    lang: Lang;
    query: string;
    limit: number;
    offset: number;
  },
): { items: EntryRow[]; totalApprox?: number } {
  if (params.mode === 'regex') {
    try {
      new RegExp(params.query);
    } catch {
      throw new WorkerError(
        'REGEX_INVALID',
        `Invalid regex pattern: ${params.query}`,
      );
    }
    setRegexpDeadline(Date.now() + REGEX_TIMEOUT_MS);
  }

  try {
    const where = buildWhereSql(params.mode);
    const pattern = buildPattern(params.mode, params.query);

    const sql = `SELECT id, lang, surface, reading, pos FROM entries WHERE ${where} ORDER BY surface LIMIT ? OFFSET ?`;
    const items = parseRows(
      db.exec(sql, [params.lang, pattern, params.limit, params.offset]),
    );

    let totalApprox: number | undefined;
    if (params.offset === 0) {
      const countSql = `SELECT COUNT(*) FROM entries WHERE ${where}`;
      const countResult = db.exec(countSql, [params.lang, pattern]);
      totalApprox = countResult[0]?.values[0]?.[0] as number | undefined;
    }

    return { items, totalApprox };
  } finally {
    if (params.mode === 'regex') {
      clearRegexpDeadline();
    }
  }
}
