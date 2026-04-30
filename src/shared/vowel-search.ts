import type { Lang } from './types';
import { normalizeWord } from './normalize';

/**
 * 各ひらがな → 母音 (a/i/u/e/o) のマッピング。
 * ん・っ・ー は母音なしのため含めない (スキップ扱い)。
 * normalizeWord により小文字かな→大文字かな変換後に参照されるため、
 * や・ゆ・よ を含む。
 */
const HIRAGANA_VOWEL: Record<string, 'a' | 'i' | 'u' | 'e' | 'o'> = {
  // a段
  あ: 'a', か: 'a', さ: 'a', た: 'a', な: 'a', は: 'a', ま: 'a', ら: 'a', わ: 'a', や: 'a',
  が: 'a', ざ: 'a', だ: 'a', ば: 'a', ぱ: 'a',
  ぁ: 'a', ゃ: 'a',
  // i段
  い: 'i', き: 'i', し: 'i', ち: 'i', に: 'i', ひ: 'i', み: 'i', り: 'i', ゐ: 'i',
  ぎ: 'i', じ: 'i', ぢ: 'i', び: 'i', ぴ: 'i',
  ぃ: 'i',
  // u段
  う: 'u', く: 'u', す: 'u', つ: 'u', ぬ: 'u', ふ: 'u', む: 'u', ゆ: 'u', る: 'u',
  ぐ: 'u', ず: 'u', づ: 'u', ぶ: 'u', ぷ: 'u', ゔ: 'u',
  ぅ: 'u', ゅ: 'u',
  // e段
  え: 'e', け: 'e', せ: 'e', て: 'e', ね: 'e', へ: 'e', め: 'e', れ: 'e', ゑ: 'e',
  げ: 'e', ぜ: 'e', で: 'e', べ: 'e', ぺ: 'e',
  ぇ: 'e',
  // o段
  お: 'o', こ: 'o', そ: 'o', と: 'o', の: 'o', ほ: 'o', も: 'o', よ: 'o', ろ: 'o', を: 'o',
  ご: 'o', ぞ: 'o', ど: 'o', ぼ: 'o', ぽ: 'o',
  ぉ: 'o', ょ: 'o',
};

/**
 * 母音 → その母音を持つひらがな全文字のregex文字クラス。
 * DBワードとのマッチングに使用。小文字かな・大文字かな両方を含む。
 */
const VOWEL_HIRAGANA_CLASS: Record<string, string> = {
  a: '[あかさたなはまらわやがざだばぱぁゃ]',
  i: '[いきしちにひみりゐぎじぢびぴぃ]',
  u: '[うくすつぬふむゆるぐずづぶぷゔぅゅ]',
  e: '[えけせてねへめれゑげぜでべぺぇ]',
  o: '[おこそとのほもよろをごぞどぼぽぉょ]',
};

const ENGLISH_VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** ん・っ・ー など、独立した母音を持たない文字。カタカナ版も含む。 */
const SKIP_CHARS = new Set(['ん', 'ン', 'っ', 'ッ', 'ー']);

/**
 * テキストから母音パターン文字列を生成する。
 *
 * - ひらがな/カタカナ: 1文字ずつ正規化し HIRAGANA_VOWEL で母音を取得
 * - 英字: a/e/i/o/u のみ抽出 (子音はスキップ)
 * - ん・っ・ー 等: スキップ
 *
 * 例: 'なまあし' → 'aaai'
 *     'running' → 'ui'
 */
export function toVowelPattern(text: string): string {
  let pattern = '';
  for (const ch of text) {
    if (SKIP_CHARS.has(ch)) continue;
    // 1文字ずつ normalize (カタカナ → ひらがな、小文字かな → 大文字かな)
    const norm = normalizeWord(ch);
    const v = HIRAGANA_VOWEL[norm] ?? HIRAGANA_VOWEL[ch];
    if (v) {
      pattern += v;
    } else if (ENGLISH_VOWELS.has(ch.toLowerCase())) {
      pattern += ch.toLowerCase();
    }
    // それ以外 (漢字・記号・子音等) はスキップ
  }
  return pattern;
}

/**
 * 母音パターンを SQLite regexp UDF 用の正規表現に変換する。
 *
 * - lang='ja': 各母音をひらがな文字クラスに展開 (位置固定)
 * - lang='en': 各母音の前後に子音群 [^aeiou]* を許容
 *
 * 例 (ja): 'aaai' → '^[あかさ...][あかさ...][あかさ...][いきし...]$'
 * 例 (en): 'ui'   → '^[^aeiou]*u[^aeiou]*i[^aeiou]*$'
 *
 * 母音パターンが空の場合は null を返す。
 */
export function vowelPatternToRegex(vowelPattern: string, lang: Lang = 'ja'): string | null {
  if (vowelPattern.length === 0) return null;

  if (lang === 'ja') {
    let regex = '^';
    for (const v of vowelPattern) {
      const cls = VOWEL_HIRAGANA_CLASS[v];
      if (!cls) return null;
      regex += cls;
    }
    regex += '$';
    return regex;
  } else {
    let regex = '^[^aeiou]*';
    for (const v of vowelPattern) {
      if (!ENGLISH_VOWELS.has(v)) return null;
      regex += `${v}[^aeiou]*`;
    }
    regex += '$';
    return regex;
  }
}

/**
 * 入力テキストから母音検索用の正規表現パターンを生成する。
 * 入力に母音が含まれない場合は null を返す。
 */
export function buildVowelSearchRegex(input: string, lang: Lang = 'ja'): string | null {
  const vowelPattern = toVowelPattern(input);
  return vowelPatternToRegex(vowelPattern, lang);
}
