import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  IconHome, IconDash, IconClipboard, IconBook, IconBox,
  IconTarget, IconPulse, IconBell, IconMail, IconChevron, IconCalendar,
} from "./icons.jsx";
import { loadCategoryTasks } from "../lib/workstreamData.js";
import { EXAM_DATE, daysUntilExam, localISODate } from "../lib/config.js";

function overdueCount(categoryId) {
  try {
    const today = localISODate();
    return loadCategoryTasks(categoryId).filter(
      (t) => t.status === "Active" && t.deadline && t.deadline < today
    ).length;
  } catch {
    return 0;
  }
}

const RAIL_KEY = "usmle-app:rail-collapsed";

export default function Sidebar({ dueCount = 0, onBellClick, onMailClick }) {
  const nav = useNavigate();
  const loc = useLocation();
  const p = loc.pathname;

  const [mini, setMini] = useState(() => localStorage.getItem(RAIL_KEY) === "1");
  const [drawer, setDrawer] = useState(false);

  useEffect(() => { localStorage.setItem(RAIL_KEY, mini ? "1" : "0"); }, [mini]);
  useEffect(() => { setDrawer(false); }, [p]); // close mobile drawer on navigate

  // reflect collapse/drawer state on the shell wrapper
  useEffect(() => {
    const shell = document.querySelector(".app-shell");
    if (!shell) return;
    shell.classList.toggle("rail-mini", mini);
    shell.classList.toggle("drawer-open", drawer);
  }, [mini, drawer]);

  const stats = useMemo(() => ({
    aimsOver: overdueCount("aims"),
  }), [p]);

  const groups = [
    {
      items: [{ to: "/", label: "בית", Icon: IconHome, exact: true }],
    },
    {
      label: "Step 1",
      // Route-language rule: these all open English/LTR study areas → English labels.
      items: [
        { to: "/planner", label: "Planner", Icon: IconCalendar },
        { to: "/step1", label: "Step 1 Board", Icon: IconDash },
        { to: "/tests", label: "Tests", Icon: IconClipboard },
        { to: "/bank", label: "Question Bank", Icon: IconBox },
        { to: "/progress", label: "Progress", Icon: IconPulse },
        { to: "/fa", label: "First Aid", Icon: IconBook },
        { to: "/fa/book", label: "FA Book", Icon: IconBook },
      ],
    },
    {
      label: "עוד",
      items: [
        { to: "/aims", label: "AIMS", Icon: IconTarget, count: stats.aimsOver, alert: stats.aimsOver > 0 },
      ],
    },
  ];

  function isActive(to, exact) {
    if (exact) return p === "/";
    if (to === "/step1") return p === "/step1" || p.startsWith("/tests") || p.startsWith("/fa") || p.startsWith("/bank") || p.startsWith("/progress") || p.startsWith("/planner");
    return p === to || p.startsWith(to + "/");
  }

  const days = daysUntilExam();
  const examStr = EXAM_DATE.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });

  const Mark = (
    <span className="rail-mark" aria-hidden="true">
      <IconPulse size={19} />
    </span>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="rail-mobile-bar">
        {Mark}
        <span className="rail-wordmark-title">לוח ההישרדות</span>
        <button className="rail-burger" onClick={() => setDrawer((d) => !d)} aria-label="תפריט">
          <span /><span /><span />
        </button>
      </div>

      {drawer && <div className="rail-scrim" onClick={() => setDrawer(false)} />}

      <aside className="rail">
        <div className="rail-head" role="button" tabIndex={0}
          onClick={() => nav("/")} onKeyDown={(e) => e.key === "Enter" && nav("/")}>
          {Mark}
          <span className="rail-wordmark">
            <span className="rail-wordmark-title">לוח ההישרדות</span>
            <span className="rail-wordmark-sub">USMLE Step 1</span>
          </span>
        </div>

        <nav className="rail-nav">
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.label && <div className="rail-group-label">{g.label}</div>}
              {g.items.map((it) => {
                const active = isActive(it.to, it.exact);
                const { Icon } = it;
                return (
                  <button
                    key={it.to}
                    className={`rail-link${active ? " active" : ""}${it.alert ? " has-alert" : ""}`}
                    onClick={() => nav(it.to)}
                    title={it.label}
                  >
                    <span className="rail-ico"><Icon size={19} /></span>
                    <span className="rail-label">{it.label}</span>
                    {it.count > 0 && (
                      <span className={`rail-count${it.alert ? " alert" : ""}`}>{it.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="rail-countdown" title={`בחינה: ${examStr}`}>
            <span className="rail-countdown-num">{days}</span>
            <span className="rail-countdown-txt">
              <span className="rail-countdown-lbl">ימים לבחינה</span>
              <span className="rail-countdown-date">{examStr}</span>
            </span>
          </div>

          <div className="rail-foot-row">
            <button className="rail-foot-btn" onClick={onBellClick} title="תזכורות">
              <IconBell size={16} />
              <span className="rail-foot-label">תזכורות</span>
              {dueCount > 0 && <span className="rail-foot-badge">{dueCount > 99 ? "99+" : dueCount}</span>}
            </button>
            <button className="rail-foot-btn" onClick={onMailClick} title="אימייל ותזכורות">
              <IconMail size={16} />
              <span className="rail-foot-label">אימייל</span>
            </button>
          </div>

          <button className="rail-collapse" onClick={() => setMini((m) => !m)} title={mini ? "הרחב" : "כווץ"}>
            <IconChevron size={15} />
            <span className="rail-foot-label">כווץ תפריט</span>
          </button>
        </div>
      </aside>
    </>
  );
}
