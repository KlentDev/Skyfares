// services/stripe.js
// Deliberate stub: by design this Worker never reads env.STRIPE_* — no such secret is even
// declared in wrangler.toml, so reusing the other Worker's Stripe keys here isn't just
// discouraged in code, it's structurally impossible. See plan Context: "Stripe stays a stub."
export async function getStripeSummary() {
  return { status: "not_connected", label: "Stripe" };
}
