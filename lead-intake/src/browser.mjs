import { normalize, fromUrl } from './attribution.mjs';

const STORAGE = 'medon-attribution-v1', DAY = 86400000;
export function browserPermission(mode,cookieName,cookieText) {
  const values=cookieText.split(';').map(v=>v.trim()).filter(v=>v.startsWith(cookieName+'='));
  if(values.length>1||values[0]===cookieName+'=denied')return false;
  return mode==='permitted'||(mode==='consent'&&values[0]===cookieName+'=granted');
}
/** Call on every page after the site's existing consent decision is known, and on withdrawal. */
export function captureAttribution(browser, allowed, now = Date.now()) {
  if(browser.navigator?.globalPrivacyControl===true)allowed=false;
  if (!allowed) {
    try { browser.sessionStorage.removeItem(STORAGE); } catch { /* unavailable */ }
    return { source: {}, kind: 'form' };
  }
  const current = fromUrl(browser.location.href);
  const page=new URL(browser.location.href).pathname;
  if (current.source !== 'unknown' || current.conflicted) {
    const snapshot = { ...current, captured_at: now, landing_page_path:page, submission_page_path:page };
    // HttpOnly cookie is selected first by the server; this same-tab copy is only a standby.
    try { browser.sessionStorage.setItem(STORAGE, JSON.stringify(snapshot)); } catch { /* cookie or IP fallback may remain */ }
    return { source: snapshot, kind: 'form' };
  }
  try {
    const stored = JSON.parse(browser.sessionStorage.getItem(STORAGE) || 'null');
    if (stored && Number.isSafeInteger(stored.captured_at) && stored.captured_at <= now && now - stored.captured_at < DAY)
      return { source: { ...normalize(stored), captured_at: stored.captured_at,landing_page_path:stored.landing_page_path,submission_page_path:page }, kind: 'session' };
    browser.sessionStorage.removeItem(STORAGE);
  } catch { /* No extra storage or URL fallback. */ }
  return { source: {submission_page_path:page}, kind: 'form' };
}

/** Keep state for the form's lifetime, including network retries. No optimistic success.
 * @param {object} payload
 * @param {{endpoint?:string,state?:{body?:string,key?:string,fingerprint?:string},transport?:typeof fetch}} options
 */
export async function submitLead(payload, { endpoint = '/api/leads', state = {}, transport = fetch } = {}) {
  const fingerprint=JSON.stringify(Object.fromEntries(Object.entries(payload).filter(([key])=>!['source','source_kind'].includes(key)).sort(([a],[b])=>a.localeCompare(b))));
  if (state.fingerprint !== fingerprint) { state.body = JSON.stringify(payload); state.fingerprint=fingerprint; state.key = crypto.randomUUID(); }
  const response = await transport(endpoint, { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': state.key }, body:state.body });
  const result = await response.json();
  if (!response.ok || result.ok !== true || typeof result.id !== 'string') throw Error(result.error || 'submission-failed');
  return result;
}

/** Generic custom-form integration. Styling and labels belong to the site's existing primitives. */
export function formFields(data,multipleFields=[]) {
  const fields=Object.fromEntries(data);
  for(const name of multipleFields)fields[name]=data.getAll(name);
  return fields;
}
export function bindLeadForm(form, { formId, allowed = () => false, endpoint = '/api/leads', multipleFields=[], onStored = (_result) => {} }) {
  const state = {}, status = form.querySelector('[data-lead-status]'), button = form.querySelector('[type="submit"]');
  let busy = false;
  const handler = async event => {
    event.preventDefault(); if (busy || !form.reportValidity()) return;
    busy = true; if (button) button.disabled = true;
    if (status) status.textContent = 'Sender henvendelsen …';
    try {
      const attribution = captureAttribution(window, allowed());
      const payload = { ...formFields(new FormData(form),multipleFields), form: formId, source: attribution.source, source_kind: attribution.kind };
      const result = await submitLead(payload, { endpoint, state });
      if (status) status.textContent = 'Henvendelsen er mottatt.';
      onStored(result);
    } catch { if (status) status.textContent = 'Kunne ikke sende. Prøv igjen.'; }
    finally { busy = false; if (button) button.disabled = false; }
  };
  form.addEventListener('submit', handler);
  return () => form.removeEventListener('submit', handler);
}
