// utils/dates.js
// All window math is done against Asia/Manila calendar dates (UTC+8, no DST) via Intl,
// then converted to UTC instants for use in Beehiiv/Airtable date-range filters.
import { TIMEZONE } from "../config/constants.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const FIVE_MIN_MS = 5 * 60 * 1000;
const EIGHT_AM_MS = 8 * 60 * 60 * 1000;

function getManilaDateParts(date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return { year: +parts.year, month: +parts.month, day: +parts.day };
}

export function manilaDateKey(date) {
  const p = getManilaDateParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** 0=Sunday..6=Saturday on the Manila calendar. */
export function getManilaWeekdayIndex(date) {
  const p = getManilaDateParts(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** Is this instant a Sunday on the Manila calendar? Used to decide whether the daily report
 * being sent right now (which covers the PREVIOUS Manila day) should also trigger the weekly
 * report — a full Monday-Sunday week, sent the following Monday — see worker.js. */
export function isManilaSunday(date) {
  return getManilaWeekdayIndex(date) === 0;
}

/** The current hour (0-23) and day-of-month on the Manila calendar — used by worker.js's
 * cron trigger (fires at :05 past hour 0 and hour 8) to tell the two firings apart. */
export function getManilaHourAndDay(date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return { hour: +parts.hour, day: +parts.day };
}

export function startOfManilaDayUtc(date) {
  const p = getManilaDateParts(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0) - MANILA_OFFSET_MS);
}

// Standard ISO-8601 week number, computed against the Manila calendar date.
export function getIsoWeekKey(date) {
  const p = getManilaDateParts(date);
  const dt = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const dayNr = (dt.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  dt.setUTCDate(dt.getUTCDate() - dayNr + 3); // shift to nearest Thursday
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const firstThursdayDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNr + 3);
  const weekNumber = 1 + Math.round((dt.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${dt.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function getPreviousMonthYm(date) {
  const p = getManilaDateParts(date);
  let year = p.year;
  let month = p.month - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return { year, month };
}

export function monthKey({ year, month }) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthWindowUtc({ year, month }) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - MANILA_OFFSET_MS);
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const end = new Date(Date.UTC(next.year, next.month - 1, 1, 0, 0, 0) - MANILA_OFFSET_MS);
  return { start, end };
}

/**
 * Window covering the FULL previous Manila calendar day (00:00–24:00) — sent at 00:05 the
 * following day, so by send time the day being reported has genuinely finished. `runDate` is
 * the send instant (e.g. Tuesday 00:05); the window covers Monday.
 */
export function getDailyWindow(runDate) {
  const sendDayStart = startOfManilaDayUtc(runDate); // Tuesday 00:00 — the day the report is SENT
  const reportDayStart = new Date(sendDayStart.getTime() - DAY_MS); // Monday 00:00 — the day being REPORTED
  return {
    start: reportDayStart,
    end: sendDayStart,
    periodKey: manilaDateKey(reportDayStart), // dated by the reported day, not the send day
    previousPeriodKey: manilaDateKey(new Date(reportDayStart.getTime() - DAY_MS)),
  };
}

/**
 * Window covering a FULL Monday-Sunday calendar week (7 days, not just business days — the
 * site runs 24/7 and gets weekend activity too) — sent at 00:05 the following Monday, alongside
 * that day's daily report (which covers Sunday, the last day of the completed week).
 */
export function getWeeklyWindow(runDate) {
  const endExclusive = startOfManilaDayUtc(runDate); // Monday 00:00 — end of the completed week
  const start = new Date(endExclusive.getTime() - 7 * DAY_MS); // previous Monday 00:00
  const previousWeekMonday = new Date(start.getTime() - 7 * DAY_MS);
  return {
    start,
    end: endExclusive,
    periodKey: getIsoWeekKey(start),
    previousPeriodKey: getIsoWeekKey(previousWeekMonday),
  };
}

/** Window covering the full previous calendar month (report runs on the 1st, summarizing last month). */
export function getMonthlyWindow(runDate) {
  const ym = getPreviousMonthYm(runDate);
  const { start, end } = monthWindowUtc(ym);
  const prevYm = getPreviousMonthYm(start);
  return {
    start,
    end,
    periodKey: monthKey(ym),
    previousPeriodKey: monthKey(prevYm),
  };
}

/** The `n` Manila calendar-date keys strictly before `referenceDate`'s date. Pass the reported
 * day's start (window.start), not the send instant, so "trailing days" means the days before
 * what's being reported, not before when the report happens to be sent. */
export function getTrailingDailyDateKeys(n, referenceDate) {
  const refStart = startOfManilaDayUtc(referenceDate);
  const keys = [];
  for (let i = 1; i <= n; i++) {
    keys.push(manilaDateKey(new Date(refStart.getTime() - i * DAY_MS)));
  }
  return keys;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatManilaDateLong(date) {
  const p = getManilaDateParts(date);
  const weekday = WEEKDAY_NAMES[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()];
  return `${weekday}, ${MONTH_NAMES[p.month - 1]} ${p.day}, ${p.year}`;
}

/** "July 6, 2026" — no weekday prefix, for headers that put the weekday name elsewhere (e.g. "DAILY REPORT MONDAY: July 6, 2026"). */
export function formatManilaDateNoWeekday(date) {
  const p = getManilaDateParts(date);
  return `${MONTH_NAMES[p.month - 1]} ${p.day}, ${p.year}`;
}

/** "MONDAY" — all-caps weekday name, for the "DAILY REPORT {WEEKDAY}:" title prefix. */
export function getManilaWeekdayUpper(date) {
  const p = getManilaDateParts(date);
  return WEEKDAY_NAMES[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()].toUpperCase();
}

export function formatManilaTimeShort(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatManilaDateRange(start, end) {
  const startParts = getManilaDateParts(start);
  // `end` is an exclusive-boundary instant (next midnight), not itself a reportable day — display the last inclusive day.
  const lastDay = getManilaDateParts(new Date(end.getTime() - 1));
  if (startParts.year === lastDay.year && startParts.month === lastDay.month) {
    return `${MONTH_NAMES[startParts.month - 1]} ${startParts.day}–${lastDay.day}, ${lastDay.year}`;
  }
  return `${MONTH_NAMES[startParts.month - 1]} ${startParts.day}, ${startParts.year} – ${MONTH_NAMES[lastDay.month - 1]} ${lastDay.day}, ${lastDay.year}`;
}

/**
 * The Manila instant of the next scheduled run for this report type. Daily fires 00:05 Manila
 * every day; weekly fires 00:05 Manila every Monday (alongside that day's daily report, which
 * covers Sunday — the last day of the completed week); monthly fires 08:05 Manila on the 1st.
 * All three share a single cron trigger ("5 0,8 * * *" — see wrangler.toml) that fires at :05
 * past hours 0 and 8.
 */
export function getNextRunDate(type, runDate) {
  if (type === "daily") {
    return new Date(startOfManilaDayUtc(new Date(runDate.getTime() + DAY_MS)).getTime() + FIVE_MIN_MS);
  }
  if (type === "weekly") {
    // Next Monday strictly after runDate — NOT a blind +7 days, which only happens to be
    // correct when runDate is itself already a Monday (true in the real cron flow, but wrong
    // when this is called from /debug/run on an arbitrary day for manual testing).
    const daysUntilMonday = ((1 - getManilaWeekdayIndex(runDate) + 7) % 7) || 7;
    return new Date(startOfManilaDayUtc(new Date(runDate.getTime() + daysUntilMonday * DAY_MS)).getTime() + FIVE_MIN_MS);
  }
  // monthly: 1st of next month, 8:05 AM Manila
  const p = getManilaDateParts(runDate);
  const next = p.month === 12 ? { year: p.year + 1, month: 1 } : { year: p.year, month: p.month + 1 };
  const firstOfNextMonthUtc = new Date(Date.UTC(next.year, next.month - 1, 1, 0, 0, 0) - MANILA_OFFSET_MS);
  return new Date(firstOfNextMonthUtc.getTime() + EIGHT_AM_MS + FIVE_MIN_MS);
}

export function formatNextRunLabel(type, runDate) {
  const next = getNextRunDate(type, runDate);
  return `${formatManilaDateLong(next)} · ${formatManilaTimeShort(next)} (UTC+8)`;
}

export function formatManilaMonthLabel({ year, month }) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
