import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { downloadWithCache, extractZip } from '../cache';
import type { DictSourcePlugin, EntryInput } from '../types';
import { normalizeWord } from '../../../src/shared/normalize';

const BUTADICT_URL = 'https://kinosei.cloudfree.jp/butajisho/butah014.zip';
const BUTADICT_ZIP = 'butah014.zip';

export const butadictSource: DictSourcePlugin = {
  id: 'butadict',

  sourceInfo: {
    name: '豚辞書 第14版',
    license: '豚辞書ライセンス（自由利用・帰属表示必須）',
    version: '14',
    attribution: '豚辞書 (butasan / QWC51184) http://www2u.biglobe.ne.jp/~butasan/',
    notice_url: 'https://nankuro.jp/butadict_license.html',
  },

  licenseFile: {
    filename: 'ButaDict_LICENSE.txt',
    content: `豚辞書 第14版 ライセンス
========================

作者: ぶたさん (butasan / QWC51184)
初版: 1994年
最終版: 2001年7月4日（第14版）

辞書データの利用条件:
- 辞書データは自由に利用・引用・改変・変換できます
- 他のツールに組み込む場合は、豚辞書から抜き出し・引用・改変した旨を
  明記してください
- 原版アーカイブはそのままの形での再配布を推奨します
- 異なるメディア形式への変換・再構成は自由です

詳細: https://nankuro.jp/butadict_license.html
再配布元: https://kinosei.cloudfree.jp/2015/02/11/
`,
  },

  async download(cacheDir: string, force?: boolean): Promise<string> {
    const extractDir = join(cacheDir, 'butadict');

    if (!force && existsSync(extractDir) && (await hasTextFiles(extractDir))) {
      console.log('  Cache hit: butadict files');
      return extractDir;
    }

    const zipPath = await downloadWithCache(BUTADICT_URL, cacheDir, BUTADICT_ZIP, force);
    await extractZip(zipPath, extractDir);
    return extractDir;
  },

  async *parse(extractDir: string): AsyncIterable<EntryInput> {
    const files = await findTextFiles(extractDir);
    const seen = new Set<string>();
    let count = 0;

    for (const filePath of files) {
      const buf = await readFile(filePath);
      // 1999年のDOS時代ファイル: Shift_JIS でデコード
      const text = new TextDecoder('shift_jis').decode(buf);
      const lines = text.split(/\r?\n/);

      for (const line of lines) {
        const word = line.trim();
        if (word.length === 0) continue;
        if (seen.has(word)) continue;
        seen.add(word);

        yield { lang: 'ja', word: normalizeWord(word), source: 'butadict' };
        count++;
      }
    }

    console.log(`  Parsed ${count.toLocaleString()} butadict entries`);
  },
};

async function hasTextFiles(dir: string): Promise<boolean> {
  try {
    const files = await findTextFiles(dir);
    return files.length > 0;
  } catch {
    return false;
  }
}

async function findTextFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(d: string) {
    const entries = await readdir(d, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(d, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (
        entry.isFile() &&
        !entry.name.startsWith('.') &&
        !entry.name.toLowerCase().endsWith('.exe') &&
        !entry.name.toLowerCase().endsWith('.doc') &&
        !entry.name.toLowerCase().endsWith('.lzh')
      ) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results.sort();
}
