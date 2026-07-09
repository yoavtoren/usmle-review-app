import { useMemo, useState } from "react";
import { projectSchedule, calendarModel, todayISO } from "../lib/scheduler.js";
import { buildPlanICS, downloadICS } from "../lib/calendarExport.js";
import { IconCheck, IconCalendar } from "./icons.jsx";
import { colorFor, TRACKS } from "../lib/subjectColors.js";

// Subject color/emoji for a plan unit (falls back to raw system string).
const unitColor = (u) => colorFor(u?.colorKey || u?.system);

/* ═══════════════════════════ shared date helpers ═══════════════════════════ */
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => new Date(s + "T00:00:00");
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const cleanName = (s) => (s || "").replace(/^\d+\s/, "");

function yieldColor(y) {
  if (y >= 5) return "var(--bad)";
  if (y >= 4) return "var(--gold)";
  return "var(--accent-2)";
}

/* ═══════════════════════════════ Gantt view ═══════════════════════════════ */
export function GanttView({ sched, units }) {
  const today = todayISO();
  const proj = useMemo(() => projectSchedule(sched, units), [sched, units]);
  const spans = proj.spans;

  // Bar window per unit: done → its completion day; still-open → its projected span.
  function barFor(u) {
    const st = sched.units[u.key] || {};
    if (st.status === "done" || st.status === "skim") {
      const c = st.completedDate || today;
      return { start: c, end: c, kind: "done" };
    }
    if (st.status === "dropped") return null;
    const sp = spans[u.key];
    if (!sp) return null;
    const weak = (st.weaknessScore || 0) >= 0.4;
    const kind = weak ? "weak" : st.status === "in_progress" ? "active" : "todo";
    return { start: sp.start, end: sp.end, kind, yield: u.yieldWeight };
  }

  // Timeline domain: earliest of (today, any completion) → latest of (exam, last bar).
  const { t0, t1 } = useMemo(() => {
    let lo = parseISO(today).getTime();
    let hi = parseISO(sched.settings.examDate).getTime();
    for (const u of units) {
      const b = barFor(u);
      if (!b) continue;
      lo = Math.min(lo, parseISO(b.start).getTime());
      hi = Math.max(hi, parseISO(b.end).getTime());
    }
    // Pad to whole weeks for tidy month ticks.
    const loD = new Date(lo); loD.setDate(loD.getDate() - loD.getDay());
    hi += 4 * DAY;
    return { t0: loD.getTime(), t1: hi };
  }, [sched, units]); // eslint-disable-line

  const span = Math.max(DAY, t1 - t0);
  const frac = (iso) => clamp((parseISO(iso).getTime() - t0) / span, 0, 1);

  // Month ticks across the axis.
  const months = useMemo(() => {
    const out = [];
    const d = new Date(t0); d.setDate(1);
    while (d.getTime() <= t1) {
      out.push({ frac: clamp((d.getTime() - t0) / span, 0, 1), label: d.toLocaleDateString("en-US", { month: "short" }) });
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }, [t0, t1, span]);

  // Group units by chapter, preserving plan order.
  const groups = useMemo(() => {
    const order = [], byChap = {};
    for (const u of units) {
      if (!byChap[u.chapter]) { byChap[u.chapter] = []; order.push(u.chapter); }
      byChap[u.chapter].push(u);
    }
    return order.map((ch) => ({ chapter: ch, units: byChap[ch] }));
  }, [units]);

  // Collapsible chapters: default-collapse those that are 100% done
  // (done/skim/dropped — nothing left to show). Null = user hasn't toggled yet.
  const defaultCollapsed = useMemo(() => {
    const set = new Set();
    for (const g of groups) {
      if (g.units.every((u) => ["done", "skim", "dropped"].includes(sched.units[u.key]?.status))) set.add(g.chapter);
    }
    return set;
  }, [groups, sched]);
  const [collapsedOverride, setCollapsedOverride] = useState(null);
  const collapsedSet = collapsedOverride ?? defaultCollapsed;
  const toggleChapter = (ch) => setCollapsedOverride((prev) => {
    const next = new Set(prev ?? defaultCollapsed);
    next.has(ch) ? next.delete(ch) : next.add(ch);
    return next;
  });

  const milestones = [
    { iso: today, label: "Today", cls: "now" },
    { iso: sched.settings.contentDeadline, label: "Content deadline", cls: "deadline" },
    { iso: sched.settings.examDate, label: "Exam", cls: "exam" },
  ].filter((m) => parseISO(m.iso).getTime() >= t0 && parseISO(m.iso).getTime() <= t1);

  const doneCount = units.filter((u) => ["done", "skim"].includes(sched.units[u.key]?.status)).length;

  return (
    <div className="plg">
      <div className="plg-head">
        <div className="plg-legend">
          <span className="plg-lg"><i className="plg-sw done" /> Done</span>
          <span className="plg-lg"><i className="plg-sw active" /> In progress</span>
          <span className="plg-lg"><i className="plg-sw weak" /> Weak — pulled forward</span>
          <span className="plg-lg"><i className="plg-sw todo" /> Planned</span>
        </div>
        <span className="plg-meta muted">{doneCount}/{units.length} units done · projected finish {fmtShort(proj.exhaustedISO)}{proj.overflow ? " ⚠ past exam" : ""}</span>
      </div>

      <div className="plg-scroll">
        {/* Axis */}
        <div className="plg-axis">
          <div className="plg-axis-track">
            {months.map((m, i) => (
              <span key={i} className="plg-tick" style={{ left: `${(m.frac * 100).toFixed(2)}%` }}>{m.label}</span>
            ))}
            {milestones.map((m) => (
              <span key={m.cls} className={`plg-mile-lbl ${m.cls}`} style={{ left: `${(frac(m.iso) * 100).toFixed(2)}%` }}>{m.label}</span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="plg-body">
          {/* Milestone vertical lines spanning the whole body */}
          {milestones.map((m) => (
            <span key={m.cls} className={`plg-mile-line ${m.cls}`}
              style={{ left: `calc(var(--plg-lbl) + (100% - var(--plg-lbl)) * ${frac(m.iso).toFixed(4)})` }} />
          ))}

          {groups.map((g) => {
            const isCollapsed = collapsedSet.has(g.chapter);
            const chapDone = g.units.filter((u) => ["done", "skim"].includes(sched.units[u.key]?.status)).length;
            return (
            <div key={g.chapter} className="plg-group">
              <div className="plg-group-head" role="button" tabIndex={0} style={{ cursor: "pointer" }}
                onClick={() => toggleChapter(g.chapter)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleChapter(g.chapter)}>
                <span className="plg-group-name">
                  <span aria-hidden="true">{isCollapsed ? "▸" : "▾"}</span> {cleanName(g.chapter)}
                  {isCollapsed && <span className="muted num"> · {chapDone}/{g.units.length}</span>}
                </span>
                <span className="plg-group-track" />
              </div>
              {!isCollapsed && g.units.map((u) => {
                const b = barFor(u);
                if (!b) return null;
                const left = frac(b.start) * 100;
                const width = Math.max(1.4, (frac(b.end) - frac(b.start)) * 100 + (2 / span) * DAY * 100);
                const color = b.kind === "done" ? "var(--accent)"
                  : b.kind === "weak" ? "var(--bad)"
                  : b.kind === "active" ? "var(--gold-2)"
                  : yieldColor(b.yield);
                return (
                  <div key={u.key} className="plg-row">
                    <span className="plg-row-lbl" title={`${cleanName(u.chapter)} › ${cleanName(u.subsection)}`}>{cleanName(u.subsection)}</span>
                    <span className="plg-row-track">
                      <span className={`plg-bar ${b.kind}`}
                        style={{ left: `${left.toFixed(2)}%`, width: `${width.toFixed(2)}%`, background: color }}
                        title={`${cleanName(u.subsection)} · ${b.start}${b.end !== b.start ? ` → ${b.end}` : ""}`}>
                        {b.kind === "done" && <IconCheck size={9} />}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function fmtShort(iso) {
  if (!iso) return "—";
  return parseISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ═══════════════════════════════ Calendar view ═══════════════════════════════ */
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ sched, units, nav }) {
  const today = todayISO();
  const [mode, setMode] = useState("month");      // month | week | day
  const [cursor, setCursor] = useState(today);    // anchor ISO date

  const byKey = useMemo(() => Object.fromEntries(units.map((u) => [u.key, u])), [units]);
  const { model } = useMemo(() => calendarModel(sched, units, { futureFromISO: today }), [sched, units]);

  // Build the ordered event list for one day.
  function eventsFor(iso) {
    const m = model[iso];
    const evs = [];
    if (m) {
      const ev = (tone, k, tag) => {
        const u = byKey[k];
        const faItems = (u?.faItemIds || []).map((id) => id.split("::").pop());
        return {
          tone, tag, color: unitColor(u).hex, emoji: unitColor(u).emoji,
          label: cleanName(u?.subsection),
          sub: u?.system,
          chapter: cleanName(u?.chapter),
          faItems,
          faSection: `${cleanName(u?.chapter)} › ${cleanName(u?.subsection)}`,
        };
      };
      for (const k of m.completed) evs.push(ev("ok", k, "done"));
      for (const k of m.missed) evs.push(ev("bad", k, "missed"));
      for (const k of (m.planned || [])) {
        if (m.completed.includes(k) || m.missed.includes(k)) continue;
        evs.push(ev("gold", k, "planned"));
      }
      for (const k of (m.projected || [])) evs.push(ev("muted", k, "projected"));
      // 🎯 the reserved animated UWorld daily block, if planned that day
      if (m.uworld) evs.push({ tone: "uworld", label: "UWorld block", sub: m.uworld.system, tag: "uworld", emoji: TRACKS.uworld.emoji, track: "uworld" });
      for (const a of (m.assessments || [])) evs.push({ tone: "purple", label: a.label, sub: a.takenDate ? `logged ${a.actual}` : "checkpoint", tag: "assessment", emoji: TRACKS.assessment.emoji, track: "assessment" });
      if (m.ankiDone) evs.push({ tone: "ok", label: "Anki cleared", tag: "anki", emoji: TRACKS.anki.emoji });
    }
    for (const t of (sched.tasks || [])) {
      if (t.dueISO === iso && !t.done) evs.push({ tone: "accent", label: t.text, tag: "task" });
    }
    return evs;
  }

  const shift = (n) => {
    const d = parseISO(cursor);
    if (mode === "month") d.setMonth(d.getMonth() + n);
    else if (mode === "week") d.setDate(d.getDate() + n * 7);
    else d.setDate(d.getDate() + n);
    setCursor(isoOf(d));
  };

  // Export every upcoming study day (planned + projected units, checkpoints,
  // due tasks) as all-day VEVENTs in a downloadable plan.ics.
  function exportICS() {
    const unitTitle = (k) => {
      const u = byKey[k];
      return u ? `${cleanName(u.chapter)} › ${cleanName(u.subsection)}` : null;
    };
    const taskByDate = {};
    for (const t of (sched.tasks || [])) {
      if (t.dueISO && !t.done) (taskByDate[t.dueISO] ||= []).push(`Task: ${t.text}`);
    }
    const isos = new Set([...Object.keys(model), ...Object.keys(taskByDate)]);
    const days = [...isos].sort().filter((iso) => iso >= today).map((iso) => {
      const m = model[iso] || {};
      const keys = [...new Set([...(m.planned || []), ...(m.projected || [])])]
        .filter((k) => !(m.completed || []).includes(k));
      return {
        date: iso,
        titles: [
          ...(m.assessments || []).map((a) => `Checkpoint: ${a.label}`),
          ...keys.map(unitTitle),
          ...(taskByDate[iso] || []),
        ].filter(Boolean),
      };
    }).filter((d) => d.titles.length);
    downloadICS(buildPlanICS(days), "plan.ics");
  }

  const title = (() => {
    const d = parseISO(cursor);
    if (mode === "month") return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (mode === "week") {
      const ws = new Date(d); ws.setDate(d.getDate() - d.getDay());
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      return `${ws.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${we.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  })();

  return (
    <div className="plc">
      <div className="plc-toolbar">
        <div className="plc-nav">
          <button className="plc-arrow" onClick={() => shift(-1)} aria-label="Previous">‹</button>
          <button className="plc-today" onClick={() => setCursor(today)}>Today</button>
          <button className="plc-today" onClick={() => setCursor(sched.settings.examDate)} title={`Jump to exam · ${sched.settings.examDate}`}>Exam</button>
          <button className="plc-arrow" onClick={() => shift(1)} aria-label="Next">›</button>
          <span className="plc-title">{title}</span>
        </div>
        <div className="plc-modes">
          {["month", "week", "day"].map((mo) => (
            <button key={mo} className={`plc-mode${mode === mo ? " on" : ""}`} onClick={() => setMode(mo)}>
              {mo[0].toUpperCase() + mo.slice(1)}
            </button>
          ))}
          <button className="plc-mode" onClick={exportICS} title="Download the upcoming plan as an .ics calendar file">Export .ics</button>
        </div>
      </div>

      {mode === "month" && <MonthGrid cursor={cursor} today={today} eventsFor={eventsFor} onDay={(iso) => { setCursor(iso); setMode("day"); }} />}
      {mode === "week" && <WeekGrid cursor={cursor} today={today} eventsFor={eventsFor} onDay={(iso) => { setCursor(iso); setMode("day"); }} />}
      {mode === "day" && <DayView cursor={cursor} today={today} eventsFor={eventsFor} sched={sched} nav={nav} />}

      <div className="plc-legend">
        <span className="plc-lg"><i className="plc-sw ok" /> Done</span>
        <span className="plc-lg"><i className="plc-sw gold" /> Planned</span>
        <span className="plc-lg"><i className="plc-sw muted" /> Projected</span>
        <span className="plc-lg"><i className="plc-sw purple" /> Checkpoint</span>
        <span className="plc-lg"><i className="plc-sw bad" /> Missed</span>
      </div>
    </div>
  );
}

function MonthGrid({ cursor, today, eventsFor, onDay }) {
  const first = parseISO(cursor); first.setDate(1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    return { iso: isoOf(d), inMonth: d.getMonth() === first.getMonth(), dow: d.getDay() };
  });
  const curMonth = first.getMonth();

  return (
    <div className="plc-month">
      <div className="plc-wd-row">{WD.map((w) => <span key={w} className="plc-wd">{w}</span>)}</div>
      <div className="plc-grid">
        {cells.map((c) => {
          const evs = eventsFor(c.iso);
          const d = parseISO(c.iso);
          return (
            <button key={c.iso} className={`plc-cell${c.inMonth ? "" : " out"}${c.iso === today ? " today" : ""}`} onClick={() => onDay(c.iso)}>
              <span className="plc-cell-num">{d.getDate()}</span>
              <span className="plc-cell-events">
                {evs.slice(0, 3).map((e, i) => (
                  <span key={i} className={`plc-chip ${e.tone}${e.track ? ` track-${e.track}` : ""}`}
                    style={e.color && !e.track ? { borderLeft: `3px solid ${e.color}` } : undefined}
                    title={e.faItems && e.faItems.length ? `${e.faSection}\n${e.faItems.map((t) => "• " + t).join("\n")}` : undefined}>
                    {e.emoji ? `${e.emoji} ` : ""}{e.label}{e.faItems && e.faItems.length > 0 ? <b className="plc-chip-n">{e.faItems.length}</b> : null}
                  </span>
                ))}
                {evs.length > 3 && <span className="plc-more">+{evs.length - 3} more</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ cursor, today, eventsFor, onDay }) {
  const d = parseISO(cursor);
  const ws = new Date(d); ws.setDate(d.getDate() - d.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const x = new Date(ws); x.setDate(ws.getDate() + i);
    return isoOf(x);
  });
  return (
    <div className="plc-week">
      {days.map((iso) => {
        const dd = parseISO(iso);
        const evs = eventsFor(iso);
        return (
          <div key={iso} className={`plc-wcol${iso === today ? " today" : ""}`}>
            <button className="plc-wcol-head" onClick={() => onDay(iso)}>
              <span className="plc-wcol-wd">{WD[dd.getDay()]}</span>
              <span className="plc-wcol-num">{dd.getDate()}</span>
            </button>
            <div className="plc-wcol-body">
              {evs.length === 0 && <span className="plc-wcol-empty">·</span>}
              {evs.map((e, i) => (
                <span key={i} className={`plc-event ${e.tone}${e.track ? ` track-${e.track}` : ""}`}
                  style={e.color && !e.track ? { borderLeft: `3px solid ${e.color}` } : undefined}
                  title={e.faItems && e.faItems.length ? `${e.faSection}\n${e.faItems.map((t) => "• " + t).join("\n")}` : undefined}>
                  <b>{e.emoji ? `${e.emoji} ` : ""}{e.label}</b>{e.sub && <em>{e.sub}</em>}
                  {e.faItems && e.faItems.length > 0 && (
                    <span className="plc-event-topics">
                      {e.faItems.slice(0, 4).map((t, ti) => <span key={ti} className="plc-event-topic">{t}</span>)}
                      {e.faItems.length > 4 && <span className="plc-event-topic more">+{e.faItems.length - 4} more →</span>}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ cursor, today, eventsFor, sched, nav }) {
  const evs = eventsFor(cursor);
  const groups = [
    ["assessment", "Checkpoint"],
    ["uworld", "UWorld block"],
    ["done", "Completed"],
    ["planned", "Planned"],
    ["projected", "Projected ahead"],
    ["missed", "Missed / rolled over"],
    ["task", "Tasks due"],
    ["anki", "Anki"],
  ];
  return (
    <div className="plc-day">
      {cursor === today && <div className="plc-day-badge">Today</div>}
      {evs.length === 0 && (
        <div className="plc-day-empty">
          <span className="plc-day-empty-ico"><IconCalendar size={22} /></span>
          <p>Nothing scheduled for this day.</p>
        </div>
      )}
      {groups.map(([tag, label]) => {
        const items = evs.filter((e) => e.tag === tag);
        if (!items.length) return null;
        return (
          <div key={tag} className="plc-day-group">
            <div className="plc-day-group-h">{label} <span className="plc-day-group-n">{items.length}</span></div>
            {items.map((e, i) => (
              <div key={i} className={`plc-day-item ${e.tone}${e.track ? ` track-${e.track}` : ""}`}>
                <div className="plc-day-item-top">
                  <span className="plc-day-dot" style={e.color && !e.track ? { background: e.color } : undefined} />
                  <span className="plc-day-item-lbl">{e.emoji ? `${e.emoji} ` : ""}{e.faSection || e.label}</span>
                  {e.faItems && e.faItems.length > 0
                    ? <span className="plc-day-item-sub muted">{e.faItems.length} FA topics to mark ✓</span>
                    : e.sub && <span className="plc-day-item-sub muted">{e.sub}</span>}
                </div>
                {e.faItems && e.faItems.length > 0 && (
                  <ul className="plc-day-checklist">
                    {e.faItems.map((t, ti) => (
                      <li key={ti} className="plc-day-check"><span className="plc-day-check-box">○</span>{t}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        );
      })}
      {cursor === today && (
        <button className="btn-secondary btn-xs plc-day-open" onClick={() => nav && nav("/planner")}>Open today's plan →</button>
      )}
    </div>
  );
}

/* ═══════════════════════════════ view switcher ═══════════════════════════════ */
export function PlannerViewTabs({ view, onView }) {
  const tabs = [
    ["today", "Today"],
    ["timeline", "Timeline"],
    ["calendar", "Calendar"],
  ];
  return (
    <div className="pl-viewtabs">
      {tabs.map(([v, label]) => (
        <button key={v} className={`pl-viewtab${view === v ? " on" : ""}`} onClick={() => onView(v)}>{label}</button>
      ))}
    </div>
  );
}
