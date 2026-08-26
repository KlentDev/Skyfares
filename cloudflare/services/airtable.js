// services/airtable.js — flight applications, contact inquiries, testimonials,
// and Travel Strategy Call bookings. A clean leaf module: only talks to
// Airtable, no Stripe/Beehiiv/Cal.com (those live in orchestration/ instead).
import { respond } from '../utils/http.js';
import { ROUTE_LABELS, KV_PREFIX } from '../config/constants.js';
import { verifyAltitudeRequest } from '../orchestration/session.js';

function airtableHeaders(env) {
  return {
    'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

function airtableTableUrl(env, tableIdOrName, params = null) {
  const base = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(tableIdOrName)}`;
  const qs = params ? params.toString() : '';
  return qs ? `${base}?${qs}` : base;
}

function redactAirtableError(text = '') {
  return String(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/cus_[A-Za-z0-9]+/g, 'cus_[redacted]')
    .replace(/sub_[A-Za-z0-9]+/g, 'sub_[redacted]')
    .replace(/cs_[A-Za-z0-9_]+/g, 'cs_[redacted]')
    .slice(0, 300);
}

export async function writeToAirtable(tableId, fields, env) {
  const res = await fetch(airtableTableUrl(env, tableId), {
    method: 'POST',
    headers: airtableHeaders(env),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${redactAirtableError(await res.text())}`);
  return res.json();
}

// ── Altitude Subscribers mirror ───────────────────────────────────────────────
// Per docs/superpowers/specs/2026-08-24-altitude-airtable-subscriber-sync-design.md.
// Upserts by Email since a member's row needs updating across their whole
// lifecycle (renewal, plan change, cancellation), not just created once at
// signup. Never throws -- callers already wrap every non-critical side effect
// in .catch(() => {}), and a failed sync here should never block the Stripe
// webhook's 200 response. On failure, best-effort a second, minimal write
// of just the error so it's visible in Airtable without needing worker logs.
export async function upsertAltitudeSubscriber(email, fields, env) {
  if (!env.AIRTABLE_TABLE_ALTITUDE_SUBSCRIBERS || !env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) return;

  const table = env.AIRTABLE_TABLE_ALTITUDE_SUBSCRIBERS;
  const now = new Date().toISOString();
  const body = { ...fields, 'Last Synced At': now };
  let existingId = null;

  try {
    const params = new URLSearchParams({
      filterByFormula: `{Email}="${email.replace(/"/g, '\\"')}"`,
      maxRecords: '1',
    });
    params.append('fields[]', 'Email');

    const findRes = await fetch(airtableTableUrl(env, table, params), { headers: airtableHeaders(env) });
    if (!findRes.ok) throw new Error(`Airtable lookup ${findRes.status}: ${redactAirtableError(await findRes.text())}`);
    const found = await findRes.json();
    existingId = found.records?.[0]?.id || null;

    if (existingId) {
      const res = await fetch(`${airtableTableUrl(env, table)}/${existingId}`, {
        method: 'PATCH',
        headers: airtableHeaders(env),
        body: JSON.stringify({ fields: body }),
      });
      if (!res.ok) throw new Error(`Airtable ${res.status}: ${redactAirtableError(await res.text())}`);
    } else {
      await writeToAirtable(table, body, env);
    }
  } catch (err) {
    console.error(`[altitude-subscribers-sync] failed for ${email}: ${String(err.message || err).slice(0, 200)}`);
    // Best-effort visibility write. If we know which existing row this was
    // for, flag the error on that same row rather than risk a duplicate --
    // only create a new error-only row when we never resolved an existing
    // id at all (e.g. the lookup itself failed).
    const errorFields = { 'Last Synced At': now, 'Last Sync Error': String(err.message || err).slice(0, 500) };
    if (existingId) {
      await fetch(`${airtableTableUrl(env, table)}/${existingId}`, {
        method: 'PATCH',
        headers: airtableHeaders(env),
        body: JSON.stringify({ fields: errorFields }),
      }).catch(() => {});
    } else {
      await writeToAirtable(table, { 'Email': email, ...errorFields }, env).catch(() => {});
    }
  }
}

