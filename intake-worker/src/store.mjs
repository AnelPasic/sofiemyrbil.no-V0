export async function saveReceipt(db, payload, origin, key, now = Date.now()) {
  const id = crypto.randomUUID(), body = JSON.stringify(payload);
  // The database UNIQUE constraint arbitrates races; never acknowledge before commit.
  const result = await db.prepare(`INSERT INTO receipts
    (id,site_id,origin,idempotency_key,intent,payload_json,created_at_ms,due_at_ms)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(site_id,idempotency_key) DO NOTHING`)
    .bind(id, payload.site, origin, key, payload.form, body, now, now).run();
  if (!result.success) throw Error('storage');
  const row = await db.prepare('SELECT id,payload_json FROM receipts WHERE site_id=? AND idempotency_key=?')
    .bind(payload.site, key).first();
  if (!row) throw Error('storage');
  return { id: row.id, conflict: row.payload_json !== body, created: result.meta.changes === 1 };
}

export async function readReceipts(db, site, after = '', limit = 100) {
  const result = await db.prepare(`SELECT id,site_id,intent,payload_json,created_at_ms,notification_status,
    notification_attempts,resend_message_id,last_error,leadproof_status FROM receipts
    WHERE site_id=? AND id>? ORDER BY id LIMIT ?`).bind(site, after, limit + 1).all();
  const rows = result.results.slice(0, limit).map(({ payload_json, ...row }) => ({ ...row, payload: JSON.parse(payload_json) }));
  return { receipts: rows, next: result.results.length > limit ? rows.at(-1).id : null };
}

export function csv(rows) {
  const fields = ['id', 'site_id', 'intent', 'created_at_ms', 'notification_status', 'notification_attempts', 'resend_message_id', 'last_error', 'regnr', 'telefon', 'epost', 'services', 'melding', 'source'];
  const cell = value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]|^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [fields, ...rows.map(row => {
    const values = { ...row.payload, ...row, services: (row.payload.services ?? []).join(' | '), source: JSON.stringify(row.payload.source ?? {}) };
    return fields.map(field => values[field]);
  })].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
