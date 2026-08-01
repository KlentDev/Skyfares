-- 0001_guide_pdf_audit_log.sql — audit trail for the KrisFlyer Guide secure
-- PDF pipeline (cloudflare/utils/auditLog.js). Apply with:
--   wrangler d1 execute skyfares-guide-audit --file=./migrations/0001_guide_pdf_audit_log.sql
--   wrangler d1 execute skyfares-guide-audit --file=./migrations/0001_guide_pdf_audit_log.sql --remote

CREATE TABLE IF NOT EXISTS guide_pdf_audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at      TEXT NOT NULL,
  email           TEXT NOT NULL,
  guide_id        TEXT NOT NULL,
  entitlement_id  TEXT,
  delivery_method TEXT NOT NULL,   -- 'download' | 'email'
  status          TEXT NOT NULL,   -- 'success' | 'denied' | 'error'
  reason          TEXT,
  ip              TEXT
);

CREATE INDEX IF NOT EXISTS idx_guide_pdf_audit_log_email ON guide_pdf_audit_log (email);
CREATE INDEX IF NOT EXISTS idx_guide_pdf_audit_log_created_at ON guide_pdf_audit_log (created_at);