export async function handleFlightApplication(request, env, corsHeaders) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `${KV_PREFIX.RL_AIRTABLE_FLIGHT}${ip}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= 3) {
    return respond({ error: 'rate_limited' }, 429, corsHeaders);
  }

  let body;
  try { body = await request.json(); }
  catch { return respond({ error: 'invalid_body' }, 400, corsHeaders); }

  if (body['bot-field']) return respond({ success: true }, 200, corsHeaders);

  // Count every real (non-honeypot) attempt here, regardless of outcome —
  // matches the root subscribe route's convention, so validation/Airtable
  // failures can't be retried past the limit for free.
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  const name        = (body['full-name']   || '').trim().slice(0, 200);
  const email       = (body['email']       || '').trim().toLowerCase().slice(0, 200);
  const from        = (body['from']        || '').trim().slice(0, 200);
  const destination = (body['destination'] || '').trim().slice(0, 2000);
  const about       = (body['about']       || '').trim().slice(0, 300);

  if (!name || !destination || !about) {
    return respond({ error: 'missing_fields' }, 400, corsHeaders);
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond({ error: 'invalid_email' }, 400, corsHeaders);
  }

  const q = Math.ceil((new Date().getMonth() + 1) / 3);
  const quarter = `Q${q} ${new Date().getFullYear()}`;

  try {
    await writeToAirtable(env.AIRTABLE_TABLE_FLIGHT_APPLICATIONS, {
      'Name': name,
      'Email': email,
      'From': from,
      'Destination': destination,
      'About': about,
      'Status': 'New',
      'Quarter': quarter,
      'Source': 'website',
      'Submission Date': new Date().toISOString().split('T')[0],
    }, env);
  } catch (err) {
    console.error('Airtable flight application error:', err.message);
    return respond({ error: 'submission_failed' }, 500, corsHeaders);
  }

  return respond({ success: true }, 200, corsHeaders);
}

export async function handlePostTestimonial(request, env, corsHeaders) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `${KV_PREFIX.RL_AIRTABLE_TESTIMONIAL}${ip}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= 5) {
    return respond({ error: 'rate_limited' }, 429, corsHeaders);
  }

  let body;
  try { body = await request.json(); }
  catch { return respond({ error: 'invalid_body' }, 400, corsHeaders); }

  if (body['bot-field']) return respond({ success: true }, 200, corsHeaders);

  // Count every real (non-honeypot) attempt here, regardless of outcome —
  // matches the root subscribe route's convention, so validation/Airtable
  // failures can't be retried past the limit for free.
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  const name        = (body['name']        || '').trim().slice(0, 200);
  const email       = (body['email']       || '').trim().toLowerCase().slice(0, 200);
  const role        = (body['role']        || '').trim().slice(0, 100);
  const rating      = parseInt(body['rating'], 10);
  const testimonial = (body['testimonial'] || '').trim().slice(0, 2000);
  const imageUrl    = (body['image_url']   || '').trim().slice(0, 2000);
  const route       = (body['route']       || '').trim().slice(0, 100);
  const airline     = (body['airline']     || '').trim().slice(0, 100);

  // Optional 1-5 sub-ratings for the specific flight (Value/Comfort/Service).
  // Unlike the required overall `rating`, these are skippable — an invalid or
  // missing value is just treated as "not rated," never defaulted or guessed.
  const parseOptionalRating = (v) => {
    const n = parseInt(v, 10);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };
  const valueRating   = parseOptionalRating(body['value_rating']);
  const comfortRating = parseOptionalRating(body['comfort_rating']);
  const serviceRating = parseOptionalRating(body['service_rating']);
  const foodRating    = parseOptionalRating(body['food_rating']);

  if (!name || !role || !testimonial) {
    return respond({ error: 'missing_fields' }, 400, corsHeaders);
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return respond({ error: 'invalid_rating' }, 400, corsHeaders);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond({ error: 'invalid_email' }, 400, corsHeaders);
  }
  if (imageUrl && !/^https:\/\/res\.cloudinary\.com\//.test(imageUrl)) {
    return respond({ error: 'invalid_image_url' }, 400, corsHeaders);
  }

  try {
    await writeToAirtable(env.AIRTABLE_TABLE_TESTIMONIALS, {
      'Name': name,
      'Role': role,
      'Rating': rating,
      'Testimonial': testimonial,
      ...(email ? { 'Email': email } : {}),
      ...(imageUrl ? { 'Profile Image': [{ url: imageUrl }] } : {}),
      // Route is a multipleSelects field in Airtable whose choices are full
      // labels ("London (LHR)"), but the form submits just the IATA code
      // ("LHR") — map through ROUTE_LABELS before writing, or Airtable
      // rejects the value outright (no matching choice) and the whole
      // submission 500s. Also multipleSelects, so wrap in a one-element
      // array — multi-route tagging is done by staff directly in Airtable
      // (see recYeN1EAZPwbDNom for a real example).
      ...(route && ROUTE_LABELS[route.toUpperCase()] ? { 'Route': [ROUTE_LABELS[route.toUpperCase()]] } : {}),
      ...(airline ? { 'Airline': airline } : {}),
      ...(valueRating   ? { 'Value Rating':   valueRating   } : {}),
      ...(comfortRating ? { 'Comfort Rating': comfortRating } : {}),
      ...(serviceRating ? { 'Service Rating': serviceRating } : {}),
      ...(foodRating    ? { 'Food Rating':    foodRating    } : {}),
      'Approved': false,
      'Featured': false,
    }, env);
  } catch (err) {
    console.error('Airtable testimonial error:', err.message);
    return respond({ error: 'submission_failed' }, 500, corsHeaders);
  }

  return respond({ success: true }, 200, corsHeaders);
}

