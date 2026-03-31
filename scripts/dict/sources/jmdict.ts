import { createReadStream, openSync, readSync, closeSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import sax from 'sax';
import { downloadWithCache } from '../cache';
import type { DictSourcePlugin, EntryInput } from '../types';
import { normalizeWord } from '../../../src/shared/normalize';

const JMDICT_URL = 'http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz';
const JMDICT_FILENAME = 'JMdict_e.xml';

/**
 * JMdict POS 展開テキスト → 日本語ラベルへのパターンマッピング。
 * 先にマッチしたルールが優先される。
 */
const POS_RULES: Array<{ test: (s: string) => boolean; label: string }> = [
  { test: (s) => s.includes('proper noun'), label: '固有名詞' },
  { test: (s) => s.includes('pronoun'), label: '代名詞' },
  { test: (s) => s.includes('noun'), label: '名詞' },
  { test: (s) => s.includes('keiyodoshi') || s.includes('quasi-adjective') || s.includes('na-adjective'), label: '形容動詞' },
  { test: (s) => s.includes('keiyoushi') || s.includes("'taru' adjective") || s.includes('adjective (archaic)') || s.includes('auxiliary adjective'), label: '形容詞' },
  { test: (s) => s.includes('pre-noun adjectival') || s.includes('rentaishi'), label: '連体詞' },
  { test: (s) => s.includes('adverb'), label: '副詞' },
  { test: (s) => s.includes('auxiliary verb') || s === 'auxiliary', label: '助動詞' },
  { test: (s) => s.includes('copula'), label: '助動詞' },
  { test: (s) => s.includes('verb'), label: '動詞' },
  { test: (s) => s.includes('conjunction'), label: '接続詞' },
  { test: (s) => s.includes('interjection'), label: '感動詞' },
  { test: (s) => s.includes('particle'), label: '助詞' },
  { test: (s) => s.includes('prefix'), label: '接頭辞' },
  { test: (s) => s.includes('suffix'), label: '接尾辞' },
  { test: (s) => s.includes('counter'), label: '助数詞' },
  { test: (s) => s.includes('expressions'), label: '表現' },
  { test: (s) => s.includes('numeric'), label: '数詞' },
  { test: (s) => s.includes('unclassified'), label: '未分類' },
];

function mapPos(rawPos: string): string {
  for (const rule of POS_RULES) {
    if (rule.test(rawPos)) return rule.label;
  }
  return rawPos;
}

interface JMdictEntry {
  kebs: string[];
  rebs: Array<{ value: string; restr: string[] }>;
  pos: string[];
}

/**
 * JMdict XML の DOCTYPE から entity 定義を抽出する。
 * 例: <!ENTITY n "noun (common) (futsuumeishi)"> → { n: "noun (common) (futsuumeishi)" }
 */
async function extractEntities(xmlPath: string): Promise<Record<string, string>> {
  // DOCTYPE は先頭 ~30KB に収まる
  const buf = Buffer.alloc(64 * 1024);
  const fd = openSync(xmlPath, 'r');
  const bytesRead = readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);

  const header = buf.toString('utf-8', 0, bytesRead);
  const entities: Record<string, string> = {};
  const re = /<!ENTITY\s+([\w.-]+)\s+"([^"]*)">/g;
  let match;
  while ((match = re.exec(header)) !== null) {
    entities[match[1]!] = match[2]!;
  }

  // DOCTYPE が 64KB に収まらない場合、全文から抽出
  if (Object.keys(entities).length === 0) {
    const full = await readFile(xmlPath, 'utf-8');
    const endDoctype = full.indexOf(']>');
    if (endDoctype > 0) {
      const dtd = full.slice(0, endDoctype);
      const re2 = /<!ENTITY\s+([\w.-]+)\s+"([^"]*)">/g;
      while ((match = re2.exec(dtd)) !== null) {
        entities[match[1]!] = match[2]!;
      }
    }
  }

  return entities;
}

