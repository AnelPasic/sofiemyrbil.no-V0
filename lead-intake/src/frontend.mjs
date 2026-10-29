import { HttpError, json, readJson } from './domain.mjs';
import { cookie, clearCookie, readCookie, getCookie, COOKIE, permitted, fromUrl, eligible, pagePath } from './attribution.mjs';

/** Wrap the site's existing response handler (after cache lookup). Never call twice per request. */
export async function handleLeadRequest(request, env, ctx, next) {
  const url = new URL(request.url);
  if (url.origin !== env.SITE_ORIGIN) return json({ ok: false }, 403);
  const allowed = permitted(request, env);
  if (url.pathname === '/api/leads') {
    try {
      if (request.method !== 'POST') return json({ ok: false }, 405, { Allow: 'POST' });
      if (request.headers.get('Origin') !== env.SITE_ORIGIN || request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ ok: false }, 403);
      if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) throw new HttpError(415, 'content-type');
      const key = request.headers.get('Idempotency-Key');
      if (!/^[A-Za-z0-9_-]{8,100}$/.test(key || '')) throw new HttpError(422, 'idempotency-required');
      const input = await readJson(request);
      // No client-provided IP/hash/grants are read. The service entrypoint is unavailable via public HTTP.
      const result = await env.INTAKE.submit(input, {
        origin: url.origin, ip: request.headers.get('CF-Connecting-IP') || '', key, allowed,
        cookie: allowed ? readCookie(request) : null,
        source: allowed ? input.source : {}, source_kind: input.source_kind,
      });
      const { created, status, ...body } = result;
      return json(body, status || (created ? 201 : 200), !allowed&&getCookie(request,COOKIE) ? { 'Set-Cookie': clearCookie() } : {});
    } catch (error) { return json({ ok: false, error: error instanceof HttpError ? error.message : 'unavailable' }, error instanceof HttpError ? error.status : 503); }
  }
  const response = await next();
  if (!eligible(request, response)) return response;
  const source = fromUrl(request.url, request.headers.get('Referer') || '', env.SITE_ORIGIN);
  const wrapped = new Response(response.body, response);
  wrapped.headers.set('Referrer-Policy', 'strict-origin');
  // A cacheable origin document may be read; the personalized final response must never be cached.
  if (allowed && source.tagged) {
    const value = cookie({...source,landing_page_path:pagePath(request.url,env)}); if (value) wrapped.headers.append('Set-Cookie', value);
    wrapped.headers.set('Cache-Control', 'private, no-store');
    ctx.waitUntil(env.INTAKE.landing({ origin:url.origin, ip: request.headers.get('CF-Connecting-IP') || '', source, allowed: true }).catch(() => console.error('campaign-memory-unavailable')));
  } else if (!allowed && getCookie(request,COOKIE)) {
    wrapped.headers.append('Set-Cookie', clearCookie());
    wrapped.headers.set('Cache-Control', 'private, no-store');
  }
  if (env.HITCOUNT_ENABLED === 'true') ctx.waitUntil(env.INTAKE.count({ origin:url.origin, page: pagePath(request.url, env), source }).catch(() => console.error('hitcount-unavailable')));
  return wrapped;
}