export async function handleGetTestimonials(request, env, corsHeaders) {
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') || 'all';
  const requestedLimit = parseInt(url.searchParams.get('limit'), 10);
  const pageOffset = url.searchParams.get('offset') || '';
  const routeCode = (url.searchParams.get('route') || '').trim().toUpperCase();
  const airline = (url.searchParams.get('airline') || '').trim().slice(0, 100);

  const isFeatured = scope === 'featured';
  // Homepage (featured): hard-capped single fetch, no pagination.
  // Archive (all): paginated — pageSize is per-page, offset continues from a prior response.
  const limit = Math.min(
    Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : (isFeatured ? 3 : 9),
    isFeatured ? 12 : 100
  );

  // Homepage: strictly Approved AND Featured — no backfill with non-featured
  // approved testimonials. Archive / Cabin Compare: every Approved testimonial,
  // optionally narrowed further to a specific route and/or airline.
  const routeLabel = ROUTE_LABELS[routeCode];
  // An explicitly-requested but unrecognized route code can't match any
  // testimonial — return no results rather than silently dropping the
  // filter and returning everything. Matches handleGetTestimonialScores'
  // handling of the same case. A route code that was never provided at all
  // (routeCode === '') is unaffected — that's the normal "no filter" case.
  if (routeCode && !routeLabel) {
    return respond(
      { testimonials: [], offset: null },
      200,
      { ...corsHeaders, 'Cache-Control': 'public, max-age=60' }
    );
  }

  const formulaParts = [isFeatured ? 'AND({Approved}=1,{Featured}=1)' : '{Approved}=1'];
  if (routeLabel) formulaParts.push(`FIND("${routeLabel.replace(/"/g, '\\"')}", ARRAYJOIN({Route}))`);
  if (airline) formulaParts.push(`{Airline}="${airline.replace(/"/g, '\\"')}"`);
  const filterByFormula = formulaParts.length > 1 ? `AND(${formulaParts.join(',')})` : formulaParts[0];

  const params = new URLSearchParams({ filterByFormula });
  params.append(isFeatured ? 'maxRecords' : 'pageSize', String(limit));
  if (!isFeatured && pageOffset) params.set('offset', pageOffset);
  ['Name', 'Role', 'Rating', 'Testimonial', 'Profile Image', 'Route', 'Airline'].forEach(f => params.append('fields[]', f));
  params.append('sort[0][field]', 'Date Submitted');
  params.append('sort[0][direction]', 'desc');

  let res;
  try {
    res = await fetch(
      `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_TESTIMONIALS}?${params.toString()}`,
      { headers: { 'Authorization': `Bearer ${env.AIRTABLE_API_KEY}` } }
    );
  } catch {
    return respond({ error: 'Gateway error' }, 502, corsHeaders);
  }

  if (!res.ok) return respond({ error: 'Airtable API error' }, res.status, corsHeaders);

  const raw = await res.json();
  const testimonials = (raw.records || []).map(rec => ({
    id: rec.id,
    name: rec.fields['Name'] || '',
    role: rec.fields['Role'] || '',
    rating: rec.fields['Rating'] || 0,
    quote: rec.fields['Testimonial'] || '',
    image: rec.fields['Profile Image']?.[0]?.url || '',
    route: rec.fields['Route'] || [],
    airline: rec.fields['Airline'] || '',
  }));

  return respond(
    { testimonials, offset: raw.offset || null },
    200,
    { ...corsHeaders, 'Cache-Control': 'public, max-age=60' }
  );
}