export const jmdictSource: DictSourcePlugin = {
  id: 'jmdict',

  sourceInfo: {
    name: 'JMdict',
    license: 'CC BY-SA 4.0',
    attribution: 'This publication has included material from the JMdict (EDICT, etc.) dictionary files in accordance with the licence provisions of the Electronic Dictionaries Research Group. See http://www.edrdg.org/',
    notice_url: 'https://www.edrdg.org/edrdg/licence.html',
  },

  licenseFile: {
    filename: 'JMdict_LICENSE.txt',
    content: `JMdict License
==============

The original data in the JMdict files is the property of the
Electronic Dictionary Research and Development Group (EDRDG),
and is used in conformance with the Group's licence.

License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
https://creativecommons.org/licenses/by-sa/4.0/

The full licence statement can be found at:
https://www.edrdg.org/edrdg/licence.html

Attribution:
This publication has included material from the JMdict (EDICT, etc.)
dictionary files in accordance with the licence provisions of the
Electronic Dictionaries Research Group.
See http://www.edrdg.org/
`,
  },

  async download(cacheDir: string, force?: boolean): Promise<string> {
    return downloadWithCache(JMDICT_URL, cacheDir, JMDICT_FILENAME, force);
  },

  async *parse(xmlPath: string): AsyncIterable<EntryInput> {
    const entityMap = await extractEntities(xmlPath);
    console.log(`  Loaded ${Object.keys(entityMap).length} entity definitions from DOCTYPE`);

    const entries = await parseJMdictXml(xmlPath, entityMap);
    for (const entry of entries) {
      yield* expandEntry(entry);
    }
  },
};

function expandEntry(entry: JMdictEntry): EntryInput[] {
  const pos = entry.pos.length > 0 ? mapPos(entry.pos[0]!) : undefined;
  const results: EntryInput[] = [];
  const seen = new Set<string>();

  // reading（ひらがな）をノーマライズして word とする
  // 1エントリに複数 reading がある場合、それぞれ別のエントリとして出力
  for (const reb of entry.rebs) {
    const word = normalizeWord(reb.value);
    if (seen.has(word)) continue;
    seen.add(word);
    results.push({ lang: 'ja', word, pos, source: 'jmdict' });
  }

  return results;
}

function parseJMdictXml(xmlPath: string, entityMap: Record<string, string>): Promise<JMdictEntry[]> {
  return new Promise((resolve, reject) => {
    const saxStream = sax.createStream(false, {
      trim: true,
      lowercase: true,
    });

    // JMdict entity を sax の内部 entity マップに登録し、
    // HTML entity（&int; → ∫ 等）との衝突を防ぐ
    const internalParser = saxStream as unknown as { _parser: { ENTITIES: Record<string, string> } };
    Object.assign(internalParser._parser.ENTITIES, entityMap);

    const entries: JMdictEntry[] = [];
    let current: JMdictEntry | null = null;
    let textBuf = '';
    let inFirstSense = false;
    let senseCount = 0;

    // reb の re_restr 用
    let currentRestr: string[] = [];
    let currentReb = '';

    saxStream.on('opentag', (node) => {
      textBuf = '';

      switch (node.name) {
        case 'entry':
          current = { kebs: [], rebs: [], pos: [] };
          senseCount = 0;
          inFirstSense = false;
          break;
        case 'r_ele':
          currentReb = '';
          currentRestr = [];
          break;
        case 'sense':
          senseCount++;
          inFirstSense = senseCount === 1;
          break;
      }
    });

    saxStream.on('text', (text) => {
      textBuf += text;
    });

    saxStream.on('closetag', (name) => {
      if (!current) return;

      switch (name) {
        case 'keb':
          current.kebs.push(textBuf);
          break;
        case 'reb':
          currentReb = textBuf;
          break;
        case 're_restr':
          currentRestr.push(textBuf);
          break;
        case 'r_ele':
          if (currentReb) {
            current.rebs.push({ value: currentReb, restr: currentRestr });
          }
          break;
        case 'pos':
          if (inFirstSense) {
            current.pos.push(textBuf);
          }
          break;
        case 'entry':
          entries.push(current);
          current = null;
          break;
      }

      textBuf = '';
    });

    saxStream.on('end', () => {
      console.log(`  Parsed ${entries.length.toLocaleString()} JMdict entries`);
      resolve(entries);
    });

    saxStream.on('error', (err) => {
      reject(new Error(`JMdict XML parse error: ${err.message}`));
    });

    const stream = createReadStream(xmlPath, { encoding: 'utf-8' });
    stream.pipe(saxStream);
  });
}
