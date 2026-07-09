// config/constants.js
// Beehiiv segment IDs stay as bare JS constants (not wrangler.toml [vars]) — mirrors the
// split already used in cloudflare/subscribe-worker.js, where BEEHIIV_PUB_ID/AIRTABLE_BASE_ID
// live in env vars but SEG_PREMIUM/SEG_FREE/SEG_PRELAUNCH are hardcoded constants.
export const SEG_PREMIUM = "seg_6b2bf91a-e5fe-42f5-ad9a-e939397add9a"; // "Altitude Premium Subscribers"
export const SEG_FREE = "seg_f4472be3-fe20-4ed6-b761-367041d6a522"; // "Free Subscribers"
export const SEG_PRELAUNCH = "seg_3b2edb32-94a4-43b8-af13-1668923ffa95"; // "Pre-Launch Subscribers" — the "Early Access Signups" metric

export const TIMEZONE = "Asia/Manila"; // UTC+8, no DST

export const KV_SNAPSHOT_PREFIX = "snapshot";
export const KV_SNAPSHOT_TTL_SECONDS = 34560000; // ~400 days

/**
 * @typedef {Object} IntegrationResult
 * @property {'ok'|'error'|'not_connected'} status
 * @property {any} [data]
 * @property {string} [error]
 */

/**
 * @typedef {Object} ReportSnapshot
 * @property {'daily'|'weekly'|'monthly'} period
 * @property {string} periodKey
 * @property {string} windowStartUtc
 * @property {string} windowEndUtc
 * @property {{activeSubscribers:number, premiumCount:number, freeCount:number, prelaunchCount:number,
 *             newSubscribersInWindow:number, newPrelaunchInWindow:number, newPremiumInWindow:number}} beehiiv
 * @property {{flightApplicationsInWindow:number, contactInquiriesInWindow:number,
 *             flightApplicationsAllTime:number, contactInquiriesAllTime:number}} airtable
 * @property {string[]} integrationErrors
 * @property {string} savedAt
 */
