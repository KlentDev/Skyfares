// services/calendly.js
// No Calendly API integration exists anywhere in this repo (only a plain <a href> booking
// link in index.html / pages/assessment.html). Wiring this up for real would need a Calendly
// Personal Access Token (CALENDLY_API_TOKEN secret) and the organizer's user URI, then a call
// to GET https://api.calendly.com/scheduled_events filtered by min_start_time/max_start_time.
export async function getCalendlySummary() {
  return { status: "not_connected", label: "Calendly" };
}
