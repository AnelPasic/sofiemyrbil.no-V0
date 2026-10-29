import { readJson } from './domain.mjs';

function bytes(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw Error('jwt');
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), c => c.charCodeAt(0));
}
function segment(value) { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes(value))); }

export async function authorize(request, env, permission, network = fetch, now = Date.now()) {
  try {
    const issuer = env.ACCESS_ISSUER;
    if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer ?? '') || !env.ACCESS_AUD) return false;
    const token = request.headers.get('Cf-Access-Jwt-Assertion') ?? '';
    if (token.length > 16384) return false;
    const parts = token.split('.'); if (parts.length !== 3) return false;
    const header = segment(parts[0]), claims = segment(parts[1]), seconds = Math.floor(now / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit) return false;
    if (claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(env.ACCESS_AUD) ||
      !Number.isSafeInteger(claims.exp) || claims.exp <= seconds ||
      !Number.isSafeInteger(claims.iat) || claims.iat > seconds + 30 ||
      (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > seconds)) ||
      typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string') return false;
    const grants = JSON.parse(env.ADMIN_GRANTS_JSON ?? '{}')[claims.email];
    if (!Array.isArray(grants) || !grants.some(g => g.site === env.SITE_ID && Array.isArray(g.permissions) && g.permissions.includes(permission))) return false;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await network(issuer + '/cdn-cgi/access/certs', { signal: controller.signal, redirect: 'manual' });
      if (!response.ok) return false;
      const jwks = await readJson(response, 65536, 3000);
      const jwk = jwks.keys?.find(key => key.kid === header.kid && key.kty === 'RSA' && key.alg === 'RS256' && key.use === 'sig');
      if (!jwk) return false;
      const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    } finally { clearTimeout(timer); }
  } catch { return false; }
}