// Cabin Compare's "Skyfare score" — a real average of customer-submitted
// Value/Comfort/Service ratings for one route+airline, never a static or
// editorially-typed number. Averages only over records that actually have
// each field set (a reviewer may rate Comfort but skip Value, etc.), and
// returns null for any dimension with zero data yet — the frontend leaves
// that dimension out rather than showing a fabricated 0.
export async function handleGetTestimonialScores(request, env, corsHeaders) {
  const url = new URL(request.url);
  const routeCode = (url.searchParams.get('route') || '').trim().toUpperCase();
  const airline = (url.searchParams.get('airline') || '').trim().slice(0, 100);
  const routeLabel = ROUTE_LABELS[routeCode];

  if (!routeLabel || !airline) {
    return respond({ value: null, comfort: null, service: null, food: null, count: 0 }, 200, corsHeaders);
  }

  const filterByFormula = `AND({Approved}=1,FIND("${routeLabel.replace(/"/g, '\\"')}", ARRAYJOIN({Route})),{Airline}="${airline.replace(/"/g, '\\"')}")`;
  const params = new URLSearchParams({ filterByFormula, pageSize: '100' });
  ['Value Rating', 'Comfort Rating', 'Service Rating', 'Food Rating'].forEach(f => params.append('fields[]', f));

  let res;
  try {
    res = await fetch(
      `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_TESTIMONIALS}?${params.toString()}`,
      { headers: { 'Authorization': `Bearer ${env.AIRTABLE_API_KEY}` } }
    );
  } catch {
    return respond({ error: 'Gateway error' }, 502, corsHeaders);
  }
  if (!res.ok) return respond({ error: 'Airtable API error' }, res.status, corsHeaders);

  const raw = await res.json();
  const records = raw.records || [];

  // Each dimension is averaged only from records that actually rated it — a
  // testimonial can rate Comfort but skip Value, so the three dimensions can
  // legitimately have different sample sizes. Returning one blanket "count"
  // for all three (e.g. total matching records) would overstate how many
  // people actually backed each individual number.
  const rate = (fieldName) => {
    const values = records
      .map(rec => rec.fields[fieldName])
      .filter(v => Number.isInteger(v) && v >= 1 && v <= 5);
    return { avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, n: values.length };
  };

  const value = rate('Value Rating');
  const comfort = rate('Comfort Rating');
  const service = rate('Service Rating');
  const food = rate('Food Rating');
  // "count" = records that rated at least one dimension — an honest "how many
  // flight ratings do we have" number, distinct from raw matching-record count
  // (some matches may have left a testimonial without rating anything).
  const ratedCount = records.filter(rec =>
    Number.isInteger(rec.fields['Value Rating']) ||
    Number.isInteger(rec.fields['Comfort Rating']) ||
    Number.isInteger(rec.fields['Service Rating']) ||
    Number.isInteger(rec.fields['Food Rating'])
  ).length;

  return respond(
    {
      value: value.avg, valueCount: value.n,
      comfort: comfort.avg, comfortCount: comfort.n,
      service: service.avg, serviceCount: service.n,
      food: food.avg, foodCount: food.n,
      count: ratedCount,
    },
    200,
    { ...corsHeaders, 'Cache-Control': 'public, max-age=60' }
  );
}

