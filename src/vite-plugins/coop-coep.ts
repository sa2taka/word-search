import type { Plugin } from 'vite';

function addHeaders(_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
}

export function coopCoep(): Plugin {
  return {
    name: 'coop-coep',
    configureServer(server) {
      server.middlewares.use(addHeaders);
    },
    configurePreviewServer(server) {
      server.middlewares.use(addHeaders);
    },
  };
}
