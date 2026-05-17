import type { Database } from 'sql.js';
import type { EntryRow, Lang, SearchMode } from '../shared/types';
import { REGEX_TIMEOUT_MS } from '../shared/constants';
import { WorkerError } from './worker-error';
import { setRegexpDeadline, clearRegexpDeadline } from './regexp-udf';
import { normalizeWord } from '../shared/normalize';
import { buildAnagramKey } from '../shared/anagram';
import { initialTalkToRegex } from '../shared/initial-talk';
import { buildNumberPatternRegex } from '../shared/number-pattern';
import { buildVowelSearchRegex } from '../shared/vowel-search';

const anagramKeySupportCache = new WeakMap<Database, boolean>();

function escapeLike(query: string): string {
  return query.replace(/[%_\\]/g, '\\$&');
}

function buildWhereSql(mode: SearchMode): string {
  switch (mode) {
    case 'anagram':
      return 'lang = ? AND anagram_key = ?';
    case 'regex':
    case 'initial':
    case 'number-pattern':
    case 'vowel':
      return 'lang = ? AND regexp(?, word)';
    case 'wildcard':
    case 'contains':
    case 'prefix':
      return "lang = ? AND word LIKE ? ESCAPE '\\'";
  }
}

/**
 * wildcard モード: ?/？ を SQLite LIKE の _ に変換。
 * 他の LIKE 特殊文字（%, _, \）はエスケープ。
 */
function buildWildcardPattern(query: string): string {
  const normalized = normalizeWord(query);
  let result = '';
  for (const ch of normalized) {
    if (ch === '?' || ch === '？') {
      result += '_';
    } else if (ch === '%' || ch === '_' || ch === '\\') {
      result += '\\' + ch;
    } else {
      result += ch;
    }
  }
  return result;
}

function buildPattern(mode: SearchMode, query: string, lang: Lang = 'ja'): string {
  const normalized = normalizeWord(query);
  switch (mode) {
    case 'anagram':
      return buildAnagramKey(query);
    case 'wildcard':
      return buildWildcardPattern(query);
    case 'contains':
      return `%${escapeLike(normalized)}%`;
    case 'prefix':
      return `${escapeLike(normalized)}%`;
    case 'regex':
      return normalized;
    case 'initial':
      return initialTalkToRegex(query);
    case 'number-pattern':
      return buildNumberPatternRegex(query);
    case 'vowel': {
      const vowelRegex = buildVowelSearchRegex(query, lang);
      if (!vowelRegex) throw new WorkerError('QUERY_EMPTY', '入力から母音が見つかりません');
      return vowelRegex;
    }
  }
}

function hasAnagramKeyColumn(db: Database): boolean {
  const cached = anagramKeySupportCache.get(db);
  if (cached != null) {
    return cached;
  }

  const result = db.exec('PRAGMA table_info(entries)');
  const supported =
    result[0]?.values.some((row) => row[1] === 'anagram_key') ?? false;
  anagramKeySupportCache.set(db, supported);
  return supported;
}

function executeAnagramFallback(
  db: Database,
  params: {
    lang: Lang;
    query: string;
    limit: number;
    offset: number;
  },
): { items: EntryRow[]; totalApprox?: number } {
  const normalized = normalizeWord(params.query);
  const charLength = [...normalized].length;
  const key = buildAnagramKey(params.query);
  const limit = Math.trunc(params.limit);
  const offset = Math.trunc(params.offset);
  const sql = `SELECT id, lang, word, pos, sources, score FROM entries WHERE lang = ? AND length(word) = ${charLength} ORDER BY score DESC, word`;
  const matched = parseRows(db.exec(sql, [params.lang]))
    .filter((item) => buildAnagramKey(item.word) === key);

  return {
    items: matched.slice(offset, offset + limit),
    totalApprox: offset === 0 ? matched.length : undefined,
  };
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
    word: row[idx['word']!] as string,
    pos: (row[idx['pos']!] ?? undefined) as string | undefined,
    sources: JSON.parse(row[idx['sources']!] as string) as string[],
    score: (row[idx['score']!] ?? 1) as number,
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
  if (params.mode === 'anagram' && !hasAnagramKeyColumn(db)) {
    return executeAnagramFallback(db, params);
  }

  const isRegexLike = params.mode === 'regex' || params.mode === 'initial' || params.mode === 'number-pattern' || params.mode === 'vowel';

  if (isRegexLike) {
    const pattern = buildPattern(params.mode, params.query, params.lang);
    try {
      new RegExp(pattern);
    } catch {
      throw new WorkerError(
        'REGEX_INVALID',
        `Invalid regex pattern: ${pattern}`,
      );
    }
    setRegexpDeadline(Date.now() + REGEX_TIMEOUT_MS);
  }

  try {
    const where = buildWhereSql(params.mode);
    const pattern = buildPattern(params.mode, params.query, params.lang);

    const limit = Math.trunc(params.limit);
    const offset = Math.trunc(params.offset);
    const sql = `SELECT id, lang, word, pos, sources, score FROM entries WHERE ${where} ORDER BY score DESC, word LIMIT ${limit} OFFSET ${offset}`;
    const items = parseRows(
      db.exec(sql, [params.lang, pattern]),
    );

    let totalApprox: number | undefined;
    if (params.offset === 0) {
      const countSql = `SELECT COUNT(*) FROM entries WHERE ${where}`;
      const countResult = db.exec(countSql, [params.lang, pattern]);
      totalApprox = countResult[0]?.values[0]?.[0] as number | undefined;
    }

    return { items, totalApprox };
  } finally {
    if (isRegexLike) {
      clearRegexpDeadline();
    }
  }
}
