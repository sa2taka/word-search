import { describe, test, expect } from 'vitest';
import { initialTalkToRegex } from '../../src/shared/initial-talk';

describe('initialTalkToRegex', () => {
  test('single consonant T → ta-row character class anchored', () => {
    expect(initialTalkToRegex('T')).toBe('^[たちつてと]$');
  });

  test('TDN → ta/da/na rows', () => {
    expect(initialTalkToRegex('TDN')).toBe('^[たちつてと][だぢづでど][なにぬねの]$');
  });

  test('lowercase input is treated same as uppercase', () => {
    expect(initialTalkToRegex('tdn')).toBe('^[たちつてと][だぢづでど][なにぬねの]$');
  });

  test('vowel A → wildcard .', () => {
    expect(initialTalkToRegex('A')).toBe('^.$');
  });

  test('all vowels AIUEO → wildcards', () => {
    expect(initialTalkToRegex('AIUEO')).toBe('^.....$');
  });

  test('? → wildcard .', () => {
    expect(initialTalkToRegex('?')).toBe('^.$');
  });

  test('？(fullwidth) → wildcard .', () => {
    expect(initialTalkToRegex('？')).toBe('^.$');
  });

  test('hiragana literal is preserved', () => {
    expect(initialTalkToRegex('は')).toBe('^は$');
  });

  test('katakana is normalized to hiragana', () => {
    expect(initialTalkToRegex('ハ')).toBe('^は$');
  });

  test('mixed: はTD', () => {
    expect(initialTalkToRegex('はTD')).toBe('^は[たちつてと][だぢづでど]$');
  });

  test('all consonant rows are mapped', () => {
    const cases: [string, string][] = [
      ['K', '^[かきくけこ]$'],
      ['G', '^[がぎぐげご]$'],
      ['S', '^[さしすせそ]$'],
      ['Z', '^[ざじずぜぞ]$'],
      ['H', '^[はひふへほ]$'],
      ['B', '^[ばびぶべぼ]$'],
      ['P', '^[ぱぴぷぺぽ]$'],
      ['M', '^[まみむめも]$'],
      ['Y', '^[やゆよ]$'],
      ['R', '^[らりるれろ]$'],
      ['W', '^[わをん]$'],
      ['N', '^[なにぬねの]$'],
    ];
    for (const [input, expected] of cases) {
      expect(initialTalkToRegex(input)).toBe(expected);
    }
  });

  test('empty input → matches empty string only', () => {
    expect(initialTalkToRegex('')).toBe('^$');
  });

  test('regex special chars in literal are escaped', () => {
    const result = initialTalkToRegex('.');
    // '.' not a kana/consonant, should be escaped to '\.'
    expect(result).toBe('^\\.$');
  });
});
