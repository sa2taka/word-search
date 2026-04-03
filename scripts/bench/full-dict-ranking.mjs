/**
 * Full dictionary Bing hit-count scraper + Ollama LLM imputation.
 *
 * Phase 1: Extract all words from dict.db
 * Phase 2: Scrape Bing for hit counts (high concurrency)
 * Phase 3: Save results as TSV
 * Phase 4: Use Ollama to classify words that have no Bing count
 * Phase 5: Append LLM labels to TSV
 *
 * Usage:
 *   node scripts/bench/full-dict-ranking.mjs [--lang ja|en|all] [--concurrency 50] [--ollama-model qwen3:8b]
 *
 * Output: dist-dict/word-scores.tsv
 */

import { performance } from 'node:perf_hooks';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

// ---------- Args ----------

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const LANG = getArg('lang', 'all');
const BING_CONCURRENCY = parseInt(getArg('concurrency', '50'), 10);
const OLLAMA_MODEL = getArg('ollama-model', 'qwen3:8b');
const DB_PATH = getArg('db', 'dist-dict/dict.db');
const OUTPUT_PATH = getArg('output', 'dist-dict/word-scores.tsv');
const OLLAMA_CHUNK_SIZE = 50;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ---------- Phase 1: Extract words ----------

async function loadWords() {
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync(DB_PATH));
  const langFilter = LANG === 'all' ? '' : ` WHERE lang = '${LANG}'`;
  const rows = db.exec(`SELECT DISTINCT lang, word FROM entries${langFilter} ORDER BY lang, word`);
  db.close();
  if (!rows.length) return [];
  return rows[0].values.map(([lang, word]) => ({ lang, word }));
}

// ---------- Phase 2: Bing scraping ----------

function parseBingCount(html) {
  const m = html.match(/sb_count[^>]*>([^<]+)/);
  if (!m) return undefined;
  const n = m[1].replace(/[,\s約件の結果resultsa-zA-Z]/g, '').match(/(\d+)/);
  return n ? parseInt(n[1], 10) : undefined;
}

async function fetchBingCount(word, lang) {
  const langHint = lang === 'ja' ? '日本語 単語' : 'english word';
  const query = `"${word}" ${langHint}`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=${lang}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': lang === 'ja' ? 'ja,en;q=0.9' : 'en,ja;q=0.5' },
  });
  if (!res.ok) return undefined;
  const html = await res.text();
  return parseBingCount(html);
}

async function scrapeBingAll(entries, tsvPath) {
  const { appendFileSync: append } = await import('node:fs');
  // Write header (overwrite)
  writeFileSync(tsvPath, 'lang\tword\tbing_count\tollama_label\n', 'utf-8');

  const start = performance.now();
  let done = 0;
  let withCount = 0;
  const total = entries.length;
  const missing = [];

  for (let i = 0; i < total; i += BING_CONCURRENCY) {
    const batch = entries.slice(i, i + BING_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(({ word, lang }) =>
        fetchBingCount(word, lang)
          .then((count) => ({ word, lang, count }))
          .catch(() => ({ word, lang, count: undefined })),
      ),
    );

    // Append to TSV immediately (no large Map in memory)
    let chunk = '';
    for (const r of batchResults) {
      chunk += `${r.lang}\t${r.word}\t${r.count ?? ''}\t\n`;
      if (r.count != null) withCount++;
      else missing.push({ lang: r.lang, word: r.word });
    }
    append(tsvPath, chunk, 'utf-8');

    done = Math.min(i + BING_CONCURRENCY, total);
    const elapsed = (performance.now() - start) / 1000;
    const rate = done / elapsed;
    const eta = (total - done) / rate;
    process.stderr.write(
      `\r  Bing: ${done}/${total} (${rate.toFixed(0)}/s, ETA ${formatTime(eta)})  count=${withCount}`,
    );
  }
  process.stderr.write('\n');
  return { withCount, missing, elapsedMs: performance.now() - start };
}

// ---------- Phase 4: Ollama classification ----------

