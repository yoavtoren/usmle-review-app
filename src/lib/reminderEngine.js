import { loadTimelineEvents, loadReminderState, saveReminderState } from './timelineData.js';
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

// Hardcoded nudges per event/task id
const NUDGES = {
  // Timeline events (blunt)
  "ev-ent":          (w, s) => `ENT oral ${w}. Do one 10-min out-loud Q&A round with Angela now.`,
  "ev-lease":        (w, s) => `Prague lease: ${w} left. ${s ? "You must be out." : "Book the donation pickup today."}`,
  "ev-step1":        (w, s) => `Step 1 ${w}. ${s ? "Sit the exam." : "Open a fresh NBME and schedule it."}`,
  "ev-block":        (w, s) => `Dedicated block starts ${w}. ${s ? "Reset schedule. 12h/day starts now." : "Finish all logistics before it begins."}`,
  "ev-aims-bizplan": (w, s) => `AIMS event ${w}. ${s ? "Be there, AIMS mode all day." : "Book the prep meetings now."}`,
  "ev-aims-panel":   (w, s) => `AIMS panel ${w}. ${s ? "Speech finalized?" : "Draft the speech outline today."}`,
  "ev-movein":       (w, s) => `Israel flat move target ${w}. ${s ? "Last logistics today." : "Start coordinating the move."}`,
  "ev-flight":       (w, s) => `Flight booking deadline ${w}. Book now — prices only go up.`,
  "ev-contracts":    (w, s) => `Internet/phone contracts end ${w}. Check the notice period today.`,
  "ev-sell":         (w, s) => `Start selling furniture ${w}. List one item online right now.`,
  // MedCross (creative)
  "mc-fake":    (w, s) => "Audit follower quality — real reach beats vanity numbers.",
  "mc-batch":   (w, s) => "Batch 3 puzzle videos this morning while you're fresh.",
  "mc-launch":  (w, s) => `MedCross launch ${w}. Is your content backlog ready?`,
  "mc-revenue": (w, s) => "Map one path to first revenue this week.",
  // Self-care (warm)
  "sc-weekly":       (w, s) => "Carve out one phones-down moment with Angela this week — it's your anchor.",
  "sc-move-support": (w, s) => `Angela's move support deadline ${w}. Take one concrete load off her plate today.`,
  "sc-gesture":      (w, s) => "Plan a small, specific gesture for Angela this week. Attention > money.",
  "sc-doctor":       (w, s) => "Book that GERD appointment. You deserve to feel better in the mornings.",
};

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

  // Timeline events
  for (const ev of loadTimelineEvents().filter(e => e.date)) {
    check(ev, ev.date, ev.tz, ev.reminders);
  }

  // All workstream tasks (aims + medcross + selfcare)
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
