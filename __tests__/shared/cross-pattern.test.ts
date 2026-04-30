import { describe, test, expect } from 'vitest';
import {
  parsePattern,
  buildStrictRegex,
  buildLooseRegex,
  extractVarBindings,
  matchWithBindings,
} from '../../src/shared/cross-pattern';

describe('parsePattern', () => {
  test('digits become var tokens', () => {
    const tokens = parsePattern('112');
    expect(tokens).toEqual([
      { type: 'var', id: '1' },
      { type: 'var', id: '1' },
      { type: 'var', id: '2' },
    ]);
  });

  test('? and ？ become wildcard tokens', () => {
    const tokens = parsePattern('?？');
    expect(tokens).toEqual([
      { type: 'wildcard' },
      { type: 'wildcard' },
    ]);
  });

  test('hiragana becomes literal tokens', () => {
    const tokens = parsePattern('は');
    expect(tokens).toEqual([{ type: 'literal', char: 'は' }]);
  });

  test('katakana is normalized to hiragana literal', () => {
    const tokens = parsePattern('ハ');
    expect(tokens).toEqual([{ type: 'literal', char: 'は' }]);
  });

  test('mixed input は112 produces correct tokens', () => {
    const tokens = parsePattern('は112');
    expect(tokens).toEqual([
      { type: 'literal', char: 'は' },
      { type: 'var', id: '1' },
      { type: 'var', id: '1' },
      { type: 'var', id: '2' },
    ]);
  });

  test('empty string returns empty array', () => {
    expect(parsePattern('')).toEqual([]);
  });
});

describe('buildStrictRegex', () => {
  test('は112 → ^は(.)\\1(.)$', () => {
    const tokens = parsePattern('は112');
    expect(buildStrictRegex(tokens)).toBe('^は(.)\\1(.)$');
  });

  test('repeated var uses backreference', () => {
    const re = buildStrictRegex(parsePattern('112'));
    expect(new RegExp(re).test('いい ろ')).toBe(false);
    expect(new RegExp(re).test('いいろ')).toBe(true);
    expect(new RegExp(re).test('いうろ')).toBe(false);
  });

  test('wildcard matches any char', () => {
    const re = buildStrictRegex(parsePattern('は?'));
    expect(new RegExp(re).test('はい')).toBe(true);
    expect(new RegExp(re).test('はあ')).toBe(true);
    expect(new RegExp(re).test('は')).toBe(false);
  });

  test('only literals → exact match regex', () => {
    const re = buildStrictRegex(parsePattern('ねこ'));
    expect(new RegExp(re).test('ねこ')).toBe(true);
    expect(new RegExp(re).test('ねこい')).toBe(false);
  });

  test('all distinct vars → all capture groups', () => {
    const re = buildStrictRegex(parsePattern('123'));
    expect(new RegExp(re).test('いうえ')).toBe(true);
    expect(new RegExp(re).test('いいえ')).toBe(true); // 1≠2 not required for distinct vars
  });
});

describe('buildLooseRegex', () => {
  test('vars and wildcards become .', () => {
    const re = buildLooseRegex(parsePattern('12がみ'));
    expect(re).toBe('^..がみ$');
  });

  test('loose regex matches any word with correct length and literals', () => {
    const re = new RegExp(buildLooseRegex(parsePattern('12がみ')));
    expect(re.test('いろがみ')).toBe(true);
    expect(re.test('うえがみ')).toBe(true);
    expect(re.test('いろがめ')).toBe(false);
    expect(re.test('いがみ')).toBe(false);
  });
});

describe('extractVarBindings', () => {
  test('extracts correct bindings for はいいろ with tokens は112', () => {
    const tokens = parsePattern('は112');
    const bindings = extractVarBindings('はいいろ', tokens);
    expect(bindings).not.toBeNull();
    expect(bindings!.get('1')).toBe('い');
    expect(bindings!.get('2')).toBe('ろ');
  });

  test('returns null when length does not match', () => {
    const tokens = parsePattern('は112');
    expect(extractVarBindings('はい', tokens)).toBeNull();
  });

  test('returns null when literal does not match', () => {
    const tokens = parsePattern('は112');
    expect(extractVarBindings('ねいいろ', tokens)).toBeNull();
  });

  test('returns null when repeated var has inconsistent chars', () => {
    const tokens = parsePattern('は112');
    expect(extractVarBindings('はいうろ', tokens)).toBeNull();
  });

  test('wildcard does not create binding', () => {
    const tokens = parsePattern('は?2');
    const bindings = extractVarBindings('はいろ', tokens);
    expect(bindings).not.toBeNull();
    expect(bindings!.has('?')).toBe(false);
    expect(bindings!.get('2')).toBe('ろ');
  });
});

describe('matchWithBindings', () => {
  test('matches いろがみ with tokens 12がみ and bindings {1:い, 2:ろ}', () => {
    const tokens = parsePattern('12がみ');
    const bindings = new Map([['1', 'い'], ['2', 'ろ']]);
    expect(matchWithBindings('いろがみ', tokens, bindings)).toBe(true);
  });

  test('rejects word where bound var has wrong char', () => {
    const tokens = parsePattern('12がみ');
    const bindings = new Map([['1', 'い'], ['2', 'ろ']]);
    expect(matchWithBindings('うろがみ', tokens, bindings)).toBe(false);
  });

  test('unbound var acts as wildcard', () => {
    const tokens = parsePattern('12がみ');
    const bindings = new Map<string, string>(); // no bindings
    expect(matchWithBindings('あいがみ', tokens, bindings)).toBe(true);
    expect(matchWithBindings('うえがみ', tokens, bindings)).toBe(true);
  });

  test('rejects when literal does not match', () => {
    const tokens = parsePattern('12がみ');
    const bindings = new Map([['1', 'い'], ['2', 'ろ']]);
    expect(matchWithBindings('いろかみ', tokens, bindings)).toBe(false);
  });

  test('rejects when length does not match', () => {
    const tokens = parsePattern('12がみ');
    const bindings = new Map([['1', 'い'], ['2', 'ろ']]);
    expect(matchWithBindings('いがみ', tokens, bindings)).toBe(false);
  });
});
