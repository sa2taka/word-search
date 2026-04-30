import { normalizeWord } from './normalize';

export type PatternToken =
  | { type: 'literal'; char: string }
  | { type: 'var'; id: string }
  | { type: 'wildcard' };

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(s: string): string {
  return s.replace(ESCAPE_RE, '\\$&');
}

/**
 * 数字をパターン変数、?/？をワイルドカード、その他をリテラルとして解析する。
 */
export function parsePattern(input: string): PatternToken[] {
  const tokens: PatternToken[] = [];
  for (const ch of input) {
    if (/[0-9]/.test(ch)) {
      tokens.push({ type: 'var', id: ch });
    } else if (ch === '?' || ch === '？') {
      tokens.push({ type: 'wildcard' });
    } else {
      tokens.push({ type: 'literal', char: normalizeWord(ch) });
    }
  }
  return tokens;
}

/**
 * 繰り返す変数にバックリファレンスを使う厳密な正規表現を構築する。
 * 例: は112 → ^は(.)\1(.)$
 */
export function buildStrictRegex(tokens: PatternToken[]): string {
  let pattern = '^';
  const varGroups = new Map<string, number>();
  let groupCounter = 1;
  for (const token of tokens) {
    if (token.type === 'literal') {
      pattern += escapeRegex(token.char);
    } else if (token.type === 'wildcard') {
      pattern += '.';
    } else {
      if (varGroups.has(token.id)) {
        pattern += `\\${varGroups.get(token.id)}`;
      } else {
        varGroups.set(token.id, groupCounter++);
        pattern += '(.)';
      }
    }
  }
  return pattern + '$';
}

/**
 * 変数・ワイルドカードをすべて `.` に置換した緩い正規表現を構築する。
 * パターン2候補の事前絞り込み用。
 */
export function buildLooseRegex(tokens: PatternToken[]): string {
  let pattern = '^';
  for (const token of tokens) {
    if (token.type === 'literal') {
      pattern += escapeRegex(token.char);
    } else {
      pattern += '.';
    }
  }
  return pattern + '$';
}

/**
 * パターンにマッチした単語から変数バインディングを抽出する。
 * 長さ不一致やリテラル・変数の矛盾がある場合は null を返す。
 */
export function extractVarBindings(
  word: string,
  tokens: PatternToken[],
): Map<string, string> | null {
  const chars = [...word];
  if (chars.length !== tokens.length) return null;
  const bindings = new Map<string, string>();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const ch = chars[i]!;
    if (token.type === 'literal') {
      if (token.char !== ch) return null;
    } else if (token.type === 'var') {
      const existing = bindings.get(token.id);
      if (existing !== undefined) {
        if (existing !== ch) return null;
      } else {
        bindings.set(token.id, ch);
      }
    }
    // wildcard: accept any character
  }
  return bindings;
}

/**
 * 候補単語がパターンと与えられたバインディングに整合するか確認する。
 * バインディングに含まれない変数はワイルドカードとして扱う。
 */
export function matchWithBindings(
  word: string,
  tokens: PatternToken[],
  bindings: Map<string, string>,
): boolean {
  const chars = [...word];
  if (chars.length !== tokens.length) return false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const ch = chars[i]!;
    if (token.type === 'literal') {
      if (token.char !== ch) return false;
    } else if (token.type === 'var') {
      const bound = bindings.get(token.id);
      if (bound !== undefined && bound !== ch) return false;
    }
    // wildcard or unbound var: accept any character
  }
  return true;
}
