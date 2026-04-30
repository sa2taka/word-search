import { normalizeWord } from './normalize';

/**
 * イニシャルトーク: アルファベット子音をかな行の文字クラスに変換する。
 * 例: T → [たちつてと], NT → ^[なにぬねの][たちつてと]$
 */
const CONSONANT_MAP: Record<string, string> = {
  K: '[かきくけこ]',
  G: '[がぎぐげご]',
  S: '[さしすせそ]',
  Z: '[ざじずぜぞ]',
  T: '[たちつてと]',
  D: '[だぢづでど]',
  N: '[なにぬねの]',
  H: '[はひふへほ]',
  B: '[ばびぶべぼ]',
  P: '[ぱぴぷぺぽ]',
  M: '[まみむめも]',
  Y: '[やゆよ]',
  R: '[らりるれろ]',
  W: '[わをん]',
  // 母音は対応するひらがな
  A: 'あ',
  I: 'い',
  U: 'う',
  E: 'え',
  O: 'お',
};

/**
 * イニシャルトーク入力文字列を正規表現パターンに変換する。
 * - 大文字アルファベット子音: CONSONANT_MAP でかな行文字クラスに変換
 * - 母音 A/I/U/E/O: 任意1文字 (.)
 * - '?' / '？': 任意1文字 (.)
 * - ひらがな・カタカナ: normalizeWord したうえでリテラル
 * - その他: regex エスケープしてリテラル
 */
export function initialTalkToRegex(input: string): string {
  const upper = input.toUpperCase();
  let pattern = '^';
  for (const ch of upper) {
    const mapped = CONSONANT_MAP[ch];
    if (mapped) {
      pattern += mapped;
    } else if (ch === '?' || ch === '？') {
      pattern += '.';
    } else {
      // ひらがな・カタカナ → normalize してリテラルに
      const normalized = normalizeWord(ch);
      pattern += normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  pattern += '$';
  return pattern;
}