function buildPrompt(batch) {
  return [
    '/no_think',
    '次の単語を、一般性で3段階分類してください。',
    '分類は common, known, obscure のいずれかだけを使ってください。',
    'common = 頻出で非常によく知られている',
    'known = 知られてはいる',
    'obscure = あまり知られていない',
    'JSONのみ返してください。',
    '形式: {"items":[{"word":"ねこ","label":"common"}]}',
    `単語: ${batch.join(', ')}`,
  ].join('\n');
}

async function ollamaClassify(batch) {
  const res = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: 'json',
      prompt: buildPrompt(batch),
      options: { temperature: 0 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const body = await res.json();
  let payload;
  try {
    payload = JSON.parse(body.response);
  } catch {
    const cleaned = body.response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    payload = jsonMatch ? JSON.parse(jsonMatch[0]) : { items: [] };
  }
  return payload.items ?? [];
}

async function classifyMissing(missingEntries) {
  const labels = new Map();
  const start = performance.now();
  const total = missingEntries.length;
  let done = 0;

  for (let i = 0; i < total; i += OLLAMA_CHUNK_SIZE) {
    const chunk = missingEntries.slice(i, i + OLLAMA_CHUNK_SIZE);
    const words = chunk.map((e) => e.word);
    try {
      const items = await ollamaClassify(words);
      for (const item of items) {
        const entry = chunk.find((e) => e.word === item.word);
        if (entry) {
          labels.set(`${entry.lang}\t${entry.word}`, item.label);
        }
      }
    } catch (err) {
      process.stderr.write(`\n  Ollama error at batch ${i}: ${err.message}\n`);
    }
    done = Math.min(i + OLLAMA_CHUNK_SIZE, total);
    const elapsed = (performance.now() - start) / 1000;
    const rate = done / elapsed;
    const eta = (total - done) / rate;
    process.stderr.write(
      `\r  Ollama: ${done}/${total} (${rate.toFixed(0)}/s, ETA ${formatTime(eta)})`,
    );
  }
  process.stderr.write('\n');
  return { labels, elapsedMs: performance.now() - start };
}

// ---------- Utils ----------

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '??';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

// ---------- Main ----------

console.log(`DB: ${DB_PATH}`);
console.log(`Lang: ${LANG}`);
console.log(`Bing concurrency: ${BING_CONCURRENCY}`);
console.log(`Ollama model: ${OLLAMA_MODEL}`);
console.log(`Output: ${OUTPUT_PATH}\n`);

// Phase 1
console.log('=== Phase 1: Loading words ===');
const entries = await loadWords();
console.log(`Loaded ${entries.length} unique words\n`);

// Phase 2: Bing scraping (writes TSV incrementally)
console.log('=== Phase 2: Bing scraping ===');
const bing = await scrapeBingAll(entries, OUTPUT_PATH);
console.log(`Done in ${formatTime(bing.elapsedMs / 1000)}`);
console.log(`With count: ${bing.withCount}/${entries.length}`);
console.log(`Missing: ${bing.missing.length}\n`);
console.log(`Saved TSV: ${OUTPUT_PATH}\n`);

// Phase 3: Ollama classification for missing words
if (bing.missing.length > 0) {
  console.log(`=== Phase 3: Ollama classification (${bing.missing.length} missing words) ===`);
  const ollama = await classifyMissing(bing.missing);
  console.log(`Done in ${formatTime(ollama.elapsedMs / 1000)}`);
  console.log(`Classified: ${ollama.labels.size}/${bing.missing.length}\n`);

  // Merge ollama labels back into TSV
  console.log('Merging Ollama labels into TSV...');
  const { readFileSync: readF } = await import('node:fs');
  const lines = readF(OUTPUT_PATH, 'utf-8').split('\n');
  const updated = lines.map((line, idx) => {
    if (idx === 0 || !line) return line;
    const parts = line.split('\t');
    const key = `${parts[0]}\t${parts[1]}`;
    const label = ollama.labels.get(key);
    if (label) parts[3] = label;
    return parts.join('\t');
  });
  writeFileSync(OUTPUT_PATH, updated.join('\n'), 'utf-8');
  console.log(`Updated TSV: ${OUTPUT_PATH}`);
} else {
  console.log('No missing words, skipping Ollama.');
}

console.log('\nDone!');
