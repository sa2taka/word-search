import { describe, test, expect } from 'vitest';
import {
  toCipherForm,
  shiftWord,
  caesarShiftBetween,
  toSignedShift,
  hasShiftableChar,
} from '../../src/shared/caesar';

describe('toCipherForm', () => {
  test('when input is katakana, should convert to hiragana', () => {
    expect(toCipherForm('ケイユ', 'ja')).toBe('けいゆ');
  });

  test('when input has dakuten, should strip it to seion', () => {
    expect(toCipherForm('がっこう', 'ja')).toBe('かつこう');
  });

  test('when input has handakuten, should strip it to seion', () => {
    expect(toCipherForm('ぱんだ', 'ja')).toBe('はんた');
  });

  test('when input is english uppercase, should lowercase it', () => {
    expect(toCipherForm('Cat', 'en')).toBe('cat');
  });
});

describe('shiftWord', () => {
  test('when shifting けいゆ by +3, should become しおり', () => {
    expect(shiftWord('けいゆ', 3, 'ja')).toBe('しおり');
  });

  test('when shifting しおり by -3, should become けいゆ', () => {
    expect(shiftWord('しおり', -3, 'ja')).toBe('けいゆ');
  });

  test('when shifting ん forward past the end, should wrap around to あ', () => {
    expect(shiftWord('ん', 1, 'ja')).toBe('あ');
  });

  test('when shifting あ backward past the start, should wrap around to ん', () => {
    expect(shiftWord('あ', -1, 'ja')).toBe('ん');
  });

  test('when shifting by a whole alphabet, should return the same reading', () => {
    expect(shiftWord('けいゆ', 46, 'ja')).toBe('けいゆ');
  });

  test('when input is katakana, should shift its hiragana reading', () => {
    expect(shiftWord('ケイユ', 3, 'ja')).toBe('しおり');
  });

  test('when input has dakuten, should shift the seion base', () => {
    expect(shiftWord('がっこう', 1, 'ja')).toBe('きてさえ');
  });

  test('when input has a long vowel mark, should leave it in place', () => {
    expect(shiftWord('けーき', 1, 'ja')).toBe('こーく');
  });

  test('when shifting english z forward, should wrap around to a', () => {
    expect(shiftWord('zoo', 1, 'en')).toBe('app');
  });

  test('when shifting english a backward, should wrap around to z', () => {
    expect(shiftWord('abc', -1, 'en')).toBe('zab');
  });
});

describe('caesarShiftBetween', () => {
  test('when けいゆ becomes しおり, should return 3', () => {
    expect(caesarShiftBetween('けいゆ', 'しおり', 'ja')).toBe(3);
  });

  test('when しおり becomes けいゆ, should return the backward shift as a wrapped value', () => {
    expect(caesarShiftBetween('しおり', 'けいゆ', 'ja')).toBe(43);
  });

  test('when the two words are identical, should return 0', () => {
    expect(caesarShiftBetween('ねこ', 'ねこ', 'ja')).toBe(0);
  });

  test('when the shift differs per character, should return null', () => {
    expect(caesarShiftBetween('けいゆ', 'しおる', 'ja')).toBeNull();
  });

  test('when the lengths differ, should return null', () => {
    expect(caesarShiftBetween('けいゆ', 'しおりん', 'ja')).toBeNull();
  });

  test('when either word is empty, should return null', () => {
    expect(caesarShiftBetween('', '', 'ja')).toBeNull();
  });

  test('when the target has dakuten, should ignore it and return the shift', () => {
    expect(caesarShiftBetween('けいゆ', 'じおり', 'ja')).toBe(3);
  });

  test('when a non shiftable character sits at the same position, should keep the shift', () => {
    expect(caesarShiftBetween('けーき', 'こーく', 'ja')).toBe(1);
  });

  test('when a non shiftable character faces a shiftable one, should return null', () => {
    expect(caesarShiftBetween('けーき', 'こあく', 'ja')).toBeNull();
  });

  test('when english words differ by a wrapping shift, should return the shift', () => {
    expect(caesarShiftBetween('zoo', 'app', 'en')).toBe(1);
  });
});

describe('toSignedShift', () => {
  test('when the shift is in the first half, should keep it positive', () => {
    expect(toSignedShift(3, 'ja')).toBe(3);
    expect(toSignedShift(23, 'ja')).toBe(23);
  });

  test('when the shift is in the second half, should express it as a backward shift', () => {
    expect(toSignedShift(43, 'ja')).toBe(-3);
    expect(toSignedShift(24, 'ja')).toBe(-22);
  });

  test('when the shift is in the second half of the english alphabet, should express it as backward', () => {
    expect(toSignedShift(25, 'en')).toBe(-1);
    expect(toSignedShift(13, 'en')).toBe(13);
    expect(toSignedShift(14, 'en')).toBe(-12);
  });
});

describe('hasShiftableChar', () => {
  test('when input contains kana, should return true', () => {
    expect(hasShiftableChar('けいゆ', 'ja')).toBe(true);
  });

  test('when input contains only kanji, should return false', () => {
    expect(hasShiftableChar('経由', 'ja')).toBe(false);
  });

  test('when input contains only a long vowel mark, should return false', () => {
    expect(hasShiftableChar('ーー', 'ja')).toBe(false);
  });
});
