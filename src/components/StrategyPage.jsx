import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ZONES, currentZone, LOOP, ANKI_RULES, ANKI_MATH, RESOURCE_MAP, GUARDRAILS,
  TEACH_BACK, WHAT_TO_DROP, BLOCKS, currentBlock, MAINTAIN_ONLY, ASSESSMENTS,
  GO_NO_GO, DAY_BLOCK, DAY_MOVE, RADAR, BASELINE, statusFor, DIAGNOSIS,
  TARGET_SIT_ISO, daysFromToday,
} from "../lib/strategyData.js";
import { EXAM_DATE_ISO, localISODate, daysUntilExam } from "../lib/config.js";
import { loadErrors, whyCounts, isoDaysAgo } from "../lib/errorLog.js";
import { IconTarget, IconSparkle, IconCalendar, IconClock, IconNote } from "./icons.jsx";

const TABS = [
  ["loop", "The loop"],
  ["blocks", "Block plan"],
  ["day", "Daily template"],
  ["baseline", "Where I stand"],
];

function fmt(iso, opts = { month: "short", day: "numeric" }) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", opts);
}
function rel(iso) {
  const d = daysFromToday(iso);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return d > 0 ? `in ${d}d` : `${-d}d ago`;
}

// initialTab / initialDay are seams for deep-linking (and for render tests) —
// the page is otherwise self-contained.
export default function StrategyPage({ initialTab = "loop", initialDay = DAY_BLOCK.id }) {
  const nav = useNavigate();
  const today = localISODate();
  const [tab, setTab] = useState(initialTab);
  const [dayTpl, setDayTpl] = useState(initialDay);

  const zone = currentZone(today);
  const block = currentBlock(today);
  const template = dayTpl === DAY_BLOCK.id ? DAY_BLOCK : DAY_MOVE;

  // Live signal from the error log so the method page shows whether the ENCODE
  // step is actually happening this week — not just describing it.
  const encode = useMemo(() => {
    const list = loadErrors();
    const week = whyCounts(list, isoDaysAgo(7));
    return { total: list.length, week };
  }, []);

  const nextAssessment = ASSESSMENTS.find((a) => a.date >= today) || null;

  return (
    <div className="page strat-page">
      <div className="page-head">
        <div>
          <div className="page-eyebrow"><IconTarget size={13} /> Strategy</div>
          <h1 className="td-title">The Step 1 plan</h1>
          <p className="td-sub">
            One repeatable loop — LEARN → PRACTICE → ENCODE → SPACE — run system by system, weak-first,
            from the move-out sprint to the sit date. Re-planned {fmt(BASELINE.asOf, { month: "long", day: "numeric" })}.
          </p>
        </div>
        <button className="td-submit-btn" onClick={() => nav("/errors")}>Open the error log</button>
      </div>

      {/* Countdown + where I am right now */}
      <div className="strat-now">
        <div className="strat-now-card strat-now-hero">
          <span className="strat-now-lbl">Days to the exam</span>
          <span className="strat-now-num num">{daysUntilExam()}</span>
          <span className="strat-now-sub">
            Target sit {fmt(TARGET_SIT_ISO)} · hard cap {fmt(EXAM_DATE_ISO)}
          </span>
        </div>
        <div className="strat-now-card">
          <span className="strat-now-lbl">Zone {zone.id} · {zone.name}</span>
          <span className="strat-now-head">{zone.headline}</span>
          <span className="strat-now-sub">{fmt(zone.from)} – {fmt(zone.to)} · {zone.hours}</span>
        </div>
        <div className="strat-now-card">
          <span className="strat-now-lbl">This week's focus</span>
          <span className="strat-now-head">{block ? block.primary : "—"}</span>
          <span className="strat-now-sub">{block ? `${block.label} · ${block.why}` : ""}</span>
        </div>
        <div className="strat-now-card">
          <span className="strat-now-lbl">Next assessment</span>
          <span className="strat-now-head">{nextAssessment ? nextAssessment.form : "Done — sit it"}</span>
          <span className="strat-now-sub">
            {nextAssessment ? `${fmt(nextAssessment.date)} · ${rel(nextAssessment.date)}` : GO_NO_GO.slice(0, 60)}
          </span>
        </div>
      </div>

      {/* The diagnosis — why the plan changed */}
      <div className="strat-diag">
        <div className="strat-diag-col">
          <h3 className="strat-h">The problem</h3>
          <p className="strat-p">{DIAGNOSIS.problem}</p>
        </div>
        <div className="strat-diag-col strat-diag-fix">
          <h3 className="strat-h">The fix</h3>
          <p className="strat-p">{DIAGNOSIS.fix}</p>
        </div>
        <div className="strat-diag-col">
          <h3 className="strat-h">Where I stand</h3>
          <p className="strat-p">{DIAGNOSIS.standing}</p>
        </div>
      </div>

      <div className="strat-tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={`chip${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === "loop" && (
        <>
          <div className="strat-loop">
            {LOOP.map((p) => (
              <article key={p.key} className={`strat-pass strat-pass-${p.key}`}>
                <header>
                  <span className="strat-pass-n">Pass {p.n}</span>
                  <span className="strat-pass-tag">{p.tag}</span>
                </header>
                <h3 className="strat-pass-title"><span aria-hidden="true">{p.emoji}</span> {p.title}</h3>
                <p className="strat-pass-lead">{p.lead}</p>
                <ul className="strat-ul">
                  {p.points.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
                {p.key === "encode" && (
                  <button className="btn-secondary strat-inline-btn" onClick={() => nav("/errors")}>
                    Log a miss →
                  </button>
                )}
              </article>
            ))}
          </div>

          {/* Is the ENCODE step actually happening? */}
          <div className="strat-card strat-encode">
            <div>
              <h3 className="strat-h"><IconNote size={14} /> Encoding this week</h3>
              <p className="strat-p">
                {encode.week.total === 0
                  ? "No misses logged in the last 7 days. If you did questions, the encode step didn't happen — that's the whole failure mode this plan exists to fix."
                  : `${encode.week.total} miss${encode.week.total === 1 ? "" : "es"} logged in the last 7 days (${encode.total} all-time). Review the "why" column before the next NBME.`}
              </p>
            </div>
            <button className="td-submit-btn" onClick={() => nav("/errors")}>Error log</button>
          </div>

          <h2 className="strat-sec">How to pick Anki cards</h2>
          <p className="strat-sec-sub">
            Never hand-pick. UWorld and First Aid pick them for you, through AnKing's tags. Two rules only.
          </p>
          <div className="strat-rules">
            {ANKI_RULES.map((r) => (
              <article key={r.n} className="strat-card strat-rule">
                <span className="strat-rule-n num">Rule {r.n}</span>
                <h3 className="strat-h">{r.title}</h3>
                <p className="strat-p">{r.body}</p>
                <p className="strat-note">{r.note}</p>
              </article>
            ))}
            <article className="strat-card strat-rule strat-rule-math">
              <span className="strat-rule-n num">{ANKI_MATH.headline}</span>
              <h3 className="strat-h">The 4-hour math (+ rescue)</h3>
              <ul className="strat-ul">
                {ANKI_MATH.points.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </article>
          </div>

          <h2 className="strat-sec">Resource per subject</h2>
          <div className="strat-table-wrap">
            <table className="strat-table">
              <thead>
                <tr><th>Subject / system</th><th>LEARN source</th><th>Mnemonic booster</th><th>Questions</th></tr>
              </thead>
              <tbody>
                {RESOURCE_MAP.map((r) => (
                  <tr key={r.subject}>
                    <td className="strat-td-key">{r.subject}</td>
                    <td>{r.learn}</td><td>{r.boost}</td><td>{r.questions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="strat-guards">
            <article className="strat-card strat-teach">
              <h3 className="strat-h"><IconSparkle size={14} /> {TEACH_BACK.title}</h3>
              <p className="strat-p">{TEACH_BACK.body}</p>
            </article>
            {GUARDRAILS.map((g) => (
              <article key={g.title} className="strat-card strat-guard">
                <h3 className="strat-h">{g.title}</h3>
                <p className="strat-p">{g.body}</p>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === "blocks" && (
        <>
          <h2 className="strat-sec">Three zones</h2>
          <div className="strat-zones">
            {ZONES.map((z) => (
              <article key={z.id} className={`strat-card strat-zone${z.id === zone.id ? " now" : ""}`}>
                <header className="strat-zone-head">
                  <span className="strat-zone-id">Zone {z.id}</span>
                  <span className="strat-zone-dates">{fmt(z.from)} – {fmt(z.to)}</span>
                  {z.id === zone.id && <span className="strat-badge">now</span>}
                </header>
                <h3 className="strat-h">{z.name}</h3>
                <p className="strat-p">{z.headline} <em>{z.hours}</em></p>
                <ul className="strat-ul">{z.doing.map((t, i) => <li key={i}>{t}</li>)}</ul>
                <p className="strat-drop"><strong>Drop:</strong> {z.dropping.join(" · ")}</p>
              </article>
            ))}
          </div>

          <h2 className="strat-sec">Weak-first sequence</h2>
          <p className="strat-sec-sub">
            Priority = low accuracy × high volume × high-yield × avoided. Every organ system is paired with its own
            pharmacology. Interleave 20–30% mixed/random UWorld daily. Green systems get no dedicated week:
            {" "}{MAINTAIN_ONLY.join(", ")} — Anki reviews + interleaved questions only.
          </p>
          <div className="strat-blocks">
            {BLOCKS.map((b) => (
              <article key={b.id} className={`strat-card strat-block${block && b.id === block.id ? " now" : ""}`}>
                <header className="strat-block-head">
                  <span className="strat-block-label">{b.label}</span>
                  <span className="strat-block-dates">{fmt(b.from)} – {fmt(b.to)}</span>
                  {block && b.id === block.id && <span className="strat-badge">now</span>}
                  {b.assessment && <span className="strat-badge alt">🧪 {b.assessment}</span>}
                </header>
                <h3 className="strat-h">{b.primary}</h3>
                {b.why && <p className="strat-p">{b.why}</p>}
                <dl className="strat-dl">
                  {b.filters.length > 0 && (
                    <><dt>UWorld filters</dt><dd>{b.filters.join(" · ")}</dd></>
                  )}
                  {b.anki && <><dt>Unsuspend</dt><dd>{b.anki}</dd></>}
                  {b.teachBack && <><dt>Teach-back</dt><dd>{b.teachBack}</dd></>}
                </dl>
                {b.collision && <p className="strat-drop"><strong>Collision:</strong> {b.collision}</p>}
              </article>
            ))}
          </div>

          <h2 className="strat-sec">Assessments &amp; go / no-go</h2>
          <div className="strat-table-wrap">
            <table className="strat-table">
              <thead><tr><th>Date</th><th>Form</th><th>Role</th><th>When</th></tr></thead>
              <tbody>
                {ASSESSMENTS.map((a) => (
                  <tr key={a.date} className={a.date >= today ? "" : "past"}>
                    <td className="strat-td-key">{fmt(a.date)}</td>
                    <td>{a.form}</td><td>{a.role}</td><td className="num">{rel(a.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="strat-callout">{GO_NO_GO}</p>

          <h2 className="strat-sec">Deadline radar</h2>
          <ul className="strat-radar">
            {RADAR.map((r) => {
              const d = daysFromToday(r.date);
              return (
                <li key={r.date + r.what} className={`strat-radar-row${r.hot ? " hot" : ""}${d < 0 ? " past" : ""}`}>
                  <span className="strat-radar-days num">{d < 0 ? "—" : d}</span>
                  <span className="strat-radar-date">{fmt(r.date)}</span>
                  <span className="strat-radar-what">{r.what}</span>
                  <span className="strat-radar-front">{r.front}</span>
                </li>
              );
            })}
          </ul>

          <h2 className="strat-sec">What to drop</h2>
          <ul className="strat-droplist">
            {WHAT_TO_DROP.map((d) => (
              <li key={d.front}><strong>{d.front}</strong> — {d.call}</li>
            ))}
          </ul>
        </>
      )}

      {tab === "day" && (
        <>
          <div className="strat-tabs">
            {[DAY_BLOCK, DAY_MOVE].map((t) => (
              <button key={t.id} className={`chip${dayTpl === t.id ? " active" : ""}`} onClick={() => setDayTpl(t.id)}>
                {t.title}
              </button>
            ))}
          </div>
          <div className="strat-card strat-day">
            <h3 className="strat-h"><IconClock size={14} /> {template.title}</h3>
            <p className="strat-p">{template.sub}</p>
            <ul className="strat-timeline">
              {template.rows.map((r, i) => (
                <li key={i} className={`strat-tl-row${r.kind ? ` k-${r.kind}` : ""}`}>
                  <span className="strat-tl-time num">{r.time}</span>
                  <span className="strat-tl-what">{r.what}</span>
                </li>
              ))}
            </ul>
            <p className="strat-note">{template.footer}</p>
          </div>
          <p className="strat-callout">
            Non-negotiable on every single day, block or move: the main meal at midday, a wrist-neutral movement
            break, and phone-down time with Angela. Anki stays ≤ 4 h — reviews in the morning, new cards in the afternoon.
          </p>
        </>
      )}

      {tab === "baseline" && (
        <>
          <h2 className="strat-sec">
            <IconCalendar size={14} /> Baseline — {fmt(BASELINE.asOf, { month: "long", day: "numeric", year: "numeric" })}
          </h2>
          <p className="strat-sec-sub">
            {BASELINE.overallPct}% UWorld overall, ~700+ questions. 🔴 under 45% = attack · 🟡 45–64% = lift ·
            ✅ 65%+ = maintain · ⭐ = an avoided subject, front-load it.
          </p>
          {[["Subjects", BASELINE.subjects], ["Systems", BASELINE.systems]].map(([title, rows]) => (
            <div key={title} className="strat-base">
              <h3 className="strat-h">{title}</h3>
              <ul className="strat-bars">
                {[...rows].sort((a, b) => a.pct - b.pct).map((r) => {
                  const st = statusFor(r.pct);
                  return (
                    <li key={r.name} className="strat-bar-row">
                      <span className="strat-bar-name">
                        {r.name}{r.avoided && <span className="strat-star" title="Avoided subject — front-load">⭐</span>}
                      </span>
                      <span className="strat-bar-track">
                        <span className={`strat-bar-fill ${st.tone}`} style={{ width: `${r.pct}%` }} />
                      </span>
                      <span className={`strat-bar-pct num ${st.tone}`}>{r.pct}%</span>
                      <span className="strat-bar-q num">{r.q}Q</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <p className="strat-callout">
            The six avoided subjects are still the six weakest — the avoidance risk is real and unbroken. That's why
            biostats and ethics get killed during the move, and pharm / biochem / immuno lead the dedicated block.
          </p>
        </>
      )}
    </div>
  );
}
