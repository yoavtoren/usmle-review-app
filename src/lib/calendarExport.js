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

// ── ICS generation ────────────────────────────────────────────────────────
function escICS(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Build VALARM blocks from reminder tokens.
function buildAlarms(tokens) {
  const alarms = [];
  for (const tok of (tokens || [])) {
    const dayMatch = tok.match(/^T-(\d+)d$/);
    if (dayMatch) {
      const d = parseInt(dayMatch[1]);
      alarms.push(`BEGIN:VALARM\r\nTRIGGER:-P${d}D\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder (${d} day${d !== 1 ? 's' : ''} before)\r\nEND:VALARM`);
      continue;
    }
    const sameMatch = tok.match(/^T-0@(\d{2}):?(\d{2})$/);
    if (sameMatch) {
      const mins = parseInt(sameMatch[1]) * 60 + parseInt(sameMatch[2]);
      // For all-day events DTSTART is midnight; offset = +mins minutes from midnight
      alarms.push(`BEGIN:VALARM\r\nTRIGGER:PT${mins}M\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder (${sameMatch[1]}:${sameMatch[2]} on day)\r\nEND:VALARM`);
    }
  }
  return alarms;
}

function vevent(item, dateStr, reminders) {
  if (!dateStr) return '';
  const uid   = `${item.id}@usmle-review-app`;
  const start = fmtAllDay(dateStr);
  const endStr = item.endDate || dateStr;
  const end   = nextDay(endStr);
  const now   = new Date().toISOString().replace(/[-:]/g, '').replace('.000', '').slice(0, 15) + 'Z';
  const desc  = [item.note || item.notes || '', item.people?.map(p => `${p.name} (${p.role})`).join(', ')].filter(Boolean).join('\\n');
  const alarms = buildAlarms(reminders || item.reminders || []).join('\r\n');

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escICS(item.title)}`,
    desc ? `DESCRIPTION:${escICS(desc)}` : '',
    alarms,
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');
}

export function generateICS(tlEvents, aimsTasks) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//USMLE Review App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:USMLE Review · Timeline',
  ];

  for (const ev of tlEvents) {
    if (ev.date) lines.push(vevent(ev, ev.date, ev.reminders));
  }

  for (const t of aimsTasks) {
    if (t.deadline && t.status === 'Active') {
      lines.push(vevent(
        { ...t, id: `aims-${t.id}`, title: `[AIMS] ${t.title}`, note: t.notes },
        t.deadline,
        t.reminders || ["T-7d","T-1d","T-0@08:00"]
      ));
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(content, filename = 'usmle-timeline.ics') {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
