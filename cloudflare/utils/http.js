// utils/http.js — response wrapper + local-dev origin fallback, used by
// nearly every route handler across the Worker.
import { SITE_URL } from '../config/constants.js';

export function respond(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// Returns the request origin when running locally so redirect URLs
// (Stripe success, magic link) point back to the local dev server
// instead of the live site. Production requests fall back to SITE_URL.
export function getBaseUrl(origin) {
  return (origin && (origin.includes('127.0.0.1') || origin.includes('localhost')))
    ? origin
    : SITE_URL;
}