// Public KrisFlyer route/mileage chart — Popular Routes (homepage) and the
// KrisFlyer page's Mileage Route Explorer + Route board both read this. No
// Approved/Status gate (every row in the table is real, published pricing),
// and no Altitude entitlement check — this is public marketing content.
export async function handleGetSkyfareRoutes(request, env, corsHeaders) {
  if (!env.AIRTABLE_TABLE_SKYFARE_ROUTES) {
    return respond({ error: 'airtable_table_not_configured' }, 503, corsHeaders);
  }

  const params = new URLSearchParams({ pageSize: '100' });
  [
    'Destination', 'IATA Code', 'Country', 'Region', 'KrisFlyer Zone',
    'Business Saver (One-Way, Miles)', 'Business Advantage (One-Way, Miles)',
    'Business Saver (Return, Miles)', 'Business Advantage (Return, Miles)',
    'Notes',
  ].forEach(f => params.append('fields[]', f));
  params.append('sort[0][field]', 'Region');
  params.append('sort[1][field]', 'Business Saver (One-Way, Miles)');
  params.append('sort[1][direction]', 'asc');

  let res;
  try {
    res = await fetch(airtableTableUrl(env, env.AIRTABLE_TABLE_SKYFARE_ROUTES, params), { headers: airtableHeaders(env) });
  } catch {
    return respond({ error: 'Gateway error' }, 502, corsHeaders);
  }

  if (!res.ok) return respond({ error: 'Airtable API error' }, res.status, corsHeaders);

  const raw = await res.json();
  const routes = (raw.records || []).map(rec => ({
    id: rec.id,
    destination: rec.fields['Destination'] || '',
    iataCode: rec.fields['IATA Code'] || '',
    country: rec.fields['Country'] || '',
    region: rec.fields['Region'] || '',
    krisFlyerZone: rec.fields['KrisFlyer Zone'] || '',
    saverOneWay: rec.fields['Business Saver (One-Way, Miles)'] || null,
    advantageOneWay: rec.fields['Business Advantage (One-Way, Miles)'] || null,
    saverReturn: rec.fields['Business Saver (Return, Miles)'] || null,
    advantageReturn: rec.fields['Business Advantage (Return, Miles)'] || null,
    notes: rec.fields['Notes'] || '',
  }));

  return respond(
    { routes },
    200,
    { ...corsHeaders, 'Cache-Control': 'public, max-age=300' }
  );
}

