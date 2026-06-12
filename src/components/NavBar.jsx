import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const FLAT_LINKS = [
  { to: "/",          label: "בית"        },
  { to: "/timeline",  label: "ציר זמן"   },
  { to: "/aims",      label: "AIMS"       },
  { to: "/medcross",  label: "MedCross"   },
  { to: "/selfcare",  label: "טיפול עצמי" },
];

const STEP1_CHILDREN = [
  { to: "/step1", label: "📊 לוח Step 1" },
  { to: "/tests", label: "📝 Tests"      },
  { to: "/fa",    label: "📖 First Aid"  },
];

export default function NavBar({ dueCount = 0, onBellClick }) {
  const nav  = useNavigate();
  const loc  = useLocation();
  const p    = loc.pathname;
  const [step1Open, setStep1Open] = useState(false);
  const wrapRef = useRef(null);

  const isStep1Active = p === "/step1" || p.startsWith("/tests") || p.startsWith("/fa");

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setStep1Open(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <nav className="top-nav">
      <div className="top-nav-inner">
        <span className="top-nav-brand" onClick={() => nav("/")} role="button" tabIndex={0}
          onKeyDown={e => e.key === "Enter" && nav("/")}>
          לוח ההישרדות
        </span>

        {/* Step 1 dropdown — first in order */}
        <div className="top-nav-step1-wrap" ref={wrapRef}>
          <button
            className={`top-nav-link top-nav-step1${isStep1Active ? " top-nav-active" : ""}`}
            onClick={() => setStep1Open(o => !o)}>
            Step 1 {step1Open ? "▴" : "▾"}
          </button>
          {step1Open && (
            <div className="top-nav-dropdown">
              {STEP1_CHILDREN.map(({ to, label }) => (
                <button key={to} className="top-nav-dd-item"
                  onClick={() => { nav(to); setStep1Open(false); }}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="top-nav-links">
          {FLAT_LINKS.map(({ to, label }) => {
            const active = to === "/" ? p === "/" : p.startsWith(to);
            return (
              <button key={to} className={`top-nav-link${active ? " top-nav-active" : ""}`}
                onClick={() => nav(to)}>
                {label}
              </button>
            );
          })}
        </div>

        <button className="top-nav-bell" onClick={onBellClick} title="תזכורות">
          🔔
          {dueCount > 0 && <span className="top-nav-badge">{dueCount}</span>}
        </button>
      </div>
    </nav>
  );
}
