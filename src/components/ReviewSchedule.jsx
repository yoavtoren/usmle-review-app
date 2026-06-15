import { useMemo } from "react";
import { getReviewSchedule, INTERVALS, loadProgress } from "../lib/storage.js";
import { IconClock, IconBell, IconMail, IconArrow, IconCheck } from "./icons.jsx";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function ReviewSchedule({ questions = [], onStart }) {
  const s = useMemo(() => getReviewSchedule(questions, loadProgress()), [questions]);
  const maxCount = Math.max(1, ...s.days.map(d => d.count));
  const nextLabel = s.nextDueAt
    ? new Date(s.nextDueAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : null;

  return (
    <div className="rs-panel">
      <div className="rs-head">
        <span className="rs-title">Review schedule</span>
        {s.paused
          ? <span className="rs-pause">⏸ Paused</span>
          : <span className="rs-sub">spaced repetition · 1 → 3 → 7 → 16 → 35 days</span>}
      </div>

      {/* Due-now hero */}
      <div className="rs-hero">
        <div className="rs-hero-left">
          <span className={`rs-due-num${s.dueNow > 0 ? " hot" : ""}`}>{s.dueNow}</span>
          <span className="rs-due-lbl">
            due for review {s.dueNow === 1 ? "question" : "questions"} today
            {s.overdue > 0 && <span className="rs-overdue"> · {s.overdue} overdue</span>}
          </span>
        </div>
        <button className="rs-start" onClick={onStart} disabled={s.dueNow === 0}>
          {s.dueNow > 0 ? <>Start review <IconArrow size={15} /></> : "All caught up ✓"}
        </button>
      </div>

      {/* 14-day upcoming distribution */}
      <div className="rs-cal">
        {s.days.map((d, i) => {
          const date = new Date(d.ms);
          return (
            <div key={i} className={`rs-day${d.isToday ? " today" : ""}${d.count > 0 ? " has" : ""}`}
              title={`${d.count} due · ${date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`}>
              <div className="rs-bar-track">
                <div className="rs-bar" style={{ height: `${d.count ? 14 + (d.count / maxCount) * 46 : 3}%` }} />
                {d.count > 0 && <span className="rs-bar-n">{d.count}</span>}
              </div>
              <span className="rs-day-dow">{DOW[date.getDay()]}</span>
              <span className="rs-day-num">{d.isToday ? "today" : date.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* Tallies */}
      <div className="rs-tallies">
        <div className="rs-tally"><span className="rs-tally-n">{s.reviewing}</span><span className="rs-tally-l">in rotation</span></div>
        <div className="rs-tally"><span className="rs-tally-n ok">{s.mastered}</span><span className="rs-tally-l">mastered</span></div>
        <div className="rs-tally"><span className="rs-tally-n">{s.upcomingTotal}</span><span className="rs-tally-l">scheduled ahead</span></div>
        {nextLabel && <div className="rs-tally"><span className="rs-tally-n sm">{nextLabel}</span><span className="rs-tally-l">next review</span></div>}
      </div>

      {/* Interval ladder */}
      <div className="rs-ladder">
        {INTERVALS.map((d, i) => (
          <span key={i} className="rs-step">
            <span className="rs-step-d">{d}d</span>
            {i < INTERVALS.length - 1 && <span className="rs-step-arr">→</span>}
          </span>
        ))}
        <span className="rs-step-arr">→</span>
        <span className="rs-step mastered"><IconCheck size={12} /> mastered</span>
      </div>

      <div className="rs-foot">
        <IconClock size={13} />
        <span>
          Get "Got it" right → it moves up the ladder; miss it → back to 1 day. Due reviews also show in the
          {" "}<IconBell size={12} /> bell and your <IconMail size={12} /> daily email.
        </span>
      </div>
    </div>
  );
}
