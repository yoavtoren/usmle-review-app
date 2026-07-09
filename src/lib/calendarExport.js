// Client-side Google Calendar and ICS export utilities.

function pad(n) { return String(n).padStart(2, '0'); }

// Format a YYYY-MM-DD date as YYYYMMDD for GCal/ICS.
function fmtAllDay(dateStr) {
  return dateStr.replace(/-/g, '');
}

// Next day for all-day end (GCal/ICS end is exclusive).
function nextDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
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
