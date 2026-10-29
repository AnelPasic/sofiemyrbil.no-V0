export const RULE_VERSION = 'mws-037g-v1';
export const COOKIE = '__Host-medon_attribution';
const DAY = 86400000;
const UTM = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
const CLICKS = ['gclid','gbraid','wbraid','oppref'];
const safeTag = (value, limit = 100) => typeof value === 'string' && value.length <= limit && /^[\p{L}\p{N} _.-]+$/u.test(value) && !/\d{7,}/.test(value) ? value.trim() : '';

/** @returns {import('./bindings').Source} */
export function normalize(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  /** @type {import('./bindings').Source} */
  const result = { source: 'unknown', medium: '', channel: 'unknown', campaign: '', rule_version: RULE_VERSION };
  for (const key of UTM) { const value = safeTag(input[key], key === 'utm_source' || key === 'utm_medium' ? 80 : 100); if (value) result[key] = value; }
  for (const key of CLICKS) if (typeof input[key] === 'string' && /^[A-Za-z0-9_-]{1,512}$/.test(input[key])) result[key] = input[key];
  const source = (result.utm_source || '').toLowerCase(), medium = (result.utm_medium || '').toLowerCase();
  const google = !!(result.gclid || result.gbraid || result.wbraid), openai = !!result.oppref;
  if ((google && openai) || (google && source && source !== 'google') || (openai && source && !['openai','chatgpt'].includes(source)) ||
      ((google || openai) && medium && !['cpc','ppc','paid','paid_search','paid_ai'].includes(medium))) return { ...result, conflicted: true };
  if (google) return { ...result, source: 'google', medium: medium || 'cpc', channel: 'paid_search', campaign: result.utm_campaign || '' };
  if (openai) return { ...result, source: source || 'openai', medium: medium || 'paid', channel: 'paid_ai', campaign: result.utm_campaign || '' };
  if (!source) return result;
  let channel = 'other';
  if (['cpc','ppc','paid_search'].includes(medium)) channel = ['google','bing'].includes(source) ? 'paid_search' : ['chatgpt','openai'].includes(source) ? 'paid_ai' : 'other';
  else if (['paid_social'].includes(medium)) channel = 'paid_social';
  else if (medium === 'organic' && ['google','bing','duckduckgo','yahoo'].includes(source)) channel = 'organic_search';
  else if (medium === 'email') channel = 'email';
  else if (medium === 'offline') channel = 'offline';
  else if (['social','organic_social'].includes(medium)) channel = 'organic_social';
  else if (['chatgpt','openai','perplexity','claude','copilot'].includes(source)) channel = 'ai_referral';
  else if (medium === 'referral') channel = 'referral';
  return { ...result, source, medium, channel, campaign: result.utm_campaign || '' };
}

export function fromUrl(value, referrer = '', origin = '') {
  const url = new URL(value), tags = Object.fromEntries([...UTM,...CLICKS].map(key => [key, url.searchParams.getAll(key).length === 1 ? url.searchParams.get(key) : '']));
  const result = normalize(tags);
  if (result.source !== 'unknown' || result.conflicted) return {...result,tagged:result.source!=='unknown'};
  try {
    const ref = new URL(referrer);
    if (!['https:','http:'].includes(ref.protocol) || ref.username || ref.password || ref.origin === origin) return result;
    const host = ref.hostname.replace(/^www\./, '');
    /** @type {Array<[string,RegExp]>} */
    const groups = [['google', /(^|\.)google\.[a-z.]+$/], ['bing', /(^|\.)bing\.com$/], ['duckduckgo', /(^|\.)duckduckgo\.com$/],
      ['chatgpt', /(^|\.)(chatgpt\.com|chat\.openai\.com)$/], ['perplexity', /(^|\.)perplexity\.ai$/], ['claude', /(^|\.)claude\.ai$/],
      ['facebook', /(^|\.)(facebook\.com|fb\.com)$/], ['instagram', /(^|\.)instagram\.com$/], ['linkedin', /(^|\.)linkedin\.com$/]];
    const match = groups.find(([, pattern]) => pattern.test(host));
    if (!match) return normalize({ utm_source: 'external', utm_medium: 'referral' });
    const source = match[0], medium = ['google','bing','duckduckgo'].includes(source) ? 'organic' : ['facebook','instagram','linkedin'].includes(source) ? 'social' : 'referral';
    return normalize({ utm_source: source, utm_medium: medium });
  } catch { return result; }
}

