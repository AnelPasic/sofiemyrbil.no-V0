export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}
export function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', ...headers,
  } });
}
export function configuration(env) {
  const validOrigin = value => {
    const url = new URL(value);
    if (url.origin !== value || url.protocol !== 'https:') throw Error('configuration');
    return value;
  };
  if (!/^[a-z0-9][a-z0-9.-]{2,199}$/.test(env.SITE_ID ?? '')) throw Error('configuration');
  return { site: env.SITE_ID, ingress: validOrigin(env.INGRESS_ORIGIN),
    origins: new Set((env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean).map(validOrigin)) };
}

// Bound both streamed bytes and wall time, even if Content-Length is absent or false.
export async function readJson(message, maxBytes = 16384, timeoutMs = 5000) {
  if (Number(message.headers.get('content-length') ?? 0) > maxBytes) throw new HttpError(413, 'body-too-large');
  const reader = message.body?.getReader();
  if (!reader) throw new HttpError(400, 'invalid-json');
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new HttpError(408, 'body-timeout')), timeoutMs); });
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new HttpError(413, 'body-too-large');
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let position = 0;
    for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new HttpError(400, 'invalid-json'); }
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

const SERVICES = new Set(['EU-Kontroll', 'Service', 'Diagnose', 'Dekkskifte', 'Reparasjon', 'Karosseri']);

export function validate(input, site) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(422, 'validation');
  const keys = new Set(['site', 'form', 'regnr', 'telefon', 'epost', 'services', 'melding', 'source', 'website_confirmation']);
  if (Object.keys(input).some(key => !keys.has(key))) throw new HttpError(422, 'validation');
  if (input.site !== site) throw new HttpError(403, 'site-binding');
  if (input.form !== 'verksted-foresporsel') throw new HttpError(422, 'validation');
  if (input.website_confirmation !== undefined && (typeof input.website_confirmation !== 'string' || input.website_confirmation)) throw new HttpError(422, 'validation');
  if (typeof input.regnr !== 'string' || typeof input.telefon !== 'string' || typeof input.epost !== 'string' ||
      typeof input.melding !== 'string') throw new HttpError(422, 'validation');
  const regnr = input.regnr.toUpperCase().trim().replace(/\s+/g, ' ');
  const telefon = input.telefon.trim();
  const epost = input.epost.trim().toLowerCase();
  const melding = input.melding.trim();
  if (!/^[A-ZÆØÅ0-9 -]{2,10}$/u.test(regnr)) throw new HttpError(422, 'validation');
  if (!/^[+0-9 ()-]{7,24}$/.test(telefon) || !/^\+?\d[\d ()-]*$/.test(telefon) ||
      (telefon.match(/\d/g) ?? []).length < 8 || (telefon.match(/\d/g) ?? []).length > 15) throw new HttpError(422, 'validation');
  if (epost.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost)) throw new HttpError(422, 'validation');
  if (melding.length > 2000) throw new HttpError(422, 'validation');
  if (!Array.isArray(input.services) || input.services.length < 1 || input.services.length > SERVICES.size ||
      input.services.some(s => typeof s !== 'string' || !SERVICES.has(s)) ||
      new Set(input.services).size !== input.services.length) throw new HttpError(422, 'validation');
  const raw = input.source ?? {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      Object.keys(raw).some(key => !['page','utm_source','utm_medium','utm_campaign','utm_content'].includes(key)) ||
      Object.values(raw).some(value => typeof value !== 'string')) throw new HttpError(422, 'validation');
  const source = {};
  const page = raw.page ?? '/bestilling/';
  if (!/^\/(?!\/)[a-z0-9/_-]{0,250}\/?$/i.test(page)) throw new HttpError(422, 'validation');
  source.page = page;
  for (const field of ['utm_source','utm_medium','utm_campaign','utm_content']) {
    const value = (raw[field] ?? '').trim();
    if (value && value.length <= 120 && /^[\p{L}\p{N} _./+-]+$/u.test(value)) source[field] = value;
  }
  return {site, form:'verksted-foresporsel', regnr, telefon, epost,
    services:[...input.services], melding, source};
}
