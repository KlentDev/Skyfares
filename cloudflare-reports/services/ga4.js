// services/ga4.js
// Optional per the brief ("if credentials already exist, connect it"). No gtag/dataLayer/
// measurement ID exists anywhere in this repo, so there's nothing to connect to yet. Wiring
// this up for real would need a GA4_PROPERTY_ID var plus a GA4_SERVICE_ACCOUNT_JSON secret
// (service-account credentials, used to mint a short-lived OAuth token via a signed JWT) to
// call the GA4 Data API's runReport endpoint — no npm SDK available in a Worker without a
// build step, so that JWT signing would reuse the same Web Crypto approach already used for
// this repo's own JWT helpers in cloudflare/subscribe-worker.js.
export async function getGa4Summary() {
  return { status: "not_connected", label: "GA4" };
}
