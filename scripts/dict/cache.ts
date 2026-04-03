import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

async function isCacheFresh(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return Date.now() - s.mtimeMs < MAX_CACHE_AGE_MS;
  } catch {
    return false;
  }
}

export async function downloadWithCache(
  url: string,
  cacheDir: string,
  filename: string,
  force = false,
): Promise<string> {
  await mkdir(cacheDir, { recursive: true });
  const dest = join(cacheDir, filename);

  if (!force && existsSync(dest) && (await isCacheFresh(dest))) {
    console.log(`  Cache hit: ${filename}`);
    return dest;
  }

  console.log(`  Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: ${response.status} ${response.statusText} (${url})`);
  }

  const nodeStream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);

  if (url.endsWith('.gz') && !url.endsWith('.tar.gz')) {
    const gunzip = createGunzip();
    const out = createWriteStream(dest);
    await pipeline(nodeStream, gunzip, out);
  } else {
    const out = createWriteStream(dest);
    await pipeline(nodeStream, out);
  }

  console.log(`  Saved: ${dest}`);
  return dest;
}

export async function extractZip(
  archivePath: string,
  extractDir: string,
): Promise<string> {
  await mkdir(extractDir, { recursive: true });
  if (process.platform === 'win32') {
    await execFileAsync('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force`,
    ]);
  } else {
    await execFileAsync('unzip', ['-o', '-q', archivePath, '-d', extractDir]);
  }
  return extractDir;
}

export async function extractTarGz(
  archivePath: string,
  extractDir: string,
): Promise<string> {
  await mkdir(extractDir, { recursive: true });
  await execFileAsync('tar', ['xzf', archivePath, '-C', extractDir]);
  return extractDir;
}
