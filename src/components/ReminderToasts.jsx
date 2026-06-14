import { useState, useEffect, useCallback } from "react";
import { getActiveReminders, dismissReminder, snoozeReminder } from "../lib/reminderEngine.js";
import { buildGCalLink } from "../lib/calendarExport.js";
import { FRONT_COLORS, TYPE_ICONS } from "../lib/timelineData.js";

function fmtDue(daysUntil) {
  if (daysUntil < 0)  return `לפני ${Math.abs(daysUntil)} ימים`;
  if (daysUntil === 0) return "היום";
  if (daysUntil === 1) return "מחר";
  return `בעוד ${daysUntil} ימים`;
}

function Toast({ rem, onDismiss, onSnooze }) {
  const color   = FRONT_COLORS[rem.item.front] || "#475569";
  const icon    = TYPE_ICONS[rem.item.type] || "⏰";
  const gcal    = buildGCalLink(rem.item);
  const dueStr  = fmtDue(rem.daysUntil);

  return (
    <div className="toast-card" style={{ borderLeftColor: color }}>
      <div className="toast-top">
        <span className="toast-icon">{icon}</span>
        <span className="toast-title">{rem.item.title}</span>
        <button className="toast-x" onClick={() => onDismiss(rem.remId)}>✕</button>
      </div>
      <div className="toast-due" style={{ color }}>תאריך: {dueStr}</div>
      <div className="toast-nudge">{rem.nudge}</div>
      <div className="toast-btns">
        <button className="toast-btn toast-dismiss" onClick={() => onDismiss(rem.remId)}>סגור</button>
        <button className="toast-btn toast-snooze"  onClick={() => onSnooze(rem.remId)}>דחה ליום</button>
        {gcal && (
          <a className="toast-btn toast-gcal" href={gcal} target="_blank" rel="noopener noreferrer">
            + GCal
          </a>
        )}
      </div>
    </div>
  );
}

// Pop center modal — full list of due reminders.
export function PopCenter({ onClose }) {
  const [reminders, setReminders] = useState(getActiveReminders);

  function refresh() { setReminders(getActiveReminders()); }

  function handleDismiss(remId) { dismissReminder(remId); refresh(); }
  function handleSnooze(remId)  { snoozeReminder(remId);  refresh(); }

  if (reminders.length === 0) return (
    <div className="popcenter-overlay" onClick={onClose}>
      <div className="popcenter-modal" onClick={e => e.stopPropagation()}>
        <div className="popcenter-hd">
          <span className="popcenter-title">תזכורות</span>
          <button className="intake-close" onClick={onClose}>✕</button>
        </div>
        <div className="popcenter-empty">הכל נקי — אין תזכורות פעילות.</div>
      </div>
    </div>
  );

  return (
    <div className="popcenter-overlay" onClick={onClose}>
      <div className="popcenter-modal" onClick={e => e.stopPropagation()}>
        <div className="popcenter-hd">
          <span className="popcenter-title">תזכורות ({reminders.length})</span>
          <button className="intake-close" onClick={onClose}>✕</button>
        </div>
        <div className="popcenter-list">
          {reminders.map(rem => (
            <Toast key={rem.remId} rem={rem} onDismiss={handleDismiss} onSnooze={handleSnooze} />
          ))}
        </div>
        <div className="popcenter-footer muted small">
          לתזכורות כשהאפליקציה סגורה → ייצא לגוגל קלנדר (📅 .ics).
        </div>
      </div>
    </div>
  );
}

// Auto-checking toast stack rendered in the corner.
export default function ReminderToasts({ limit = 2 }) {
  const [reminders, setReminders] = useState([]);

  const refresh = useCallback(() => {
    setReminders(getActiveReminders().slice(0, limit));
  }, [limit]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  function handleDismiss(remId) { dismissReminder(remId); setReminders(r => r.filter(x => x.remId !== remId)); }
  function handleSnooze(remId)  { snoozeReminder(remId);  setReminders(r => r.filter(x => x.remId !== remId)); }

  if (reminders.length === 0) return null;

  return (
    <div className="toast-stack">
      {reminders.map(rem => (
        <Toast key={rem.remId} rem={rem} onDismiss={handleDismiss} onSnooze={handleSnooze} />
      ))}
    </div>
  );
}
