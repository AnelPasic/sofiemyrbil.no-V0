import { readJson } from './domain.mjs';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 23 * 60 * 60 * 1000;
const BACKOFF = [60000, 300000, 900000, 3600000, 14400000];

// One owner-configured mailbox or up to five comma-separated recipients.
// Invalid/ambiguous configuration disables notifications rather than sending to unintended addresses.
export function recipientEmails(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  const addresses = value.split(',').map(address => address.trim());
  if (addresses.length > 5 || addresses.some(address =>
    !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(address))) return [];
  if (new Set(addresses.map(address => address.toLowerCase())).size !== addresses.length) return [];
  return addresses;
}


function ready(env) {
  return env.DB && env.SITE_ID && env.SITE_STAGE === 'production' && env.PRIVACY_APPROVED === 'true' &&
    env.SEND_NOTIFICATIONS === 'true' && env.RESEND_API_KEY && env.RESEND_FROM &&
    recipientEmails(env.LEAD_TO_EMAIL).length > 0;
}

export function notification(lead, env) {
  const p = JSON.parse(lead.payload_json);
  const body = [
    'Ny forespørsel – Sofiemyr Bil AS',
    'Referanse: ' + lead.id,
    'Registreringsnummer: ' + p.regnr,
    'Telefon: ' + p.telefon,
    'E-post: ' + p.epost,
    'Tjenester: ' + p.services.join(', '),
    'Melding: ' + (p.melding || 'Ingen melding'),
    'Side: ' + (p.source?.page || '/bestilling/'),
    'Mottatt: ' + new Date(lead.created_at_ms).toISOString(),
  ].join('\n\n');
  return JSON.stringify({
    from: env.RESEND_FROM,
    to: recipientEmails(env.LEAD_TO_EMAIL),
    reply_to: p.epost,
    subject: 'Ny verkstedforespørsel – Sofiemyr Bil',
    text: body,
  });
}

export async function notifyOne(env, id, { now = Date.now(), transport = fetch, timeoutMs = 8000 } = {}) {
  if (!ready(env)) return;
  const token = crypto.randomUUID();
  const claimed = await env.DB.prepare(`UPDATE receipts SET notification_status='sending',lease_token=?,
    lease_until_ms=?,notification_attempts=notification_attempts+1,first_attempt_at_ms=COALESCE(first_attempt_at_ms,?)
    WHERE site_id=? AND id=? AND notification_attempts<? AND
    (notification_status='pending' OR (notification_status='retry' AND due_at_ms<=?) OR
    (notification_status='sending' AND lease_until_ms<=?))`)
    .bind(token, now + 60000, now, env.SITE_ID, id, MAX_ATTEMPTS, now, now).run();
  if (claimed.meta.changes !== 1) return;
  const lead = await env.DB.prepare('SELECT * FROM receipts WHERE site_id=? AND id=? AND lease_token=?').bind(env.SITE_ID, id, token).first();
  if (!lead) return;
  const finish = (status, error, resendId = null, due = now) => env.DB.prepare(`UPDATE receipts SET
    notification_status=?,last_error=?,resend_message_id=?,due_at_ms=?,lease_until_ms=0,lease_token=NULL
    WHERE site_id=? AND id=? AND notification_status='sending' AND lease_token=?`)
    .bind(status, error, resendId, due, env.SITE_ID, id, token).run();
  if (now - lead.first_attempt_at_ms >= WINDOW_MS) {
    await finish('manual_review', 'idempotency-window-expired'); return;
  }
  // Freeze exact request bytes before the first network call. Retries retain sender/recipient/template.
  const body = lead.notification_json ?? notification(lead, env);
  const frozen = await env.DB.prepare("UPDATE receipts SET notification_json=? WHERE site_id=? AND id=? AND lease_token=? AND notification_status='sending'")
    .bind(body, env.SITE_ID, id, token).run();
  if (frozen.meta.changes !== 1) return;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  let status = 'retry', code = 'resend-uncertain', resendId = null;
  let delay = BACKOFF[Math.min(lead.notification_attempts - 1, BACKOFF.length - 1)];
  try {
    const response = await transport('https://api.resend.com/emails', {
      method: 'POST', redirect: 'manual', signal: controller.signal,
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `receipt/${id}` }, body,
    });
    if (response.status === 200 || response.status === 201) {
      const result = await readJson(response, 16384, timeoutMs);
      if (typeof result.id === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(result.id)) {
        status = 'accepted'; code = null; resendId = result.id;
      }
    } else if (response.status === 429 || response.status >= 500 || response.status === 408 || response.status === 409) {
      code = `resend-${response.status}`;
      const seconds = Number(response.headers.get('Retry-After'));
      if (Number.isFinite(seconds) && seconds > 0) delay = Math.max(delay, Math.min(seconds * 1000, WINDOW_MS));
    } else if (response.status >= 400 && response.status < 500) {
      status = 'dead_letter'; code = `resend-${response.status}`;
    } else { status = 'manual_review'; code = 'resend-unexpected-status'; }
    if (response.body && !response.body.locked) await response.body.cancel();
  } catch { /* Acceptance is uncertain; retry only with the same provider key and request bytes. */ }
  finally { clearTimeout(timer); }
  if (status === 'retry' && lead.notification_attempts >= MAX_ATTEMPTS) status = 'manual_review';
  await finish(status, code, resendId, now + delay);
}

export async function retryDue(env, options = {}) {
  if (!ready(env)) return;
  const now = options.now ?? Date.now();
  await env.DB.prepare(`UPDATE receipts SET notification_status='manual_review',last_error='final-attempt-interrupted',
    lease_until_ms=0,lease_token=NULL WHERE site_id=? AND notification_status='sending' AND
    notification_attempts>=? AND lease_until_ms<=?`).bind(env.SITE_ID, MAX_ATTEMPTS, now).run();
  // Three jobs keep the normal sweep below a waitUntil lifetime; the next sweep handles the rest.
  const due = await env.DB.prepare(`SELECT id FROM receipts WHERE site_id=? AND notification_attempts<? AND
    (notification_status='pending' OR (notification_status='retry' AND due_at_ms<=?) OR
    (notification_status='sending' AND lease_until_ms<=?)) ORDER BY created_at_ms LIMIT 3`)
    .bind(env.SITE_ID, MAX_ATTEMPTS, now, now).all();
  for (const row of due.results) await notifyOne(env, row.id, { ...options, now });
}
