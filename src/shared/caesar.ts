import type { Lang } from './types';
import { normalizeWord } from './normalize';

/**
 * ずらしの基準となる文字列。日本語は五十音46文字（清音のみ）、英語は a-z。
 * 末尾までずらすと先頭へ循環する。
 */
const ALPHABET: Record<Lang, string[]> = {
  ja: [...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'],
  en: [...'abcdefghijklmnopqrstuvwxyz'],
};

const INDEX_OF: Record<Lang, Map<string, number>> = {
  ja: new Map(ALPHABET.ja.map((ch, i) => [ch, i])),
  en: new Map(ALPHABET.en.map((ch, i) => [ch, i])),
};

/** 濁音・半濁音・旧仮名 → 五十音46文字に含まれる清音。 */
const SEION_BASE: Record<string, string> = {
  が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ',
  ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ',
  だ: 'た', ぢ: 'ち', づ: 'つ', で: 'て', ど: 'と',
  ば: 'は', び: 'ひ', ぶ: 'ふ', べ: 'へ', ぼ: 'ほ',
  ぱ: 'は', ぴ: 'ひ', ぷ: 'ふ', ぺ: 'へ', ぽ: 'ほ',
  ゔ: 'う',
  ゐ: 'い', ゑ: 'え',
};

/**
 * ずらし比較用の正規化。
 * - 日本語: カタカナ→ひらがな、小文字かな→大文字かな、濁点・半濁点を落として清音へ
 * - 英語: 小文字化
 *
 * 五十音46文字に含まれない文字（ー・記号・漢字など）はそのまま残る。
 */
export function toCipherForm(text: string, lang: Lang): string {
  if (lang === 'en') return text.toLowerCase();

  let result = '';
  for (const ch of normalizeWord(text)) {
    result += SEION_BASE[ch] ?? ch;
  }
  return result;
}

/**
 * 文字列を shift 文字分ずらす。正の値で五十音順の後ろへ、負の値で前へ循環する。
 * 五十音46文字に含まれない文字はずらさずそのまま残す。
 *
 * 例: shiftWord('けいゆ', 3, 'ja') → 'しおり'
 */
export function shiftWord(word: string, shift: number, lang: Lang): string {
  const alphabet = ALPHABET[lang];
  const size = alphabet.length;

  let result = '';
  for (const ch of toCipherForm(word, lang)) {
    const index = INDEX_OF[lang].get(ch);
    result += index == null ? ch : alphabet[(((index + shift) % size) + size) % size]!;
  }
  return result;
}

/**
 * from を何文字ずらすと to になるかを返す。
 * 全文字が同じずらし量でなければ null。濁点・半濁点の違いは無視する。
 *
 * 戻り値は 0 以上 アルファベット長未満。0 は「ずらさずに一致」を意味する。
 */
export function caesarShiftBetween(from: string, to: string, lang: Lang): number | null {
  const size = ALPHABET[lang].length;
  const fromChars = [...toCipherForm(from, lang)];
  const toChars = [...toCipherForm(to, lang)];

  if (fromChars.length === 0 || fromChars.length !== toChars.length) return null;

  let shift: number | null = null;
  for (let i = 0; i < fromChars.length; i++) {
    const fromIndex = INDEX_OF[lang].get(fromChars[i]!);
    const toIndex = INDEX_OF[lang].get(toChars[i]!);

    // ずらせない文字同士は同一文字のみ一致とみなす
    if (fromIndex == null || toIndex == null) {
      if (fromIndex != null || toIndex != null) return null;
      if (fromChars[i] !== toChars[i]) return null;
      continue;
    }

    const diff = (toIndex - fromIndex + size) % size;
    if (shift == null) {
      shift = diff;
    } else if (shift !== diff) {
      return null;
    }
  }

  return shift;
}

/**
 * 0 以上のずらし量を、絶対値が小さくなる符号付きの表現に変換する。
 * 正なら後ろへ、負なら前へずらしたことを表す。
 *
 * 例 (ja): 3 → 3、43 → -3
 */
export function toSignedShift(shift: number, lang: Lang): number {
  const size = ALPHABET[lang].length;
  const wrapped = ((shift % size) + size) % size;
  return wrapped * 2 > size ? wrapped - size : wrapped;
}

/** 入力にずらせる文字が1つでも含まれるか。 */
export function hasShiftableChar(text: string, lang: Lang): boolean {
  for (const ch of toCipherForm(text, lang)) {
    if (INDEX_OF[lang].has(ch)) return true;
  }
  return false;
}