// Cabin Compare — route x airline comparison data, joined server-side from
// three linked tables (Cabin Compare Routes, Seat Products, Cabin Compare
// Options) into the shape js/cabin-compare.js's render() already expects.
// Public, unauthenticated -- marketing content, not gated Altitude content.
// Every option row is returned regardless of its Verified checkbox: Verified
// is an internal "confirmed by Sahej" marker for the team to work through in
// Airtable, not a display filter (the frontend shows the same placeholder
// disclaimer it already did with the old hardcoded data).
export async function handleGetCabinCompare(request, env, corsHeaders) {
  if (!env.AIRTABLE_TABLE_CABIN_COMPARE_ROUTES || !env.AIRTABLE_TABLE_SEAT_PRODUCTS || !env.AIRTABLE_TABLE_CABIN_COMPARE_OPTIONS) {
    return respond({ error: 'airtable_table_not_configured' }, 503, corsHeaders);
  }

  function fetchTable(tableId, fields) {
    const params = new URLSearchParams({ pageSize: '100' });
    fields.forEach(f => params.append('fields[]', f));
    return fetch(airtableTableUrl(env, tableId, params), { headers: airtableHeaders(env) });
  }

  let routesRes, seatsRes, optionsRes;
  try {
    [routesRes, seatsRes, optionsRes] = await Promise.all([
      fetchTable(env.AIRTABLE_TABLE_CABIN_COMPARE_ROUTES, ['Destination', 'IATA Code', 'Region', 'Flight Time', 'Distance (km)']),
      fetchTable(env.AIRTABLE_TABLE_SEAT_PRODUCTS, ['Seat Description', 'Width', 'Bed Length', 'Aisle Access (All Seats)', 'WiFi']),
      fetchTable(env.AIRTABLE_TABLE_CABIN_COMPARE_OPTIONS, [
        'Route', 'Airline', 'Flight Numbers', 'Aircraft', 'Seat Product',
        'Cash Low (SGD)', 'Cash High (SGD)', 'Cash Note', 'Miles Amount', 'Miles Program',
        'Skyfare Pick', 'Editorial Tags', 'Verified', 'SQ Saver Miles (One-Way, via Skyfare Routes)',
      ]),
    ]);
  } catch {
    return respond({ error: 'Gateway error' }, 502, corsHeaders);
  }

  if (!routesRes.ok || !seatsRes.ok || !optionsRes.ok) {
    return respond({ error: 'Airtable API error' }, 502, corsHeaders);
  }

  const [routesRaw, seatsRaw, optionsRaw] = await Promise.all([routesRes.json(), seatsRes.json(), optionsRes.json()]);

  const seatById = {};
  (seatsRaw.records || []).forEach(rec => {
    seatById[rec.id] = {
      seat: rec.fields['Seat Description'] || '',
      width: rec.fields['Width'] || '',
      bed: rec.fields['Bed Length'] || '',
      aisle: !!rec.fields['Aisle Access (All Seats)'],
      wifi: rec.fields['WiFi'] || '',
    };
  });

  const routeById = {};
  (routesRaw.records || []).forEach(rec => {
    const destination = rec.fields['Destination'] || '';
    // Strip a trailing "(...)" qualifier -- e.g. "London (LHR)" -> "London"
    // -- the IATA code the render already uses for the code badge comes from
    // the dedicated IATA Code field below, not this parsed name.
    const name = destination.replace(/\s*\([^)]*\)\s*$/, '').trim() || destination;
    const flightTime = rec.fields['Flight Time'] || '';
    const distance = rec.fields['Distance (km)'];
    routeById[rec.id] = {
      code: rec.fields['IATA Code'] || '',
      name,
      region: rec.fields['Region'] || '',
      meta: distance ? `${flightTime} · ${Number(distance).toLocaleString()} km` : flightTime,
    };
  });

  const routes = {};
  (optionsRaw.records || []).forEach(rec => {
    const routeRecId = (rec.fields['Route'] || [])[0];
    const routeInfo = routeRecId && routeById[routeRecId];
    if (!routeInfo || !routeInfo.code) return;

    const seatRecId = (rec.fields['Seat Product'] || [])[0];
    const seatInfo = (seatRecId && seatById[seatRecId]) || {};

    const sqLookup = rec.fields['SQ Saver Miles (One-Way, via Skyfare Routes)'];
    const milesAmount = rec.fields['Miles Amount'] ?? (Array.isArray(sqLookup) && sqLookup.length ? sqLookup[0] : null);

    if (!routes[routeInfo.code]) {
      routes[routeInfo.code] = { name: routeInfo.name, region: routeInfo.region, meta: routeInfo.meta, airlines: [] };
    }

    routes[routeInfo.code].airlines.push({
      name: rec.fields['Airline'] || '',
      sub: rec.fields['Flight Numbers'] || '',
      aircraft: rec.fields['Aircraft'] || '',
      seat: seatInfo.seat || '',
      width: seatInfo.width || '',
      bed: seatInfo.bed || '',
      aisle: !!seatInfo.aisle,
      wifi: seatInfo.wifi || '',
      cashLow: rec.fields['Cash Low (SGD)'] ?? null,
      cashHigh: rec.fields['Cash High (SGD)'] ?? null,
      cashNote: rec.fields['Cash Note'] || '',
      milesAmount: milesAmount ?? null,
      milesProgram: rec.fields['Miles Program'] || '',
      pick: !!rec.fields['Skyfare Pick'],
      tags: rec.fields['Editorial Tags'] || [],
      verified: !!rec.fields['Verified'],
    });
  });

  return respond(
    { routes },
    200,
    { ...corsHeaders, 'Cache-Control': 'public, max-age=300' }
  );
}

// ── Altitude member CMS content ───────────────────────────────────────────────
// Private read endpoints for the first Airtable-backed Altitude pages. These
// reuse the same Altitude entitlement decision as /altitude/verify before any
// premium CMS rows leave the Worker.

