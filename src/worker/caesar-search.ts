import type { Database } from 'sql.js';
import type { CaesarMatch, EntryRow, Lang } from '../shared/types';
import { WorkerError } from './worker-error';
import {
  caesarShiftBetween,
  hasShiftableChar,
  toCipherForm,
  toSignedShift,
} from '../shared/caesar';

type CandidateEntry = { id: number; word: string };
type ShiftedId = { id: number; shift: number };

function parseCandidateRows(
  result: { columns: string[]; values: unknown[][] }[],
): CandidateEntry[] {
  if (!result[0]) return [];
  const { columns, values } = result[0];
  const idx = Object.fromEntries(columns.map((col, i) => [col, i]));
  return values.map((row) => ({
    id: row[idx['id']!] as number,
    word: row[idx['word']!] as string,
  }));
}

function parseDetailRows(
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

/**
 * ずらし量が小さい順に並べる。同じ絶対値なら後ろ向き（正）を先にする。
 * 同じずらし量の中では候補の取得順（score 降順）が保たれる。
 */
function byShiftDistance(a: ShiftedId, b: ShiftedId): number {
  return Math.abs(a.shift) - Math.abs(b.shift) || b.shift - a.shift;
}

/**
 * 入力語を五十音順（英語は a-z）に n 文字ずらすと別の単語になる組み合わせを検索する。
 * 濁点・半濁点は無視し、末尾までずらすと先頭へ循環する。
 *
 * 例: けいゆ → +3 → しおり
 */
export function executeCaesarSearch(
  db: Database,
  params: {
    lang: Lang;
    query: string;
    limit: number;
  },
): { matches: CaesarMatch[] } {
  const query = params.query.trim();

  if (query === '') {
    throw new WorkerError('QUERY_EMPTY', 'Query must not be empty');
  }

  if (!hasShiftableChar(query, params.lang)) {
    throw new WorkerError('QUERY_EMPTY', 'ずらせる文字が含まれていません');
  }

  const cipher = toCipherForm(query, params.lang);
  const length = [...cipher].length;

  // Phase 1: 同じ長さの単語だけを id と word で取得し、ずらし量を突き合わせる。
  const candidateSql = `SELECT id, word FROM entries WHERE lang = ? AND length(word) = ${length} ORDER BY score DESC, word`;
  const candidates = parseCandidateRows(db.exec(candidateSql, [params.lang]));

  const shifted: ShiftedId[] = [];
  for (const candidate of candidates) {
    const shift = caesarShiftBetween(cipher, candidate.word, params.lang);
    // ずらし量 0 は入力語そのもの（濁点違いを含む）なので除く
    if (shift == null || shift === 0) continue;
    shifted.push({ id: candidate.id, shift: toSignedShift(shift, params.lang) });
  }

  const selected = shifted
    .sort(byShiftDistance)
    .slice(0, Math.trunc(params.limit));

  if (selected.length === 0) {
    return { matches: [] };
  }

  // Phase 2: 採用した id だけ完全な EntryRow を取得する。
  const detailSql = `SELECT id, lang, word, pos, sources, score FROM entries WHERE id IN (${selected.map((s) => s.id).join(',')})`;
  const idToEntry = new Map(
    parseDetailRows(db.exec(detailSql)).map((entry) => [entry.id, entry]),
  );

  const matches = selected
    .map(({ id, shift }) => {
      const entry = idToEntry.get(id);
      return entry ? { shift, entry } : null;
    })
    .filter((match): match is CaesarMatch => match !== null);

  return { matches };
}
