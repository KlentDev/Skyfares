-- 0002_push_subscriptions.sql — Web Push subscription storage
-- (cloudflare/orchestration/pushHandlers.js). Numbered to continue the
-- migrations/ sequence, but targets a DIFFERENT database than
-- 0001_guide_pdf_audit_log.sql: this one is skyfares-push (binding
-- PUSH_DB), not skyfares-guide-audit (binding AUDIT_DB) — subscriptions are
-- actively queried/updated app state, not a write-mostly audit trail, so
-- they get their own database. Apply with:
--   wrangler d1 execute skyfares-push --file=./migrations/0002_push_subscriptions.sql
--   wrangler d1 execute skyfares-push --file=./migrations/0002_push_subscriptions.sql --remote

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           TEXT PRIMARY KEY,
  email        TEXT,                          -- set when a valid Altitude JWT was present at subscribe time; NULL for public/anonymous
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  audience     TEXT NOT NULL DEFAULT 'public', -- 'public' | 'altitude' — server-derived, never client-supplied
  topics       TEXT NOT NULL DEFAULT '[]',     -- JSON array subset of ['award_alert','krisflyer_escape','premium_newsletter','skyfare_announcement','service_update']
  user_agent   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_push_subs_audience ON push_subscriptions (audience);
CREATE INDEX IF NOT EXISTS idx_push_subs_email    ON push_subscriptions (email);
