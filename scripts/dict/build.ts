import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { DictMeta } from '../../src/shared/types';
import type { BuildOptions, DictSourcePlugin, EntryInput } from './types';
import { buildDatabase } from './db-builder';
import { jmdictSource } from './sources/jmdict';
import { wordnetSource } from './sources/wordnet';
import { butadictSource } from './sources/butadict';

const ALL_SOURCES: DictSourcePlugin[] = [jmdictSource, butadictSource, wordnetSource];

const RANKING_TSV = 'dist-dict/word-ranking.tsv';

async function loadScores(): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (!existsSync(RANKING_TSV)) {
    console.log('  No ranking file found, all scores default to 1');
    return scores;
  }
  const content = await readFile(RANKING_TSV, 'utf8');
  const lines = content.trim().split('\n').slice(1);
  for (const line of lines) {
    if (!line) continue;
    const parts = line.split('\t');
    // rank, lang, word, bing_count, llm_raw, llm_final, ollama_label, effective_count
    const lang = parts[1];
    const word = parts[2];
    const llmFinal = parseInt(parts[5]!);
    if (lang && word && llmFinal >= 1 && llmFinal <= 10) {
      scores.set(`${lang}\t${word}`, llmFinal);
    }
  }
  console.log(`  Loaded ${scores.size.toLocaleString()} word scores from ${RANKING_TSV}`);
  return scores;
}

function parseCli(): BuildOptions {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      force: { type: 'boolean', default: false },
      'cache-dir': { type: 'string', default: 'tmp/dict-cache' },
    },
    allowPositionals: true,
  });

  return {
    outDir: positionals[0] ?? 'dist-dict',
    cacheDir: values['cache-dir'] as string,
    force: values.force as boolean,
  };
}

async function* chainSources(
  sources: DictSourcePlugin[],
  cacheDir: string,
  force: boolean,
): AsyncIterable<EntryInput> {
  for (const source of sources) {
    console.log(`\n[${source.id}] Downloading...`);
    const path = await source.download(cacheDir, force);

    console.log(`[${source.id}] Parsing...`);
    yield* source.parse(path);
  }
}

async function main() {
  const opts = parseCli();
  const startTime = Date.now();

  console.log('=== Dictionary Build Pipeline ===');
  console.log(`Output: ${resolve(opts.outDir)}`);
  console.log(`Cache:  ${resolve(opts.cacheDir)}`);
  console.log(`Force:  ${opts.force}`);

  await mkdir(opts.outDir, { recursive: true });

  // Build database
  console.log('\n--- Loading word scores ---');
  const scores = await loadScores();

  console.log('\n--- Building SQLite database ---');
  const entries = chainSources(ALL_SOURCES, opts.cacheDir, opts.force);
  const { dbBinary, sha256, entryCount } = await buildDatabase(entries, scores);

  // Write dict.db
  const dbPath = join(opts.outDir, 'dict.db');
  await writeFile(dbPath, dbBinary);
  console.log(`\nWrote: ${dbPath} (${(dbBinary.byteLength / 1024 / 1024).toFixed(1)} MB)`);

  // Generate meta.json
  const meta: DictMeta = {
    version: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    url: '/dict.sqlite',
    sha256,
    bytes: dbBinary.byteLength,
    created_at: new Date().toISOString(),
    schema: 1,
    sources: ALL_SOURCES.map((s) => s.sourceInfo),
  };

  const metaPath = join(opts.outDir, 'meta.json');
  await writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n');
  console.log(`Wrote: ${metaPath}`);

  // Write license files
  console.log('\n--- Writing license files ---');
  for (const source of ALL_SOURCES) {
    const licensePath = join(opts.outDir, source.licenseFile.filename);
    await writeFile(licensePath, source.licenseFile.content);
    console.log(`Wrote: ${licensePath}`);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=== Build Complete ===');
  console.log(`Entries:  ${entryCount.toLocaleString()}`);
  console.log(`DB size:  ${(dbBinary.byteLength / 1024 / 1024).toFixed(1)} MB`);
  console.log(`SHA-256:  ${sha256}`);
  console.log(`Time:     ${elapsed}s`);
}

main().catch((err) => {
  console.error('\nBuild failed:', err);
  process.exit(1);
});
