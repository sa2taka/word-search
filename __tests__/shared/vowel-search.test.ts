import { describe, test, expect } from 'vitest';
import { toVowelPattern, vowelPatternToRegex, buildVowelSearchRegex } from '../../src/shared/vowel-search';

describe('toVowelPattern', () => {
  test('converts Japanese hiragana to vowel pattern', () => {
    expect(toVowelPattern('なまあし')).toBe('aaai');
    expect(toVowelPattern('わたがし')).toBe('aaai');
    expect(toVowelPattern('ねこ')).toBe('eo');
    expect(toVowelPattern('いぬ')).toBe('iu');
  });

  test('skips ん', () => {
    expect(toVowelPattern('さんじ')).toBe('ai');
    expect(toVowelPattern('あんい')).toBe('ai');
  });

  test('skips っ (does not treat as つ)', () => {
    expect(toVowelPattern('きっと')).toBe('io');
    expect(toVowelPattern('まっか')).toBe('aa');
  });

  test('skips ー', () => {
    expect(toVowelPattern('らーめん')).toBe('ae');
  });

  test('handles katakana input (normalizes to hiragana)', () => {
    expect(toVowelPattern('ネコ')).toBe('eo');
    expect(toVowelPattern('ラーメン')).toBe('ae');
  });

  test('handles small kana (ゃゅょ) as their base vowel', () => {
    expect(toVowelPattern('きゃく')).toBe('iau');
    expect(toVowelPattern('しょく')).toBe('iou');
  });

  test('extracts vowels from English text (consonants skipped)', () => {
    expect(toVowelPattern('running')).toBe('ui');
    expect(toVowelPattern('sunset')).toBe('ue');
    expect(toVowelPattern('apple')).toBe('ae');
  });

  test('returns empty string if no vowels', () => {
    expect(toVowelPattern('ん')).toBe('');
    expect(toVowelPattern('っ')).toBe('');
    expect(toVowelPattern('')).toBe('');
  });

  test('handles mixed hiragana and English (skips non-vowel ASCII)', () => {
    // In practice, mixed input isn't common, but edge case
    expect(toVowelPattern('abc')).toBe('a');
  });
});

describe('vowelPatternToRegex', () => {
  test('returns null for empty pattern', () => {
    expect(vowelPatternToRegex('')).toBeNull();
    expect(vowelPatternToRegex('', 'en')).toBeNull();
  });

  describe('Japanese (lang=ja)', () => {
    test('single vowel builds single-char class', () => {
      const regex = vowelPatternToRegex('a');
      expect(regex).not.toBeNull();
      expect(new RegExp(regex!).test('あ')).toBe(true);
      expect(new RegExp(regex!).test('か')).toBe(true);
      expect(new RegExp(regex!).test('い')).toBe(false);
    });

    test('aaai matches words with that vowel pattern', () => {
      const regex = vowelPatternToRegex('aaai');
      expect(regex).not.toBeNull();
      expect(new RegExp(regex!).test('わたがし')).toBe(true);
      expect(new RegExp(regex!).test('なまあし')).toBe(true);
      expect(new RegExp(regex!).test('たなか')).toBe(false); // aaa, not aaai
      expect(new RegExp(regex!).test('ねこ')).toBe(false);
    });

    test('eo pattern', () => {
      const regex = vowelPatternToRegex('eo');
      expect(regex).not.toBeNull();
      expect(new RegExp(regex!).test('ねこ')).toBe(true);
      expect(new RegExp(regex!).test('せそ')).toBe(true);
      expect(new RegExp(regex!).test('いぬ')).toBe(false);
    });

    test('aaa pattern matches 3-char words with all a-vowels', () => {
      const regex = vowelPatternToRegex('aaa');
      expect(regex).not.toBeNull();
      expect(new RegExp(regex!).test('たなか')).toBe(true);
      expect(new RegExp(regex!).test('さかな')).toBe(true);
      expect(new RegExp(regex!).test('ねこ')).toBe(false); // wrong length
    });

    test('returns null for unknown vowel character', () => {
      expect(vowelPatternToRegex('axe')).toBeNull();
    });
  });

  describe('English (lang=en)', () => {
    test('ui pattern matches words with u then i vowels', () => {
      const regex = vowelPatternToRegex('ui', 'en');
      expect(regex).not.toBeNull();
      expect(new RegExp(regex!).test('running')).toBe(true);  // r-u-nn-i-ng
      expect(new RegExp(regex!).test('ruin')).toBe(true);     // r-u-i-n
      expect(new RegExp(regex!).test('sunset')).toBe(false);  // ue, not ui
    });

    test('ue pattern matches words with u then e vowels', () => {
      const regex = vowelPatternToRegex('ue', 'en');
      expect(regex).not.toBeNull();
      expect(new RegExp(regex!).test('sunset')).toBe(true);
      expect(new RegExp(regex!).test('runner')).toBe(true);
      expect(new RegExp(regex!).test('running')).toBe(false); // ui, not ue
    });

    test('returns null for non-vowel character in pattern', () => {
      expect(vowelPatternToRegex('ux', 'en')).toBeNull();
    });
  });
});

describe('buildVowelSearchRegex', () => {
  test('builds regex from Japanese input (ja lang)', () => {
    const regex = buildVowelSearchRegex('なまあし', 'ja');
    expect(regex).not.toBeNull();
    expect(new RegExp(regex!).test('わたがし')).toBe(true);
    expect(new RegExp(regex!).test('ねこ')).toBe(false);
  });

  test('builds regex from English input (en lang)', () => {
    const regex = buildVowelSearchRegex('running', 'en');
    expect(regex).not.toBeNull();
    expect(new RegExp(regex!).test('ruin')).toBe(true);    // r-u-i-n → ui
    expect(new RegExp(regex!).test('sunset')).toBe(false); // ue, not ui
  });

  test('returns null for no-vowel input', () => {
    expect(buildVowelSearchRegex('ん', 'ja')).toBeNull();
    expect(buildVowelSearchRegex('っっ', 'ja')).toBeNull();
    expect(buildVowelSearchRegex('brn', 'en')).toBeNull();
  });

  test('handles katakana input same as hiragana', () => {
    const hiragana = buildVowelSearchRegex('なまあし', 'ja');
    // ネコ and ねこ should produce the same pattern
    const cat1 = buildVowelSearchRegex('ねこ', 'ja');
    const cat2 = buildVowelSearchRegex('ネコ', 'ja');
    expect(cat1).toBe(cat2);
    expect(hiragana).not.toBeNull();
  });
});
