import type { Plugin } from 'vite';
import { existsSync, createReadStream, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * dev/preview サーバーで dist-dict/ のローカル辞書ファイルを配信する。
 * 本番では R2 から配信されるため、このプラグインは dev 時のみ有効。
 */

const ROUTE_MAP: Record<string, { file: string; contentType: string }> = {
  '/dict.meta.json': { file: 'meta.json', contentType: 'application/json' },
  '/dict.sqlite': { file: 'dict.db', contentType: 'application/x-sqlite3' },
};

export function localDict(dictDir = 'dist-dict'): Plugin {
  const resolvedDir = resolve(dictDir);

  function handler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const pathname = new URL(req.url ?? '', 'http://localhost').pathname;
    const mapping = ROUTE_MAP[pathname];
    if (!mapping) return next();

    const filePath = resolve(resolvedDir, mapping.file);
    if (!existsSync(filePath)) return next();

    const stat = statSync(filePath);
    res.setHeader('Content-Type', mapping.contentType);
    res.setHeader('Content-Length', stat.size);
    createReadStream(filePath).pipe(res);
  }

  return {
    name: 'local-dict',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
