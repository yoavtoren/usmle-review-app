import { useNavigate, useLocation } from "react-router-dom";

export default function NavBar({ dueCount = 0, onBellClick }) {
  const nav = useNavigate();
  const loc = useLocation();
  const p   = loc.pathname;

  const links = [
    { to: "/",         label: "Dashboard" },
    { to: "/timeline", label: "Timeline"  },
    { to: "/aims",     label: "AIMS"      },
    { to: "/tests",    label: "Tests"     },
    { to: "/fa",       label: "First Aid" },
  ];

  return (
    <nav className="top-nav">
      <div className="top-nav-inner">
        <span className="top-nav-brand" onClick={() => nav("/")} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && nav("/")}>
          Step 1
        </span>
        <div className="top-nav-links">
          {links.map(({ to, label }) => {
            const active = to === "/" ? p === "/" : p.startsWith(to);
            return (
              <button
                key={to}
                className={`top-nav-link${active ? " top-nav-active" : ""}`}
                onClick={() => nav(to)}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button className="top-nav-bell" onClick={onBellClick} title="Reminders">
          🔔
          {dueCount > 0 && <span className="top-nav-badge">{dueCount}</span>}
        </button>
      </div>
    </nav>
  );
}
