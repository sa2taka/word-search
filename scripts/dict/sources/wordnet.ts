import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { downloadWithCache, extractTarGz } from '../cache';
import type { DictSourcePlugin, EntryInput } from '../types';
import { existsSync } from 'node:fs';

const WORDNET_DICT_URL = 'http://wordnetcode.princeton.edu/wn3.1.dict.tar.gz';

const INDEX_FILES = ['index.noun', 'index.verb', 'index.adj', 'index.adv'] as const;

const POS_MAP: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  a: 'adjective',
  r: 'adverb',
  s: 'adjective', // satellite adjective
};

export const wordnetSource: DictSourcePlugin = {
  id: 'wordnet',

  sourceInfo: {
    name: 'WordNet 3.1',
    license: 'WordNet License (BSD-style)',
    attribution: 'Princeton University "About WordNet." WordNet. Princeton University. 2010.',
    notice_url: 'https://wordnet.princeton.edu/license-and-commercial-use',
  },

  licenseFile: {
    filename: 'WordNet_LICENSE.txt',
    content: `WordNet 3.1 License
====================

WordNet Release 3.1

This software and database is being provided to you, the LICENSEE, by
Princeton University under the following license. By obtaining, using
and/or copying this software and database, you agree that you have
read, understood, and will comply with these terms and conditions:

Permission to use, copy, modify and distribute this software and
database and its documentation for any purpose and without fee or
royalty is hereby granted, provided that you agree to comply with
the following copyright notice and statements, including the disclaimer,
and that the same appear on ALL copies of the software, database and
documentation, including modifications that you make for internal
use or for distribution.

WordNet 3.1 Copyright 2011 by Princeton University. All rights reserved.

THIS SOFTWARE AND DATABASE IS PROVIDED "AS IS" AND PRINCETON
UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR
IMPLIED. BY WAY OF EXAMPLE, BUT NOT LIMITATION, PRINCETON
UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES OF MERCHANT-
ABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE
OF THE LICENSED SOFTWARE, DATABASE OR DOCUMENTATION WILL NOT
INFRINGE ANY THIRD PARTY PATENTS, COPYRIGHTS, TRADEMARKS OR
OTHER RIGHTS.

The name of Princeton University or Princeton may not be used in
advertising or publicity pertaining to distribution of the software
and/or database. Title to copyright in this software, database and
any associated documentation shall at all times remain with
Princeton University and LICENSEE agrees to preserve same.
`,
  },

  async download(cacheDir: string, force?: boolean): Promise<string> {
    const dictDir = join(cacheDir, 'wordnet-dict');

    // Check if already extracted
    if (!force && existsSync(join(dictDir, 'dict', 'index.noun'))) {
      console.log('  Cache hit: WordNet dict files');
      return join(dictDir, 'dict');
    }

    // Download and extract tarball
    const tarPath = await downloadWithCache(
      WORDNET_DICT_URL,
      cacheDir,
      'wn3.1.dict.tar.gz',
      false,
    );
    await extractTarGz(tarPath, dictDir);

    // The tarball extracts to dict/ subdirectory
    const extractedDir = join(dictDir, 'dict');
    if (!existsSync(join(extractedDir, 'index.noun'))) {
      throw new Error(`WordNet extraction failed: index.noun not found in ${extractedDir}`);
    }

    return extractedDir;
  },

  async *parse(dictDir: string): AsyncIterable<EntryInput> {
    const seen = new Set<string>();
    let skippedMultiWord = 0;

    for (const indexFile of INDEX_FILES) {
      const filePath = join(dictDir, indexFile);
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        // Skip comment lines (start with space or empty)
        if (line.startsWith(' ') || line.length === 0) continue;

        const parts = line.split(' ');
        if (parts.length < 2) continue;

        const rawLemma = parts[0]!;
        const posChar = parts[1]!;

        const underscoreCount = rawLemma.split('_').length - 1;
        if (underscoreCount >= 2) {
          skippedMultiWord++;
          continue;
        }

        // 2-word compounds: remove underscore to join (e.g. "ice_cream" → "icecream")
        const lemma = rawLemma.replace(/_/g, '');

        const pos = POS_MAP[posChar];
        if (!pos) continue;

        const key = `${lemma}\t${pos}`;
        if (seen.has(key)) continue;
        seen.add(key);

        yield {
          lang: 'en',
          word: lemma,
          pos,
          source: 'wordnet',
        };
      }
    }

    console.log(`  Parsed ${seen.size.toLocaleString()} WordNet entries (skipped ${skippedMultiWord.toLocaleString()} multi-word)`);
  },
};
