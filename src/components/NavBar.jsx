import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const FLAT_LINKS = [
  { to: "/aims",      label: "AIMS"       },
  { to: "/medcross",  label: "MedCross"   },
  { to: "/selfcare",  label: "טיפול עצמי" },
  { to: "/timeline",  label: "ציר זמן"   },
];

const STEP1_CHILDREN = [
  { to: "/step1", label: "📊 לוח Step 1" },
  { to: "/tests", label: "📝 Tests"      },
  { to: "/fa",    label: "📖 First Aid"  },
];

const MEDSCHOOL_CHILDREN = [
  { to: "/medschool", label: "🏫 Hub" },
];


export default function NavBar({ dueCount = 0, onBellClick }) {
  const nav  = useNavigate();
  const loc  = useLocation();
  const p    = loc.pathname;
  const [step1Open,  setStep1Open]  = useState(false);
  const [msOpen,     setMsOpen]     = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const wrapRef  = useRef(null);
  const msWrapRef = useRef(null);

  const isStep1Active = p === "/step1" || p.startsWith("/tests") || p.startsWith("/fa");
  const isMsActive    = p.startsWith("/medschool");

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current   && !wrapRef.current.contains(e.target))   setStep1Open(false);
      if (msWrapRef.current && !msWrapRef.current.contains(e.target)) setMsOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [p]);

  return (
    <>
      <nav className="top-nav">
        <div className="top-nav-inner">
          <span className="top-nav-brand" onClick={() => nav("/")} role="button" tabIndex={0}
            onKeyDown={e => e.key === "Enter" && nav("/")}>
            לוח ההישרדות
          </span>

          {/* Step 1 dropdown — desktop only */}
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

          {/* Med School dropdown — desktop only */}
          <div className="top-nav-step1-wrap" ref={msWrapRef}>
            <button
              className={`top-nav-link top-nav-step1${isMsActive ? " top-nav-active" : ""}`}
              onClick={() => setMsOpen(o => !o)}>
              Med School {msOpen ? "▴" : "▾"}
            </button>
            {msOpen && (
              <div className="top-nav-dropdown">
                {MEDSCHOOL_CHILDREN.map(({ to, label }) => (
                  <button key={to} className="top-nav-dd-item"
                    onClick={() => { nav(to); setMsOpen(false); }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className={`top-nav-link${p === "/" ? " top-nav-active" : ""}`} onClick={() => nav("/")}>
            בית
          </button>

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

          {/* Hamburger — mobile only */}
          <button
            className={`top-nav-hamburger${menuOpen ? " ham-open" : ""}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="פתח תפריט">
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      {menuOpen && (
        <div className="top-nav-mobile-menu">
          <div className="top-nav-mobile-section">
            <div className="top-nav-mobile-label">Step 1</div>
            {STEP1_CHILDREN.map(({ to, label }) => (
              <button key={to}
                className={`top-nav-mobile-link${p === to ? " top-nav-mobile-active" : ""}`}
                onClick={() => { nav(to); setMenuOpen(false); }}>
                {label}
              </button>
            ))}
          </div>
          <div className="top-nav-mobile-section">
            <div className="top-nav-mobile-label">Med School</div>
            {MEDSCHOOL_CHILDREN.map(({ to, label }) => (
              <button key={to}
                className={`top-nav-mobile-link${p.startsWith("/medschool") ? " top-nav-mobile-active" : ""}`}
                onClick={() => { nav(to); setMenuOpen(false); }}>
                {label}
              </button>
            ))}
          </div>
          <div className="top-nav-mobile-section">
            <div className="top-nav-mobile-label">ניווט</div>
            <button className={`top-nav-mobile-link${p === "/" ? " top-nav-mobile-active" : ""}`}
              onClick={() => { nav("/"); setMenuOpen(false); }}>בית</button>
            {FLAT_LINKS.map(({ to, label }) => (
              <button key={to}
                className={`top-nav-mobile-link${p.startsWith(to) ? " top-nav-mobile-active" : ""}`}
                onClick={() => { nav(to); setMenuOpen(false); }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