const ALTITUDE_CONTENT_TYPES = {
  'award-alerts': {
    envKey: 'AIRTABLE_TABLE_ALTITUDE_AWARD_ALERTS',
    fields: [
      'Title', 'Slug', 'Status', 'Featured', 'Publish Date', 'Display Order', 'Short Description', 'Tags', 'Thumbnail', 'Last Updated',
      'Urgency', 'Origin', 'Destination', 'Airline', 'Program', 'Cabin Class', 'Aircraft', 'Seats Available', 'Miles Required', 'Taxes / Fees',
      'Travel Date Start', 'Travel Date End', 'Found At', 'Availability Notes', 'Booking Notes', 'Fallback Strategy', 'Availability Calendar JSON',
    ],
    normalize: normalizeAwardAlert,
  },
  'routing-strategies': {
    envKey: 'AIRTABLE_TABLE_ALTITUDE_ROUTING_STRATEGIES',
    fields: [
      'Title', 'Slug', 'Status', 'Featured', 'Publish Date', 'Display Order', 'Short Description', 'Tags', 'Thumbnail', 'Last Updated',
      'Origin', 'Destination', 'Recommended Route', 'Backup Route', 'Confidence Score', 'Strategy Verdict', 'Path Options JSON',
      'Why This Wins', 'When To Switch', 'Member Action',
    ],
    normalize: normalizeRoutingStrategy,
  },
  'krisflyer-escapes': {
    envKey: 'AIRTABLE_TABLE_ALTITUDE_KRISFLYER_ESCAPES',
    fields: [
      'Title', 'Slug', 'Status', 'Featured', 'Publish Date', 'Display Order', 'Short Description', 'Tags', 'Thumbnail', 'Last Updated',
      'Drop Month', 'Booking Window', 'Travel Window', 'Summary Verdict', 'Routes Count', 'Book Fast Count', 'Consider Count', 'Skip Count',
      'Route Rows JSON', 'Route Grid JSON', 'Discount', 'Grid Note', 'Newsletter URL',
    ],
    normalize: normalizeKrisFlyerEscape,
  },
};

export async function handleGetAltitudeContent(request, env, corsHeaders, type) {
  const config = ALTITUDE_CONTENT_TYPES[type];
  if (!config) return respond({ error: 'not_found' }, 404, corsHeaders);

  const access = await verifyAltitudeRequest(request, env);
  if (!access.ok) return respond(access.data, access.status, corsHeaders);

  const table = env[config.envKey];
  if (!table) return respond({ error: 'airtable_table_not_configured', type }, 503, corsHeaders);
  if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) {
    return respond({ error: 'airtable_not_configured' }, 503, corsHeaders);
  }

  const params = new URLSearchParams({ filterByFormula: '{Status}="Published"', pageSize: '50' });
  config.fields.forEach(f => params.append('fields[]', f));
  params.append('sort[0][field]', 'Display Order');
  params.append('sort[0][direction]', 'asc');
  params.append('sort[1][field]', 'Publish Date');
  params.append('sort[1][direction]', 'desc');

  let res;
  try {
    res = await fetch(airtableTableUrl(env, table, params), { headers: airtableHeaders(env) });
  } catch {
    return respond({ error: 'Gateway error' }, 502, corsHeaders);
  }

  if (!res.ok) {
    console.error(`Altitude content Airtable error (${type}):`, redactAirtableError(await res.text()));
    return respond({ error: 'Airtable API error' }, res.status, corsHeaders);
  }

  const raw = await res.json();
  const records = (raw.records || [])
    .map(rec => config.normalize(rec))
    .filter(item => item && item.title);

  return respond(
    { type, records },
    200,
    { ...corsHeaders, 'Cache-Control': 'private, no-store' }
  );
}

function normalizeBaseContent(rec) {
  const f = rec.fields || {};
  const featuredValue = f['Featured'];
  return {
    id: rec.id,
    title: text(f['Title']),
    slug: text(f['Slug']),
    status: text(f['Status']),
    featured: featuredValue === true || String(featuredValue || '').toLowerCase() === 'yes',
    publishDate: text(f['Publish Date']),
    displayOrder: number(f['Display Order']),
    shortDescription: text(f['Short Description']),
    tags: array(f['Tags']),
    thumbnail: attachmentUrl(f['Thumbnail']),
    lastUpdated: text(f['Last Updated']),
  };
}

function normalizeAwardAlert(rec) {
  const f = rec.fields || {};
  return {
    ...normalizeBaseContent(rec),
    urgency: text(f['Urgency']),
    origin: text(f['Origin']),
    destination: text(f['Destination']),
    airline: text(f['Airline']),
    program: text(f['Program']),
    cabinClass: text(f['Cabin Class']),
    aircraft: text(f['Aircraft']),
    seatsAvailable: number(f['Seats Available']),
    milesRequired: text(f['Miles Required']),
    taxesFees: text(f['Taxes / Fees']),
    travelDateStart: text(f['Travel Date Start']),
    travelDateEnd: text(f['Travel Date End']),
    foundAt: text(f['Found At']),
    availabilityNotes: text(f['Availability Notes']),
    bookingNotes: text(f['Booking Notes']),
    fallbackStrategy: text(f['Fallback Strategy']),
    availabilityCalendar: jsonObject(f['Availability Calendar JSON']),
  };
}

