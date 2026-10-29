// Bounded JSON reader and response pattern adapted from the read-only pilot.
export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}
export function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', ...headers,
  } });
}
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
    clearTimeout(timer); void reader.cancel().catch(() => {}); reader.releaseLock();
  }
}
export function httpsOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value) throw Error('configuration-origin');
  return value;
}
export function configuration(env) {
  if (!/^[a-z0-9][a-z0-9.-]{2,99}$/.test(env.SITE_ID ?? '')) throw Error('configuration-site');
  const forms = JSON.parse(env.FORMS_JSON ?? '{}'), packages = JSON.parse(env.PACKAGES_JSON ?? '[]');
  if (!forms || Array.isArray(forms) || Object.keys(forms).length < 1 || Object.keys(forms).length > 20 ||
      !Array.isArray(packages) || packages.length > 100 || packages.some(p => !/^[a-z0-9_-]{1,80}$/.test(p))) throw Error('configuration-forms');
  for (const [key, form] of Object.entries(forms)) {
    if (!/^[a-z0-9_-]{1,64}$/.test(key) || !form.fields || Object.keys(form.fields).length > 20) throw Error('configuration-form');
    for (const [field, rule] of Object.entries(form.fields)) {
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(field) || ['site','form','source','source_kind','website_confirmation','__proto__','constructor','prototype'].includes(field) ||
          !['text','email','phone','url','package','choice','multi-choice'].includes(rule.type) ||
          (rule.max !== undefined && (!Number.isSafeInteger(rule.max) || rule.max < 1 || rule.max > 4000)) ||
          (['choice','multi-choice'].includes(rule.type) && (!Array.isArray(rule.values) || !rule.values.length || rule.values.length > 100 || rule.values.some(v=>typeof v!=='string'||!v||v.length>254||/[\x00-\x1f\x7f]/.test(v)) || new Set(rule.values).size!==rule.values.length))) throw Error('configuration-field');
    }
    if (form.fields.email?.type !== 'email' || form.fields.email.required !== true) throw Error('configuration-email');
  }
  new Intl.DateTimeFormat('en', { timeZone: env.TIMEZONE });
  return { site: env.SITE_ID, origin: httpsOrigin(env.SITE_ORIGIN), ingress: httpsOrigin(env.INGRESS_ORIGIN), forms, packages,
    timezone: env.TIMEZONE || 'Europe/Oslo' };
}
export function validate(input, config) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(422, 'validation');
  if (input.site !== undefined && input.site !== config.site) throw new HttpError(403, 'site-binding');
  const form = Object.hasOwn(config.forms, input.form) && config.forms[input.form];
  if (!form || input.website_confirmation) throw new HttpError(422, 'validation');
  const allowed = new Set(['site','form','source','source_kind','website_confirmation', ...Object.keys(form.fields)]);
  if (Object.keys(input).some(key => !allowed.has(key))) throw new HttpError(422, 'unexpected-field');
  const payload = { site: config.site, form: input.form };
  for (const [key, rule] of Object.entries(form.fields)) {
    if(rule.type==='multi-choice') {
      const choices=input[key]??[];
      if(!Array.isArray(choices)||choices.length>rule.values.length||(rule.required&&!choices.length)||new Set(choices).size!==choices.length||choices.some(v=>typeof v!=='string'||!rule.values.includes(v)))throw new HttpError(422,'validation');
      payload[key]=rule.values.filter(v=>choices.includes(v));
      continue;
    }
    const value = input[key] ?? '';
    if (typeof value !== 'string') throw new HttpError(422, 'validation');
    const clean = value.trim();
    if ((rule.required && !clean) || clean.length > (rule.max ?? (rule.type === 'text' ? 1000 : 254)) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(clean)) throw new HttpError(422, 'validation');
    if (clean && ((rule.type === 'email' && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(clean)) ||
      (rule.type === 'phone' && !/^[+\d ()-]{5,30}$/.test(clean)) ||
      (rule.type === 'package' && !config.packages.includes(clean)) ||
      (rule.type === 'choice' && !rule.values.includes(clean)))) throw new HttpError(422, 'validation');
    if (clean && rule.type === 'url') {
      try { const url = new URL(clean); if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw Error(); }
      catch { throw new HttpError(422, 'validation'); }
    }
    payload[key] = clean;
  }
  return payload;
}

export function enabled(env) {
  return env.SITE_STAGE === 'production' && env.PRIVACY_APPROVED === 'true' && env.PUBLIC_LEADS_ENABLED === 'true';
}

// Only trusted frontend service bindings supply context.origin. Browser payload.site never selects a site.
export function siteEnvironments(env) {
  if (!env.SITE_MAP_JSON) return [env];
  const sites=JSON.parse(env.SITE_MAP_JSON);
  if(env.INSTALLATION_MODE!=='medon-shared'||!Array.isArray(sites)||!sites.length||sites.length>20)throw Error('configuration-sites');
  const ids=new Set(),origins=new Set();
  return sites.map(s=>{
    if(ids.has(s.site)||origins.has(s.origin))throw Error('configuration-sites');
    ids.add(s.site);origins.add(s.origin);
    const scoped={...env,SITE_ID:s.site,SITE_ORIGIN:s.origin,SITE_LABEL:s.label||s.site,
      FORMS_JSON:JSON.stringify(s.forms),PACKAGES_JSON:JSON.stringify(s.packages||[]),
      HIT_PATHS_JSON:JSON.stringify(s.hitPaths||[]),TRACKING_STARTED_AT:s.trackingStartedAt||''};
    configuration(scoped);return scoped;
  });
}
export function siteEnvironment(env,origin) {
  const scoped=siteEnvironments(env).find(s=>s.SITE_ORIGIN===origin);
  if(!scoped)throw new HttpError(403,'origin');
  return scoped;
}
export function reportSites(env,params) {
  const sites=siteEnvironments(env),selected=params.get('site');
  if(selected&&!sites.some(s=>s.SITE_ID===selected))throw new HttpError(403,'site-binding');
  return selected?sites.filter(s=>s.SITE_ID===selected):sites;
}
