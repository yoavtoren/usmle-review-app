// System notifications — real notifications outside the app.
// Native (iPad / Mac app): @capacitor/local-notifications, scheduled ahead so
// they fire even when the app is closed. Web: Notification API while the tab
// is open (the browser cannot fire with the page closed — email/GCal covers that).
import { Capacitor } from "@capacitor/core";
import { getActiveReminders, getUpcomingReminders, buildNotificationContent } from "./reminderEngine.js";
import { loadProgress, getCard, getLightMode } from "./storage.js";

const isNative = Capacitor.isNativePlatform();
const WEB_SHOWN_KEY = "usmle-app:web-notified-v1";
const REVIEW_ID_BASE = 900000; // ids 900001..900007 = daily review digests
const REVIEW_HOUR = 8, REVIEW_MINUTE = 30;

async function plugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

// Stable 31-bit id from a reminder id string.
function hashId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 800000) + 1;
}

export function notifySupported() {
  return isNative || typeof Notification !== "undefined";
}

// 'granted' | 'denied' | 'prompt' | 'unsupported'
export async function getNotifyStatus() {
  if (isNative) {
    try { return (await (await plugin()).checkPermissions()).display; }
    catch { return "unsupported"; }
  }
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission === "default" ? "prompt" : Notification.permission;
}

export async function requestNotifyPermission() {
  if (isNative) {
    try { return (await (await plugin()).requestPermissions()).display; }
    catch { return "unsupported"; }
  }
  if (typeof Notification === "undefined") return "unsupported";
  const p = await Notification.requestPermission();
  return p === "default" ? "prompt" : p;
}

// ── Spaced-repetition counts ──────────────────────────────────────────────
// Exact number of review cards due by the morning of day-offset d (0 = today).
function reviewCountsByDay(questions, days = 7) {
  // Reviews are paused (light mode) — no review notifications at all.
  try { if (getLightMode().paused) return Array(days).fill(0); } catch { /* default: not paused */ }
  const progress = loadProgress();
  const dueAts = [];
  for (const q of questions) {
    const c = getCard(progress, q.id);
    if (c.status === "review" && c.dueAt != null) dueAts.push(c.dueAt);
  }
  const counts = [];
  for (let d = 0; d < days; d++) {
    const morning = new Date();
    morning.setDate(morning.getDate() + d);
    morning.setHours(REVIEW_HOUR, REVIEW_MINUTE, 0, 0);
    const cutoff = morning.getTime();
    counts.push(dueAts.filter(t => t <= cutoff).length);
  }
  return counts;
}

function reviewNotificationContent(count, dayOffset) {
  const noun = count === 1 ? "שאלה אחת ממתינה" : `${count} שאלות ממתינות`;
  const morning = new Date();
  morning.setDate(morning.getDate() + dayOffset);
  const dd = String(morning.getDate()).padStart(2, "0");
  const mm = String(morning.getMonth() + 1).padStart(2, "0");
  return {
    title: count === 1 ? "📚 שאלה אחת לחזרה היום" : `📚 ${count} שאלות לחזרה היום`,
    body: `נכון לבוקר ${dd}.${mm}: ${noun} לחזרה מרווחת. פתח את האפליקציה כדי להתחיל.`,
  };
}

// ── Scheduling ────────────────────────────────────────────────────────────
let lastArgs = { questions: [] };
let resyncTimer = null;

// Cancel everything we scheduled and re-schedule from current data:
//  • every upcoming task reminder (next 30 days) at its exact fire time
//  • a daily review digest at 08:30 for each of the next 7 mornings with a count
export async function syncSystemNotifications({ questions } = {}) {
  if (questions) lastArgs = { questions };
  if ((await getNotifyStatus()) !== "granted") return;

  if (!isNative) { webNotifyCheck(lastArgs.questions); return; }

  try {
    const LN = await plugin();
    const pending = await LN.getPending();
    if (pending.notifications?.length) await LN.cancel(pending);

    const notifs = [];

    for (const rem of getUpcomingReminders(30)) {
      const { title, body } = buildNotificationContent(rem);
      notifs.push({
        id: hashId(rem.remId),
        title, body,
        schedule: { at: new Date(rem.fireTime) },
        extra: { route: "/aims" },
      });
    }

    const counts = reviewCountsByDay(lastArgs.questions, 7);
    for (let d = 1; d < counts.length; d++) {
      if (!counts[d]) continue;
      const at = new Date();
      at.setDate(at.getDate() + d);
      at.setHours(REVIEW_HOUR, REVIEW_MINUTE, 0, 0);
      const { title, body } = reviewNotificationContent(counts[d], d);
      notifs.push({ id: REVIEW_ID_BASE + d, title, body, schedule: { at }, extra: { route: "/tests/review" } });
    }

    // iOS caps pending local notifications at 64 — keep the soonest.
    notifs.sort((a, b) => a.schedule.at - b.schedule.at);
    if (notifs.length) await LN.schedule({ notifications: notifs.slice(0, 60) });
  } catch { /* plugin unavailable — nothing to schedule */ }
}

// Debounced resync after dismiss / snooze / rating changes.
export function resyncNotifications() {
  clearTimeout(resyncTimer);
  resyncTimer = setTimeout(() => syncSystemNotifications(), 800);
}

// ── Web fallback: fire browser notifications for newly-active reminders ──
function loadShown() {
  try { return JSON.parse(localStorage.getItem(WEB_SHOWN_KEY)) || {}; }
  catch { return {}; }
}

function webNotifyCheck(questions = []) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const shown = loadShown();
  let changed = false;

  for (const rem of getActiveReminders()) {
    if (shown[rem.remId]) continue;
    const { title, body } = buildNotificationContent(rem);
    try { new Notification(title, { body, tag: rem.remId }); } catch { /* blocked */ }
    shown[rem.remId] = Date.now();
    changed = true;
  }

  // One review digest per day, only once the 08:30 mark has passed.
  const now = new Date();
  const dayKey = `reviews-${now.toISOString().slice(0, 10)}`;
  if (!shown[dayKey] && (now.getHours() > REVIEW_HOUR || (now.getHours() === REVIEW_HOUR && now.getMinutes() >= REVIEW_MINUTE))) {
    const count = reviewCountsByDay(questions, 1)[0];
    if (count > 0) {
      const { title, body } = reviewNotificationContent(count, 0);
      try { new Notification(title, { body, tag: dayKey }); } catch { /* blocked */ }
      shown[dayKey] = Date.now();
      changed = true;
    }
  }

  if (changed) {
    // Keep only the last ~200 entries so the store never grows unbounded.
    const entries = Object.entries(shown).sort((a, b) => b[1] - a[1]).slice(0, 200);
    localStorage.setItem(WEB_SHOWN_KEY, JSON.stringify(Object.fromEntries(entries)));
  }
}

// Tapping a scheduled notification deep-links into the right page.
export async function attachNotificationTapHandler(onRoute) {
  if (!isNative) return;
  try {
    const LN = await plugin();
    LN.addListener("localNotificationActionPerformed", (event) => {
      const route = event?.notification?.extra?.route;
      if (route) onRoute(route);
    });
  } catch { /* plugin unavailable */ }
}
