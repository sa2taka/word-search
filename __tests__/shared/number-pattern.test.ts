import { describe, test, expect } from 'vitest';
import { buildNumberPatternRegex } from '../../src/shared/number-pattern';

describe('buildNumberPatternRegex', () => {
  test('single digit → capture group anchored', () => {
    expect(buildNumberPatternRegex('1')).toBe('^(.)$');
  });

  test('two same digits → capture + backreference', () => {
    expect(buildNumberPatternRegex('11')).toBe('^(.)\\1$');
  });

  test('は112 → ^は(.)\\1(.)$', () => {
    expect(buildNumberPatternRegex('は112')).toBe('^は(.)\\1(.)$');
  });

  test('か111き → ^か(.)\\1\\1き$', () => {
    expect(buildNumberPatternRegex('か111き')).toBe('^か(.)\\1\\1き$');
  });

  test('112323 → ^(.)\\1(.)(.)\\.2\\.3$', () => {
    // 1→group1, 1→\1, 2→group2, 3→group3, 2→\2, 3→\3
    expect(buildNumberPatternRegex('112323')).toBe('^(.)\\1(.)(.)\\2\\3$');
  });

  test('all different digits → all capture groups', () => {
    expect(buildNumberPatternRegex('123')).toBe('^(.)(.)(.)$');
  });

  test('? → wildcard .', () => {
    expect(buildNumberPatternRegex('?')).toBe('^.$');
  });

  test('？(fullwidth) → wildcard .', () => {
    expect(buildNumberPatternRegex('？')).toBe('^.$');
  });

  test('katakana literal is normalized to hiragana', () => {
    expect(buildNumberPatternRegex('ネコ')).toBe('^ねこ$');
  });

  test('literal hiragana is preserved', () => {
    expect(buildNumberPatternRegex('あ1')).toBe('^あ(.)$');
  });

  test('empty input → matches empty string only', () => {
    expect(buildNumberPatternRegex('')).toBe('^$');
  });

  test('generated regex actually matches expected word', () => {
    // は112 should match はいいろ
    const pattern = buildNumberPatternRegex('は112');
    const re = new RegExp(pattern);
    expect(re.test('はいいろ')).toBe(true);
    expect(re.test('はにいろ')).toBe(false); // position 2,3 differ (に≠い)
    expect(re.test('はいうえ')).toBe(false); // position 2,3 differ (い≠う)
  });

  test('112323 regex matches ききかいかい', () => {
    const pattern = buildNumberPatternRegex('112323');
    const re = new RegExp(pattern);
    expect(re.test('ききかいかい')).toBe(true);
    expect(re.test('あいうえおか')).toBe(false);
  });
});
