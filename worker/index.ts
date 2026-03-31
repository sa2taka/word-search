interface Env {
  DICT_BUCKET: R2Bucket;
  ASSETS: Fetcher;
}

const R2_ROUTES: Record<
  string,
  { key: string; contentType: string; cacheSeconds: number }
> = {
  '/dict.meta.json': {
    key: 'meta.json',
    contentType: 'application/json',
    cacheSeconds: 300,
  },
  '/dict.sqlite': {
    key: 'dict.db',
    contentType: 'application/x-sqlite3',
    cacheSeconds: 86400,
  },
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const route = R2_ROUTES[url.pathname];

    if (!route) {
      return env.ASSETS.fetch(request);
    }

    // Edge cache lookup
    const cache = caches.default;
    const cached = await cache.match(request);
    if (cached) return cached;

    const object = await env.DICT_BUCKET.get(route.key);
    if (!object) {
      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', route.contentType);
    headers.set('Cache-Control', `public, max-age=${route.cacheSeconds}`);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    if (object.httpEtag) headers.set('ETag', object.httpEtag);
    headers.set('Content-Length', String(object.size));

    const response = new Response(object.body, { headers });

    // Cache at edge for subsequent requests
    ctx.waitUntil(cache.put(request, response.clone()));

    return response;
  },
} satisfies ExportedHandler<Env>;
