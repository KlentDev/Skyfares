// utils/kvSnapshots.js
// REPORTS_KV is a dedicated namespace for this Worker (separate from the other Worker's
// ALTITUDE_KV) so the two Workers stay fully decoupled. Snapshots are how weekly/monthly
// reports compute "vs last period" deltas, and how the daily alert threshold looks at a
// trailing average without extra live API calls.
import { KV_SNAPSHOT_PREFIX, KV_SNAPSHOT_TTL_SECONDS } from "../config/constants.js";
import { getTrailingDailyDateKeys } from "./dates.js";

function snapshotKey(period, periodKey) {
  return `${KV_SNAPSHOT_PREFIX}:${period}:${periodKey}`;
}

/** @returns {Promise<import('../config/constants.js').ReportSnapshot|null>} */
export async function getPreviousSnapshot(period, previousPeriodKey, env) {
  const raw = await env.REPORTS_KV.get(snapshotKey(period, previousPeriodKey)).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @param {import('../config/constants.js').ReportSnapshot} snapshot */
export async function saveSnapshot(snapshot, env) {
  const key = snapshotKey(snapshot.period, snapshot.periodKey);
  await env.REPORTS_KV.put(key, JSON.stringify(snapshot), {
    expirationTtl: KV_SNAPSHOT_TTL_SECONDS,
  });
}

/**
 * Fetches up to `n` prior daily snapshots (yesterday back to n days ago, relative to runDate).
 * Missing days (e.g. before this Worker existed) are silently skipped, not treated as zeros.
 * @returns {Promise<import('../config/constants.js').ReportSnapshot[]>}
 */
export async function getTrailingDailySnapshots(n, runDate, env) {
  const keys = getTrailingDailyDateKeys(n, runDate);
  const snapshots = await Promise.all(
    keys.map(async (key) => {
      const raw = await env.REPORTS_KV.get(snapshotKey("daily", key)).catch(() => null);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
  );
  return snapshots.filter(Boolean);
}
