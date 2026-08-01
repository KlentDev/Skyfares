// services/airtable.js — flight applications, contact inquiries, and
// testimonials. A clean leaf module: only talks to Airtable, no Stripe/Beehiiv.
import { respond } from '../utils/http.js';
import { ROUTE_LABELS, KV_PREFIX } from '../config/constants.js';

async function writeToAirtable(tableId, fields, env) {
  const res = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${tableId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
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

export async function handleContactInquiry(request, env, corsHeaders) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `${KV_PREFIX.RL_AIRTABLE_CONTACT}${ip}`;
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

  const name    = (body['name']    || '').trim().slice(0, 200);
  const email   = (body['email']   || '').trim().toLowerCase().slice(0, 200);
  const subject = (body['subject'] || '').trim().slice(0, 300);
  const message = (body['message'] || '').trim().slice(0, 5000);

  if (!name || !message) {
    return respond({ error: 'missing_fields' }, 400, corsHeaders);
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond({ error: 'invalid_email' }, 400, corsHeaders);
  }

  try {
    await writeToAirtable(env.AIRTABLE_TABLE_CONTACT_INQUIRIES, {
      'Name': name,
      'Email': email,
      'Subject': subject || '(no subject)',
      'Message': message,
      'Status': 'New',
      'Source': 'website',
      'Submission Date': new Date().toISOString().split('T')[0],
    }, env);
  } catch (err) {
    console.error('Airtable contact error:', err.message);
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
