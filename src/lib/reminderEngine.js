import { loadReminderState, saveReminderState } from './timelineData.js';
import { loadAllWorkstreamTasks, CATEGORIES } from './workstreamData.js';

// ── Timezone helper ───────────────────────────────────────────────────────
function tzToUTC(dateStr, timeStr, tz) {
  try {
    const proxy = new Date(`${dateStr}T${timeStr}:00Z`);
    const fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const tzStr = fmt.format(proxy).replace(' ', 'T') + ':00Z';
    const offset = proxy.getTime() - new Date(tzStr).getTime();
    return new Date(proxy.getTime() + offset).getTime();
  } catch {
    return new Date(`${dateStr}T${timeStr}:00`).getTime();
  }
}

function subtractDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function resolveToken(token, dateStr, tz = 'Europe/Prague') {
  if (!dateStr) return null;
  const dayMatch = token.match(/^T-(\d+)d$/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1]);
    const fireDate = days === 0 ? dateStr : subtractDays(dateStr, days);
    return tzToUTC(fireDate, '09:00', tz);
  }
  const sameMatch = token.match(/^T-0@(\d{2}):?(\d{2})$/);
  if (sameMatch) return tzToUTC(dateStr, `${sameMatch[1]}:${sameMatch[2]}`, tz);
  return null;
}

// ── Precise copy ───────────────────────────────────────────────────────────
const HE_WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// "יום שלישי, 14.07" — exact weekday + date, no ambiguity.
export function fmtExactDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `יום ${HE_WEEKDAYS[d.getDay()]}, ${dd}.${mm}`;
}

// Whole days between a reference timestamp and the deadline date.
function daysLeftAt(dateStr, atMs) {
  const deadline = new Date(dateStr + 'T12:00:00').getTime();
  const ref = new Date(atMs); ref.setHours(12, 0, 0, 0);
  return Math.round((deadline - ref.getTime()) / 86400000);
}

function daysLeftPhrase(n) {
  if (n < -1)  return `עבר לפני ${Math.abs(n)} ימים`;
  if (n === -1) return 'עבר אתמול';
  if (n === 0) return 'היום';
  if (n === 1) return 'מחר';
  return `בעוד ${n} ימים`;
}

// Hardcoded nudges per task id (optional; falls back to the precise template).
const NUDGES = {};

// Precise in-app nudge: exact date, exact days remaining, category.
function generateNudge(item, token, dateStr) {
  if (NUDGES[item.id]) {
    const sameDay = token.startsWith('T-0@');
    return NUDGES[item.id](daysLeftPhrase(daysLeftAt(dateStr, Date.now())), sameDay);
  }
  const n = daysLeftAt(dateStr, Date.now());
  const cat = item.category ? CATEGORIES[item.category]?.title : null;
  const parts = [`דדליין: ${fmtExactDate(dateStr)} (${daysLeftPhrase(n)})`];
  if (cat) parts.push(cat);
  if (item.note) parts.push(String(item.note).split('\n')[0].slice(0, 80));
  return parts.join(' · ');
}

// Precise system-notification content, computed relative to the FIRE time so a
// notification scheduled days ahead still states the correct days-remaining.
export function buildNotificationContent(rem) {
  const { item, dateStr, fireTime } = rem;
  const n = daysLeftAt(dateStr, fireTime);
  let prefix;
  if (n < 0)       prefix = '⚠️ באיחור';
  else if (n === 0) prefix = '⏰ היום';
  else if (n === 1) prefix = '⏰ מחר';
  else              prefix = `⏰ בעוד ${n} ימים`;
  const cat = item.category ? CATEGORIES[item.category]?.title : null;
  const parts = [`דדליין: ${fmtExactDate(dateStr)}`];
  if (cat) parts.push(cat);
  if (item.note) parts.push(String(item.note).split('\n')[0].slice(0, 80));
  return { title: `${prefix}: ${item.title}`, body: parts.join(' · ') };
}

// ── Core: reminder collection ─────────────────────────────────────────────
// Every non-dismissed reminder with its snooze-adjusted fire time.
function collectReminders() {
  const state = loadReminderState();
  const dismissed = new Set(state.dismissed || []);
  const snoozedUntil = state.snoozedUntil || {};

  const DEFAULT_TOKENS = ["T-7d", "T-1d", "T-0@08:00"];
  const all = [];

  function check(item, dateStr, tz, remTokens) {
    const toks = remTokens?.length ? remTokens : DEFAULT_TOKENS;
    for (const tok of toks) {
      const remId = `${item.id}::${tok}`;
      if (dismissed.has(remId)) continue;
      let fireTime = resolveToken(tok, dateStr, tz || 'Europe/Prague');
      if (!fireTime) continue;
      // A snooze pushes the fire time forward.
      if (snoozedUntil[remId] && snoozedUntil[remId] > fireTime) fireTime = snoozedUntil[remId];
      all.push({ remId, item, token: tok, fireTime, dateStr });
    }
  }

  // Workstream tasks (AIMS)
  for (const t of loadAllWorkstreamTasks()) {
    if (!t.deadline || t.status !== 'Active' || t.recurring) continue;
    check(
      { ...t, type: 'aims', front: t.category || 'aims', note: t.notes },
      t.deadline, t.tz,
      t.reminders || ["T-7d", "T-1d", "T-0@08:00"]
    );
  }

  return all.sort((a, b) => a.fireTime - b.fireTime);
}

// Reminders whose fire time has passed — shown in-app (toasts / pop center).
export function getActiveReminders() {
  const now = Date.now();
  return collectReminders()
    .filter(r => r.fireTime <= now)
    .map(r => ({
      ...r,
      daysUntil: daysLeftAt(r.dateStr, now),
      nudge: generateNudge(r.item, r.token, r.dateStr),
    }));
}

// Reminders that fire in the future — used to schedule OS notifications.
export function getUpcomingReminders(horizonDays = 30) {
  const now = Date.now();
  const horizon = now + horizonDays * 86400000;
  return collectReminders().filter(r => r.fireTime > now && r.fireTime <= horizon);
}

export function getDueCount()   { return getActiveReminders().length; }

export function dismissReminder(remId) {
  const state = loadReminderState();
  const dismissed = new Set(state.dismissed || []);
  dismissed.add(remId);
  saveReminderState({ ...state, dismissed: [...dismissed] });
}

export function snoozeReminder(remId) {
  const state = loadReminderState();
  const snoozedUntil = { ...(state.snoozedUntil || {}) };
  snoozedUntil[remId] = Date.now() + 24 * 3600 * 1000;
  saveReminderState({ ...state, snoozedUntil });
}
