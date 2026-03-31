/**
 * 小文字かな → 大文字かなのマッピング。
 * クロスワード・パズル検索では小文字かなと大文字かなを同一視する。
 */
const SMALL_KANA_MAP: Record<string, string> = {
  // ひらがな小文字
  'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お',
  'っ': 'つ',
  'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ',
  'ゎ': 'わ',
  'ゕ': 'か', 'ゖ': 'け',
  // カタカナ小文字
  'ァ': 'あ', 'ィ': 'い', 'ゥ': 'う', 'ェ': 'え', 'ォ': 'お',
  'ッ': 'つ',
  'ャ': 'や', 'ュ': 'ゆ', 'ョ': 'よ',
  'ヮ': 'わ',
  'ヵ': 'か', 'ヶ': 'け',
};

/**
 * 検索用のワードノーマライズ。
 * - カタカナ → ひらがな変換
 * - 小文字かな → 大文字かな変換
 */
export function normalizeWord(s: string): string {
  let result = '';
  for (const ch of s) {
    // 小文字かなマッピング（ひらがな・カタカナ両方）
    const mapped = SMALL_KANA_MAP[ch];
    if (mapped) {
      result += mapped;
      continue;
    }
    // カタカナ (U+30A1..U+30F6) → ひらがな (U+3041..U+3096)
    const code = ch.codePointAt(0)!;
    if (code >= 0x30a1 && code <= 0x30f6) {
      result += String.fromCodePoint(code - 0x60);
      continue;
    }
    result += ch;
  }
  return result;
}
