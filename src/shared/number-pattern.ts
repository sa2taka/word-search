import { normalizeWord } from './normalize';

/**
 * 数字パターン: 同一数字 = 同一文字 として正規表現を生成する。
 *
 * 例:
 *   は112   → ^は(.)\1(.)$       → はいいろ
 *   か111き → ^か(.)\1\1き$      → かたたたき
 *   112323  → ^(.)\1(.)(.)\2\3$  → ききかいかい
 *
 * ルール:
 *   - 数字: 初出 → キャプチャグループ (.)、再出 → 後方参照 \N
 *   - '?' / '？': 任意1文字 (.)
 *   - ひらがな・カタカナ: normalizeWord してリテラル
 *   - その他: regex エスケープしてリテラル
 */
export function buildNumberPatternRegex(input: string): string {
  const groupMap = new Map<string, number>();
  let nextGroup = 1;
  let pattern = '^';

  for (const ch of input) {
    if (ch >= '0' && ch <= '9') {
      if (groupMap.has(ch)) {
        pattern += `\\${groupMap.get(ch)}`;
      } else {
        groupMap.set(ch, nextGroup++);
        pattern += '(.)';
      }
    } else if (ch === '?' || ch === '？') {
      pattern += '.';
    } else {
      const normalized = normalizeWord(ch);
      pattern += normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }

  pattern += '$';
  return pattern;
}
