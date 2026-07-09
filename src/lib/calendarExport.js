// Client-side Google Calendar and ICS export utilities.

function pad(n) { return String(n).padStart(2, '0'); }

// Format a YYYY-MM-DD date as YYYYMMDD for GCal/ICS.
function fmtAllDay(dateStr) {
  return dateStr.replace(/-/g, '');
}

// Add days using LOCAL date components — UTC arithmetic ("T12:00:00Z" +
// toISOString) shifts the date by a day in +TZ zones like Asia/Jerusalem.
function addDaysLocal(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
}

// Next day for all-day end (GCal/ICS end is exclusive).
function nextDay(dateStr) {
  return addDaysLocal(dateStr, 1);
}

// ── Per-event Google Calendar link ────────────────────────────────────────
export function buildGCalLink(item) {
  const dateStr = item.date || item.deadline;
  if (!dateStr) return null;

  const startD = fmtAllDay(dateStr);
  const endStr = item.endDate || dateStr;
  const endD   = nextDay(endStr);

  const title   = encodeURIComponent(item.title);
  const details = encodeURIComponent([item.note || item.notes || '', item.people?.map(p => `${p.name} (${p.role})`).join(', ')].filter(Boolean).join('\n'));
  const dates   = `${startD}/${endD}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
}

// ── ICS export ────────────────────────────────────────────────────────────

// Escape TEXT per RFC 5545 §3.3.11 (backslash, semicolon, comma, newline).
function escapeICS(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// RFC 5545 lines must stay <= 75 octets; fold with a leading space.
function foldLine(line) {
  if (line.length <= 74) return line;
  const parts = [line.slice(0, 74)];
  for (let i = 74; i < line.length; i += 73) parts.push(' ' + line.slice(i, i + 73));
  return parts.join('\r\n');
}

// Build a VCALENDAR from the planner's study days.
// `days` = [{ date: "YYYY-MM-DD", titles: [string, ...] }] — one all-day
// VEVENT per study day, summarized by its unit titles.
export function buildPlanICS(days, { calName = 'USMLE Study Plan' } = {}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//usmle-review-app//planner//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeICS(calName)}`,
  ];
  for (const d of days) {
    const titles = (d.titles || []).filter(Boolean);
    if (!d.date || !titles.length) continue;
    const summary = titles.length === 1 ? titles[0] : `Study plan · ${titles.length} items`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:plan-${d.date}@usmle-review-app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${fmtAllDay(d.date)}`,
      `DTEND;VALUE=DATE:${nextDay(d.date)}`,
      `SUMMARY:${escapeICS(summary)}`,
      `DESCRIPTION:${escapeICS(titles.join('\n'))}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// Trigger a browser download of an ICS string.
export function downloadICS(icsText, filename = 'plan.ics') {
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
