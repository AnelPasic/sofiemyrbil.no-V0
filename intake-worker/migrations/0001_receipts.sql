CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  intent TEXT NOT NULL CHECK(intent IN ('verksted-foresporsel')),
  payload_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  notification_status TEXT NOT NULL DEFAULT 'pending' CHECK(notification_status IN ('pending','sending','retry','accepted','dead_letter','manual_review')),
  notification_attempts INTEGER NOT NULL DEFAULT 0,
  first_attempt_at_ms INTEGER,
  due_at_ms INTEGER NOT NULL,
  lease_until_ms INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  notification_json TEXT,
  resend_message_id TEXT,
  last_error TEXT,
  leadproof_status TEXT NOT NULL DEFAULT 'not_configured' CHECK(leadproof_status IN ('not_configured','pending','accepted','failed')),
  UNIQUE(site_id, idempotency_key)
);
CREATE INDEX receipts_due ON receipts(site_id, notification_status, due_at_ms);
CREATE INDEX receipts_read ON receipts(site_id, created_at_ms, id);
