import { loadTimelineEvents, loadAimsTasks, loadReminderState, saveReminderState } from './timelineData.js';

// ── Timezone helper ───────────────────────────────────────────────────────
// Converts a local date+time in a named timezone to a UTC ms timestamp.
function tzToUTC(dateStr, timeStr, tz) {
  try {
    const proxy = new Date(`${dateStr}T${timeStr}:00Z`);
    const fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    });
    const tzStr = fmt.format(proxy).replace(' ', 'T') + ':00Z';
    const tzDate = new Date(tzStr);
    const offset = proxy.getTime() - tzDate.getTime();
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

// Resolve a reminder token into a UTC ms fire-time.
export function resolveToken(token, dateStr, tz = 'Europe/Prague') {
  if (!dateStr) return null;
  const dayMatch = token.match(/^T-(\d+)d$/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1]);
    const fireDate = days === 0 ? dateStr : subtractDays(dateStr, days);
    return tzToUTC(fireDate, '09:00', tz);
  }
  const sameMatch = token.match(/^T-0@(\d{2}):(\d{2})$/);
  if (sameMatch) return tzToUTC(dateStr, `${sameMatch[1]}:${sameMatch[2]}`, tz);
  const sameMatchColon = token.match(/^T-0@(\d{2}:\d{2})$/);
  if (sameMatchColon) return tzToUTC(dateStr, sameMatchColon[1], tz);
  return null;
}

// Default reminders per item type.
const DEFAULT_REMINDERS = {
  deadline:        ["T-14d","T-7d","T-3d","T-1d","T-0@08:00"],
  event:           ["T-7d","T-1d","T-0@08:00"],
  landmark:        ["T-7d","T-1d"],
  "task-deadline": ["T-3d","T-1d","T-0@09:00"],
  aims:            ["T-7d","T-1d","T-0@08:00"],
  blocker:         [],
};

// Specific blunt nudge copy per event or fallback by type.
const NUDGES = {
  "ev-ent":         (w, same) => `ENT oral ${w}. Do one 10-min out-loud Q&A round with Angela now.`,
  "ev-lease":       (w, same) => `Prague lease: ${w} left. ${same ? "You must be out." : "Book the donation pickup today."}`,
  "ev-step1":       (w, same) => `Step 1 ${w}. ${same ? "Sit the exam." : "Open a fresh NBME and schedule it."}`,
  "ev-block":       (w, same) => `Dedicated block starts ${w}. ${same ? "Reset schedule to test date. 12h/day starts now." : "Finish all logistics before it begins."}`,
  "ev-aims-bizplan":(w, same) => `AIMS event ${w}. ${same ? "Be there on time, AIMS mode all day." : "Book the prep meetings now."}`,
  "ev-aims-panel":  (w, same) => `AIMS panel ${w}. ${same ? "Speech finalized?" : "Draft the speech outline today."}`,
  "ev-movein":      (w, same) => `Israel flat move target ${w}. ${same ? "Last logistics today." : "Start coordinating the move."}`,
  "ev-flight":      (w, same) => `Flight booking deadline ${w}. Book now — prices only go up.`,
  "ev-contracts":   (w, same) => `Internet/phone contracts end ${w}. Check the notice period today.`,
  "ev-sell":        (w, same) => `Start selling furniture ${w}. List one item online right now to break the seal.`,
};

function generateNudge(item, token) {
  const dayMatch = token.match(/^T-(\d+)d$/);
  const sameDay = token.startsWith('T-0@');
  const nDays = dayMatch ? parseInt(dayMatch[1]) : 0;
  const when = sameDay ? 'today' : nDays === 1 ? 'tomorrow' : `in ${nDays} days`;
  if (NUDGES[item.id]) return NUDGES[item.id](when, sameDay);
  const verb = (item.type === 'deadline' || item.urgency) ? 'due' : 'coming up';
  return `${item.title} is ${verb} ${when}. Take one concrete step now.`;
}

// ── Core: get all reminders that are due and not dismissed/snoozed ────────
export function getActiveReminders() {
  const now = Date.now();
  const state = loadReminderState();
  const dismissed = new Set(state.dismissed || []);
  const snoozedUntil = state.snoozedUntil || {};

  const tlEvents = loadTimelineEvents().filter(e => e.date);
  const aimsTasks = loadAimsTasks().filter(t => t.deadline && t.status === 'Active');

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
          remId,
          item,
          token: tok,
          fireTime,
          daysUntil: Math.round((new Date(dateStr) - new Date()) / 86400000),
          nudge: generateNudge(item, tok),
        });
      }
    }
  }

  for (const ev of tlEvents) check(ev, ev.date, ev.tz, ev.reminders);

  for (const t of aimsTasks) {
    check(
      { ...t, type: 'aims', front: 'aims', note: t.notes },
      t.deadline,
      t.tz,
      t.reminders || ["T-7d","T-1d","T-0@08:00"]
    );
  }

  return active.sort((a, b) => a.fireTime - b.fireTime);
}

export function getDueCount() { return getActiveReminders().length; }

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
