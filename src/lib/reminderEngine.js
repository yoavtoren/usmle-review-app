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

// ── Nudge copy ─────────────────────────────────────────────────────────────
const DEFAULT_REMINDERS = {
  deadline:        ["T-14d","T-7d","T-3d","T-1d","T-0@08:00"],
  event:           ["T-7d","T-1d","T-0@08:00"],
  landmark:        ["T-7d","T-1d"],
  "task-deadline": ["T-3d","T-1d","T-0@09:00"],
  aims:            ["T-7d","T-1d","T-0@08:00"],
  blocker:         [],
};

// Hardcoded nudges per task id (optional; falls back to the tone template).
const NUDGES = {};

const TONE_FALLBACK = {
  blunt:    (title, w) => `${title} — ${w}. Take one concrete step now.`,
  creative: (title, w) => `Morning window: work on "${title}" while you're fresh.`,
  warm:     (title, w) => `Protect this: ${title}. A small action today matters.`,
};

function generateNudge(item, token) {
  const dayMatch = token.match(/^T-(\d+)d$/);
  const sameDay  = token.startsWith('T-0@');
  const nDays    = dayMatch ? parseInt(dayMatch[1]) : 0;
  const when     = sameDay ? 'today' : nDays === 1 ? 'tomorrow' : `in ${nDays} days`;
  if (NUDGES[item.id]) return NUDGES[item.id](when, sameDay);
  const catId = item.category;
  const tone  = catId ? (CATEGORIES[catId]?.tone || 'blunt') : 'blunt';
  return TONE_FALLBACK[tone](item.title, when);
}

// ── Core: active reminders ────────────────────────────────────────────────
export function getActiveReminders() {
  const now = Date.now();
  const state = loadReminderState();
  const dismissed   = new Set(state.dismissed || []);
  const snoozedUntil = state.snoozedUntil || {};

  const active = [];

  function check(item, dateStr, tz, remTokens) {
    const toks = remTokens?.length ? remTokens : (DEFAULT_REMINDERS[item.type] || []);
    for (const tok of toks) {
      const remId = `${item.id}::${tok}`;
      if (dismissed.has(remId)) continue;
      if (snoozedUntil[remId] && snoozedUntil[remId] > now) continue;
      const fireTime = resolveToken(tok, dateStr, tz || 'Europe/Prague');
      if (fireTime && fireTime <= now) {
        active.push({
          remId, item, token: tok, fireTime,
          daysUntil: Math.round((new Date(dateStr) - new Date()) / 86400000),
          nudge: generateNudge(item, tok),
        });
      }
    }
  }

  // Workstream tasks (AIMS)
  for (const t of loadAllWorkstreamTasks()) {
    if (!t.deadline || t.status !== 'Active' || t.recurring) continue;
    check(
      { ...t, type: 'aims', front: t.category || 'aims', note: t.notes },
      t.deadline, t.tz,
      t.reminders || ["T-7d","T-1d","T-0@08:00"]
    );
  }

  return active.sort((a, b) => a.fireTime - b.fireTime);
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
