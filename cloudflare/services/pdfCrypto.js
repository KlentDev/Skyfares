// services/pdfCrypto.js — the one place the PDF password-protection strategy
// lives. Kept isolated from rendering/delivery/entitlement code specifically
// so this can be swapped out later without touching anything else.
//
// Uses @pdfsmaller/pdf-encrypt: pure Web Crypto API (crypto.subtle), zero
// native dependencies, explicitly documented as Cloudflare Workers-compatible.
// Verified before adopting it (2026-07-30) by reading its actual source
// (dist/pdf-encrypt.mjs + dist/crypto-aes.mjs) rather than trusting the README
// alone — it implements ISO 32000-2:2020 Algorithms 2.B/8/9/10 for AES-256
// (V=5, R=6) correctly, cites mozilla/pdf.js as its cross-check reference, and
// guards the one sharp edge in this integration itself (throws
// AlreadyEncryptedError if handed an already-encrypted PDF, which can't
// happen here since every PDF is freshly rendered by Puppeteer, but is good
// defense-in-depth). pdf-lib is its declared peer dependency.
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';

/**
 * @param {Uint8Array} pdfBytes - unencrypted PDF straight from Puppeteer's page.pdf()
 * @param {string} password - the derived open (user) password from pdfPassword.js
 * @returns {Promise<Uint8Array>} AES-256 (V=5, R=6) encrypted PDF bytes
 */
export async function encryptGuidePdf(pdfBytes, password) {
  return encryptPDF(pdfBytes, password, {
    algorithm: 'AES-256',
    // No owner password supplied — defaults to the same user password, so
    // there's no separate "master" password to manage/leak for a personal-use
    // guide. Permissions default to allow-everything (printing, copying) —
    // this is defense-in-depth against casual redistribution, not DRM; a
    // legitimate purchaser reading their own guide shouldn't hit friction.
  });
}
