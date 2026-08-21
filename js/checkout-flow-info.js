/**
 * "How checkout & portal access works" info modal.
 *
 * Small, reusable explainer wired to every info icon next to an Altitude
 * pricing card (index.html's Pricing section, pages/altitude.html's own
 * pricing section, and the components/altitude-pricing.html plan-picker
 * modal). Built on window.SkyUI.modal (js/ui.js, injected globally by
 * js/header.js) rather than a new modal implementation, so it matches the
 * site's existing informational-modal convention.
 *
 * The steps below describe the real flow: Stripe Checkout redirect (see
 * js/index-pricing.js / js/altitude.js's handleCheckout, both POST to
 * WORKER + '/altitude/checkout' or '/guide/checkout' and redirect to the
 * returned Stripe URL) -> on success Stripe sends the buyer to
 * pages/altitude-success.html, which auto-sends a magic link and opens
 * the "check your email" panel (js/magic-modal.js openStarterSuccessModal)
 * -> clicking that email link is what actually unlocks the portal.
 */
window.openCheckoutFlowInfo = function () {
  if (!window.SkyUI || !window.SkyUI.modal) return;

  SkyUI.modal({
    title: 'How checkout & portal access works',
    html:
      '<ol class="list-decimal pl-5 space-y-2.5 text-sm text-neutral-600 leading-relaxed">' +
        '<li>Choose a plan and select its checkout button.</li>' +
        '<li>You are securely redirected to <strong>Stripe</strong> to complete payment. Skyfare never sees or stores your card details.</li>' +
        '<li>Once payment succeeds, Skyfare automatically emails you a one-time <strong>magic link</strong> &mdash; no password to set or remember.</li>' +
        '<li>Open that email and click the link to unlock the private Altitude portal.</li>' +
        '<li>Returning later? Choose &ldquo;Enter your email for a magic link&rdquo; from the sign-in prompt to get back in any time.</li>' +
      '</ol>' +
      '<p class="mt-4 text-xs text-neutral-400 leading-relaxed">' +
        'By subscribing you agree to our ' +
        '<a href="/pages/terms" class="text-brand-600 underline underline-offset-2 hover:text-brand-800">Terms &amp; Conditions</a> and ' +
        '<a href="/pages/privacy" class="text-brand-600 underline underline-offset-2 hover:text-brand-800">Privacy Policy</a>.' +
      '</p>',
    actions: [{ label: 'Got it', style: 'primary' }],
  });
};