export function getCookie(request, name) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(name)) return '';
  const values = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith(name + '='));
  return values.length === 1 ? values[0].slice(name.length + 1) : '';
}
export function permitted(request, env) {
  // A site's existing consent integration may write this one explicit choice cookie.
  const choice=env.CONSENT_COOKIE_NAME||'attribution_permission';
  if((request.headers.get('cookie')||'').split(';').filter(v=>v.trim().startsWith(choice+'=')).length>1)return false;
  if (getCookie(request, env.CONSENT_COOKIE_NAME || 'attribution_permission') === 'denied' || request.headers.get('Sec-GPC') === '1') return false;
  return env.PRIVACY_APPROVED === 'true' && (env.ATTRIBUTION_MODE === 'permitted' ||
    (env.ATTRIBUTION_MODE === 'consent' && getCookie(request, env.CONSENT_COOKIE_NAME || 'attribution_permission') === 'granted'));
}
export function cookie(tags, now = Date.now()) {
  const source = normalize(tags), value = encodeURIComponent(JSON.stringify({ ...Object.fromEntries([...UTM,...CLICKS].filter(k => source[k]).map(k => [k,source[k]])), captured_at: now,
    ...(typeof tags.landing_page_path==='string'&&/^\/[a-zA-Z0-9/_-]{0,200}$/.test(tags.landing_page_path)?{landing_page_path:tags.landing_page_path}:{}) }));
  if (value.length > 3500) return '';
  return `${COOKIE}=${value}; Path=/; Max-Age=86400; Secure; HttpOnly; SameSite=Lax`;
}
export function clearCookie() { return `${COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`; }
export function readCookie(request, now = Date.now()) {
  try {
    const raw = getCookie(request, COOKIE); if (!raw || raw.length > 3500) return null;
    const value = JSON.parse(decodeURIComponent(raw));
    if (!Number.isSafeInteger(value.captured_at) || value.captured_at > now + 30000 || now - value.captured_at >= DAY) return null;
    return {...normalize(value),captured_at:value.captured_at,landing_page_path:value.landing_page_path};
  } catch { return null; }
}
function canonicalIP(ip) {
  if (typeof ip !== 'string' || ip.length > 45) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && ip.split('.').every(v => Number(v) <= 255)) return ip.split('.').map(Number).join('.');
  if (/^[0-9a-fA-F:]+$/.test(ip) && ip.includes(':')) { try { return new URL(`http://[${ip}]`).hostname; } catch { return null; } }
  return null;
}
async function ipHash(env, ip, bucket) {
  const canonical = canonicalIP(ip);
  if (!canonical || typeof env.IP_HMAC_KEY !== 'string' || env.IP_HMAC_KEY.length < 32) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.IP_HMAC_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${env.SITE_ID}\n${bucket}\n${canonical}`));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
function ttl(env) { const hours = Number(env.ATTRIBUTION_TTL_HOURS || 24); return Number.isFinite(hours) && hours > 0 && hours <= 24 ? hours * 3600000 : DAY; }

export async function remember(env, ip, source, now = Date.now()) {
  // Never writes for referrer-only or untagged traffic; called only on a permitted tagged HTML landing.
  if (env.PRIVACY_APPROVED !== 'true' || env.ATTRIBUTION_MODE === 'off' || source.source === 'unknown' || ![...UTM,...CLICKS].some(k => source[k])) return;
  const hash = await ipHash(env, ip, Math.floor(now / DAY)); if (!hash) return;
  await env.DB.prepare(`INSERT INTO campaign_memory(site_id,ip_hmac,received_at_ms,source,medium,campaign) VALUES(?,?,?,?,?,?)
    ON CONFLICT(site_id,ip_hmac) DO UPDATE SET received_at_ms=excluded.received_at_ms,source=excluded.source,medium=excluded.medium,campaign=excluded.campaign
    WHERE excluded.received_at_ms>=campaign_memory.received_at_ms`).bind(env.SITE_ID, hash, now, source.source, source.medium, source.campaign).run();
}
export async function estimate(env, ip, now = Date.now()) {
  if (env.PRIVACY_APPROVED !== 'true' || env.ATTRIBUTION_MODE === 'off') return null;
  const today = Math.floor(now / DAY), hashes = await Promise.all([ipHash(env, ip, today), ipHash(env, ip, today - 1)]);
  if (hashes.some(h => !h)) return null;
  return env.DB.prepare(`SELECT source,medium,campaign,received_at_ms FROM campaign_memory
    WHERE site_id=? AND ip_hmac IN (?,?) AND received_at_ms>? AND received_at_ms<=? ORDER BY received_at_ms DESC LIMIT 1`)
    .bind(env.SITE_ID, ...hashes, now - ttl(env), now).first();
}
/** @returns {Promise<import('./bindings').Source>} */
export async function chooseSource(env, context, now = Date.now()) {
  const unknown = { ...normalize(), method: 'unknown', captured_at: now };
  if (!context.allowed || env.PRIVACY_APPROVED !== 'true' || env.ATTRIBUTION_MODE === 'off') return unknown;
  const candidates = [[context.cookie, 'observed_cookie'], [context.source, context.source_kind === 'session' ? 'observed_session_storage' : 'observed_form_tags']];
  for (const [candidate, method] of candidates) {
    if(candidate?.captured_at!==undefined && (!Number.isSafeInteger(candidate.captured_at) || candidate.captured_at>now+30000 || now-candidate.captured_at>=DAY))continue;
    if(method==='observed_session_storage' && (!Number.isSafeInteger(candidate?.captured_at) || candidate.captured_at>now || now-candidate.captured_at>=DAY))continue;
    const source = normalize(candidate);
    if (source.conflicted) return { ...unknown, conflicted: true };
    if (source.source !== 'unknown') return { ...source, method, captured_at: now };
  }
  try {
    const found = await estimate(env, context.ip, now);
    if (found) return { source: found.source, medium: found.medium, campaign: found.campaign, channel: normalize({ utm_source: found.source, utm_medium: found.medium }).channel,
      method: 'estimated_ip_match', captured_at: found.received_at_ms, rule_version: RULE_VERSION };
  } catch { /* Analytics lookup must never prevent durable receipt storage. */ }
  return unknown;
}
export function eligible(request, response) {
  const path = new URL(request.url).pathname;
  return request.method === 'GET' && response.status >= 200 && response.status < 300 && /^text\/html(?:;|$)/i.test(response.headers.get('content-type') || '') &&
    !/^\/(api|admin|cdn-cgi)(\/|$)/i.test(path) && !/\.[a-z0-9]{1,8}$/i.test(path) &&
    !/bot|crawler|spider|slurp|headless|healthcheck|uptime|monitor|preview/i.test(request.headers.get('user-agent') || '') &&
    !/prefetch|prerender/i.test([request.headers.get('purpose'),request.headers.get('sec-purpose'),request.headers.get('x-purpose')].join(' '));
}
export function pagePath(value, env) {
  try {
    const url = new URL(value, env.SITE_ORIGIN);
    const paths = JSON.parse(env.HIT_PATHS_JSON || '["/"]');
    return url.origin === env.SITE_ORIGIN && paths.includes(url.pathname) ? url.pathname : '/other/';
  } catch { return '/other/'; }
}
export function localDate(now, timezone) { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now)); }
export async function recordHit(env, { page, source, now = Date.now() }) {
  if (env.HITCOUNT_ENABLED !== 'true') return;
  const s = normalize(source), day = localDate(now, env.TIMEZONE || 'Europe/Oslo');
  // Bound malicious campaign cardinality per day. Overflow stays in total counts.
  const dimensions = await env.DB.prepare('SELECT count(*) n FROM html_hits WHERE site_id=? AND day=?').bind(env.SITE_ID, day).first();
  const bounded = Number(dimensions.n) >= 1000 ? { source: 'other', medium: '', channel: 'other', campaign: 'overflow' } : s;
  await env.DB.prepare(`INSERT INTO html_hits(site_id,day,page,source,medium,channel,campaign,hits) VALUES(?,?,?,?,?,?,?,1)
    ON CONFLICT(site_id,day,page,source,medium,channel,campaign) DO UPDATE SET hits=hits+1`)
    .bind(env.SITE_ID, day, pagePath(page, env), bounded.source, bounded.medium, bounded.channel, bounded.campaign).run();
}

export async function cleanup(env, now = Date.now()) {
  // Shared Medon sites are reporting dimensions, not separate retention policies.
  // Expiry must also cover a site removed from the active broker/report allowlist.
  const shared=env.INSTALLATION_MODE==='medon-shared',scope=shared?'':'site_id=? AND ',siteValues=shared?[]:[env.SITE_ID];
  await env.DB.prepare(`DELETE FROM campaign_memory WHERE ${scope}received_at_ms<=?`).bind(...siteValues,now-ttl(env)).run();
  /** @type {Array<[string,string,string,boolean]>} */
  const retention = [['RETENTION_DAYS','receipts','created_at_ms',false], ['HIT_RETENTION_DAYS','html_hits','day',true]];
  for (const [setting, table, column, dateOnly] of retention) {
    if(setting==='RETENTION_DAYS' && env.RETENTION_MODE==='manual')continue;
    const days = Number(env[setting]);
    if (Number.isSafeInteger(days) && days > 0) {
      const cutoff = dateOnly ? localDate(now - days * DAY, env.TIMEZONE || 'Europe/Oslo') : now - days * DAY;
      await env.DB.prepare(`DELETE FROM ${table} WHERE ${scope}${column}<?`).bind(...siteValues, cutoff).run();
    }
  }
}
