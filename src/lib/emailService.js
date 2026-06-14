// ── Real email reminders via EmailJS (client-side, no backend) ──────────────
//
// The app stays a static site. EmailJS lets the browser send a templated email
// directly from the client using your own EmailJS account keys. Nothing is sent
// anywhere until you paste your keys into Settings → Email and enable it.
//
// One-time setup (≈3 min) at https://emailjs.com :
//   1. Add an email service (Gmail/Outlook/…) → copy the Service ID.
//   2. Create a template with variables {{subject}}, {{intro}}, {{body}}, {{to_email}}.
//   3. Account → API keys → copy the Public Key.
//   4. Paste all three + your address into Settings → Email here.

import { getActiveReminders } from "./reminderEngine.js";
import { loadAllWorkstreamTasks } from "./workstreamData.js";
import { loadTimelineEvents } from "./timelineData.js";

const CONFIG_KEY = "usmle-app:email-config-v1";
const LOG_KEY = "usmle-app:email-log-v1";
const EXAM_DATE = "2026-10-11";

const DEFAULT_CONFIG = {
  serviceId: "",
  templateId: "",
  publicKey: "",
  toEmail: "yoavtoren@gmail.com",
  enabled: false,
  sendHour: 7, // local hour after which the daily digest may fire
  lastSentDate: null,
};

export function loadEmailConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveEmailConfig(patch) {
  const next = { ...loadEmailConfig(), ...patch };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  return next;
}

export function isConfigured(cfg = loadEmailConfig()) {
  return Boolean(cfg.serviceId && cfg.templateId && cfg.publicKey && cfg.toEmail);
}

// ── Sent log (powers the in-app history) ────────────────────────────────────
export function getEmailLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

function appendLog(entry) {
  const log = getEmailLog();
  log.unshift({ ...entry, at: Date.now() });
  localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 40)));
}

export function clearEmailLog() {
  localStorage.removeItem(LOG_KEY);
}

// ── Digest content ──────────────────────────────────────────────────────────
function daysToExam() {
  return Math.max(0, Math.ceil((new Date(EXAM_DATE) - new Date()) / 86400000));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Build a structured digest from live app state. `extra` may carry React stats
// (due reviews, FA coverage) that the libs can't compute on their own.
export function buildDigest(extra = {}) {
  const today = todayStr();
  const days = daysToExam();

  const reminders = getActiveReminders();

  const tasks = loadAllWorkstreamTasks();
  const overdue = tasks.filter((t) => t.status === "Active" && t.deadline && t.deadline < today);
  const dueSoon = tasks.filter((t) => {
    if (t.status !== "Active" || !t.deadline) return false;
    const d = Math.ceil((new Date(t.deadline) - new Date(today)) / 86400000);
    return d >= 0 && d <= 3;
  });

  const upcoming = loadTimelineEvents()
    .filter((e) => e.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const sections = [];

  if (typeof extra.dueReviews === "number" && extra.dueReviews > 0) {
    sections.push({
      title: "Step 1 — review",
      lines: [`${extra.dueReviews} questions due for spaced-repetition review today.`],
    });
  }

  if (reminders.length) {
    sections.push({
      title: `Active reminders (${reminders.length})`,
      lines: reminders.slice(0, 6).map((r) => `• ${r.item.title} — ${r.nudge}`),
    });
  }

  if (overdue.length) {
    sections.push({
      title: `⚠ Overdue (${overdue.length})`,
      lines: overdue.slice(0, 6).map((t) => `• ${t.title} (was due ${t.deadline})`),
    });
  }

  if (dueSoon.length) {
    sections.push({
      title: `Due within 3 days (${dueSoon.length})`,
      lines: dueSoon.slice(0, 6).map((t) => `• ${t.title} — ${t.deadline}`),
    });
  }

  if (upcoming.length) {
    sections.push({
      title: "On the horizon",
      lines: upcoming.map((e) => `• ${e.date} — ${e.title}`),
    });
  }

  if (!sections.length) {
    sections.push({ title: "All clear", lines: ["Nothing pressing today. Keep the streak — one focused block."] });
  }

  const dateLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const subject = `Study digest · ${days} days to Step 1 · ${overdue.length ? `${overdue.length} overdue` : "on track"}`;
  const intro = `${dateLabel} — ${days} days until Step 1 (Oct 11, 2026).`;

  const text =
    intro +
    "\n\n" +
    sections.map((s) => `${s.title}\n${s.lines.join("\n")}`).join("\n\n") +
    "\n\n— לוח ההישרדות";

  const body = sections
    .map(
      (s) =>
        `<div style="margin:0 0 18px">
           <div style="font:600 13px/1.4 -apple-system,Segoe UI,sans-serif;color:#4F46E5;letter-spacing:.3px;text-transform:uppercase;margin-bottom:6px">${s.title}</div>
           ${s.lines
             .map(
               (l) =>
                 `<div style="font:400 14px/1.6 -apple-system,Segoe UI,sans-serif;color:#222;margin:2px 0">${l.replace(/^•\s*/, "&bull;&nbsp;")}</div>`
             )
             .join("")}
         </div>`
    )
    .join("");

  return { subject, intro, body, text, sections, meta: { days, overdue: overdue.length, reminders: reminders.length } };
}

// ── Send ────────────────────────────────────────────────────────────────────
export async function sendDigest(digest = buildDigest(), cfg = loadEmailConfig()) {
  if (!isConfigured(cfg)) {
    throw new Error("Email is not configured. Add your EmailJS keys in Settings → Email.");
  }
  const emailjs = (await import("@emailjs/browser")).default;
  const params = {
    to_email: cfg.toEmail,
    subject: digest.subject,
    intro: digest.intro,
    body: digest.body,
    text: digest.text,
  };
  try {
    await emailjs.send(cfg.serviceId, cfg.templateId, params, { publicKey: cfg.publicKey });
    appendLog({ ok: true, subject: digest.subject, to: cfg.toEmail, meta: digest.meta });
    return { ok: true };
  } catch (err) {
    const msg = err?.text || err?.message || "Send failed";
    appendLog({ ok: false, subject: digest.subject, to: cfg.toEmail, error: msg });
    throw new Error(msg);
  }
}

// ── Auto daily digest (fires once/day while the app is open) ─────────────────
export async function maybeSendDailyDigest(extra = {}) {
  const cfg = loadEmailConfig();
  if (!cfg.enabled || !isConfigured(cfg)) return { sent: false, reason: "disabled" };

  const today = todayStr();
  if (cfg.lastSentDate === today) return { sent: false, reason: "already-sent" };
  if (new Date().getHours() < (cfg.sendHour ?? 7)) return { sent: false, reason: "too-early" };

  await sendDigest(buildDigest(extra), cfg);
  saveEmailConfig({ lastSentDate: today });
  return { sent: true };
}