function normalizeRoutingStrategy(rec) {
  const f = rec.fields || {};
  return {
    ...normalizeBaseContent(rec),
    origin: text(f['Origin']),
    destination: text(f['Destination']),
    recommendedRoute: text(f['Recommended Route']),
    backupRoute: text(f['Backup Route']),
    confidenceScore: number(f['Confidence Score']),
    strategyVerdict: text(f['Strategy Verdict']),
    pathOptions: jsonArray(f['Path Options JSON']),
    whyThisWins: text(f['Why This Wins']),
    whenToSwitch: text(f['When To Switch']),
    memberAction: text(f['Member Action']),
  };
}

function normalizeKrisFlyerEscape(rec) {
  const f = rec.fields || {};
  return {
    ...normalizeBaseContent(rec),
    dropMonth: text(f['Drop Month']),
    bookingWindow: text(f['Booking Window']),
    travelWindow: text(f['Travel Window']),
    summaryVerdict: text(f['Summary Verdict']),
    routesCount: number(f['Routes Count']),
    bookFastCount: number(f['Book Fast Count']),
    considerCount: number(f['Consider Count']),
    skipCount: number(f['Skip Count']),
    routeRows: jsonArray(f['Route Rows JSON']),
    routeGrid: jsonObject(f['Route Grid JSON']),
    discount: text(f['Discount']),
    gridNote: text(f['Grid Note']),
    newsletterUrl: text(f['Newsletter URL']),
  };
}

function text(value) {
  return value == null ? '' : String(value);
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function array(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function attachmentUrl(value) {
  return Array.isArray(value) && value[0] && value[0].url ? value[0].url : '';
}

function jsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Same shape-tolerant parsing as jsonArray() above, but for JSON blob
// fields that store an object (e.g. "Availability Calendar JSON":
// {saver:{...}, advantage:{...}}) rather than an array -- jsonArray()
// would silently drop these since it only ever returns [].
function jsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// ── Travel Strategy Call bookings ─────────────────────────────────────────────
// Called from orchestration/calcomWebhook.js only, on Cal.com's
// BOOKING_CREATED event -- the ONLY point this table gets written to.
// Payment success (orchestration/stripeWebhook.js) deliberately does NOT
// write here: Airtable is meant to record confirmed bookings, not payments,
// per the required flow (pay -> Beehiiv tags + emails the booking link ->
// buyer books on Cal.com -> only then does Airtable get a row). Not exposed
// as its own POST /airtable/* route since the caller already runs
// server-side inside a webhook handler, not a public form submission.
export async function createAssessmentBooking({ email, name, notes, bookingUid, slotStart, possibleDuplicate }, env) {
  return writeToAirtable(env.AIRTABLE_TABLE_ASSESSMENT_BOOKINGS, {
    'Email': email,
    // Name and Notes are both optional on Cal.com's own booking form -- only
    // write them when the attendee actually filled them in, rather than an
    // empty string.
    ...(name ? { 'Name': name } : {}),
    ...(notes ? { 'Notes': notes } : {}),
    'Status': 'Booked',
    'Booking UID': bookingUid || '',
    'Slot Start': slotStart || '',
    ...(possibleDuplicate ? { 'Possible Duplicate': true } : {}),
  }, env);
}

// Cal.com has no built-in per-attendee booking limit (only a per-event-type
// total cap -- see https://github.com/calcom/cal.com/issues/21546), so this
// is the enforcement point instead: called from
// orchestration/calcomWebhook.js right before createAssessmentBooking, to
// flag (not block) a second booking from the same email. Deliberately a soft
// flag, not an auto-cancel -- a second call might be legitimate (Sahej
// offering a follow-up), so this just surfaces it for a human to check.
export async function hasExistingAssessmentBooking(email, env) {
  const filterByFormula = `AND({Email}="${email.replace(/"/g, '\\"')}",{Status}="Booked")`;
  const params = new URLSearchParams({ filterByFormula, maxRecords: '1' });
  ['Email'].forEach(f => params.append('fields[]', f));

  const res = await fetch(
    `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_ASSESSMENT_BOOKINGS}?${params.toString()}`,
    { headers: { 'Authorization': `Bearer ${env.AIRTABLE_API_KEY}` } }
  );
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);

  const { records } = await res.json();
  return (records || []).length > 0;
}
