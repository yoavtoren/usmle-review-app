import { useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import WelcomeScreen from "./components/WelcomeScreen.jsx";
import TestDashboard from "./components/TestDashboard.jsx";
import TestReview from "./components/TestReview.jsx";
import FADashboard from "./components/FADashboard.jsx";
import FATracker from "./components/FATracker.jsx";
import AIMSDashboard from "./components/AIMSDashboard.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ReminderToasts, { PopCenter } from "./components/ReminderToasts.jsx";
import EmailCenter from "./components/EmailCenter.jsx";
import { loadProgress, getCard, isDueRespectingMode, getStreak } from "./lib/storage.js";
import { getDueCount } from "./lib/reminderEngine.js";
import { maybeSendDailyDigest } from "./lib/emailService.js";
import { syncSystemNotifications, attachNotificationTapHandler } from "./lib/notify.js";
import HomePage from "./components/HomePage.jsx";
import FirstAidBook from "./components/FirstAidBook.jsx";
import TasksPage from "./components/TasksPage.jsx";
import QuestionBank from "./components/QuestionBank.jsx";
import ProgressTracker from "./components/ProgressTracker.jsx";
import Planner from "./components/Planner.jsx";
import StrategyPage from "./components/StrategyPage.jsx";
import ErrorLogPage from "./components/ErrorLogPage.jsx";
import AccountPage, { LoginGate } from "./components/AccountPage.jsx";
import { vtNavigate } from "./lib/vt.js";

const BASE = import.meta.env.BASE_URL;

function useAppData(routeKey) {
  const [deck, setDeck] = useState(null);
  const [faData, setFaData] = useState(null);
  // Saved progress, re-read whenever the app regains focus. This used to be a
  // one-shot `useState(loadProgress())` — frozen for the whole session — so the
  // sidebar's due badge, the OS notification sync and the daily email digest all
  // kept reporting boot-time counts no matter how many cards you rated.
  // (The lazy `useState(fn)` form also stops loadProgress() running every render.)
  const [progress, setProgress] = useState(loadProgress);
  // Deck fetch lifecycle — loading shows "…" placeholders, error raises the retry banner.
  const [deckStatus, setDeckStatus] = useState({ loading: true, error: false });
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDeckStatus({ loading: true, error: false });
    fetch(`${BASE}questions/deck.json`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { if (!cancelled) { setDeck(d); setDeckStatus({ loading: false, error: false }); } })
      .catch(() => { if (!cancelled) setDeckStatus({ loading: false, error: true }); });
    fetch(`${BASE}fa/fa-progress.json`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setFaData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fetchKey]);

  const retry = () => setFetchKey((k) => k + 1);

  // Study screens write progress straight to localStorage and are unmounted on
  // navigation (the route is keyed by pathname), so re-reading on focus/visibility
  // is enough to keep every shell-level count honest.
  useEffect(() => {
    const refresh = () => setProgress(loadProgress());
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();                       // also fires on every route change (routeKey)
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [routeKey]);

  const testStats = useMemo(() => {
    if (!deck) return { total: 0, missed: 0, mastered: 0, due: 0 };
    let mastered = 0, due = 0;
    for (const q of deck.questions) {
      const c = getCard(progress, q.id);
      if (c.status === "mastered") mastered++;
      // Only "review" cards can be due — new cards aren't scheduled yet and
      // mastered cards have retired (null dueAt must not read as due).
      if (c.status === "review" && isDueRespectingMode(c)) due++;
    }
    return {
      total: deck.questions.length,
      missed: deck.questions.filter((q) => q.missed).length,
      mastered,
      due,
    };
  }, [deck, progress]);

  const faStats = useMemo(() => {
    if (!faData) return { seen: 0, total: 1280 };
    return { seen: faData.seen, total: faData.totalTopics };
  }, [faData]);

  return {
    testStats, faStats, questions: deck?.questions || [],
    dataLoading: deckStatus.loading, dataError: deckStatus.error, retry,
  };
}

// Slim dismissible banner shown when the question deck failed to load.
function DataErrorBanner({ onRetry, onDismiss }) {
  return (
    <div role="alert" dir="rtl" style={{
      display: "flex", alignItems: "center", gap: 10, margin: "10px 16px 0",
      padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
      color: "var(--bad)", background: "var(--bad-soft)", border: "1px solid rgba(156,59,44,0.28)",
    }}>
      <span style={{ flex: 1 }}>לא ניתן לטעון את הנתונים — בדוק חיבור ונסה שוב</span>
      <button className="btn-secondary" onClick={onRetry} style={{ fontSize: 12, padding: "4px 12px" }}>נסה שוב</button>
      <button onClick={onDismiss} aria-label="סגור הודעה" style={{
        background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 14, padding: "2px 4px",
      }}>✕</button>
    </div>
  );
}

export default function App() {
  const nav = useNavigate();
  const loc = useLocation();
  const { testStats, faStats, questions, dataLoading, dataError, retry } = useAppData(loc.pathname);

  const [dueCount, setDueCount]     = useState(getDueCount);
  const [showPopCenter, setShowPopCenter] = useState(false);
  const [showMail, setShowMail]     = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);

  // Refresh bell count every 60s
  useEffect(() => {
    const id = setInterval(() => setDueCount(getDueCount()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Drive the fixed scroll-edge header material (html[data-scrolled]),
  // throttled to one dataset write per frame.
  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      document.documentElement.dataset.scrolled = window.scrollY > 8 ? "true" : "false";
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const reviewDue = testStats.due || 0;

  // Fire the daily email digest once per day if the user enabled it (includes due reviews).
  useEffect(() => {
    maybeSendDailyDigest({ dueReviews: reviewDue }).catch(() => {});
  }, [reviewDue]);

  // Keep OS-level notifications in sync with the current deadlines + reviews,
  // and re-sync when the app returns to the foreground.
  useEffect(() => {
    if (!questions.length) return;
    syncSystemNotifications({ questions });
    const onVisible = () => {
      if (document.visibilityState === "visible") syncSystemNotifications({ questions });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [questions, reviewDue]);

  // Tapping a system notification deep-links to the relevant page.
  useEffect(() => attachNotificationTapHandler(
    (route) => nav(route, route === "/tests/review" ? { state: { filter: "due" } } : undefined)
  ), [nav]);

  // Step 1 is English / left-to-right; everything else is Hebrew / right-to-left.
  const isEnglishArea = /^\/(step1|tests|fa|bank|progress|planner|strategy|errors)(\/|$)/.test(loc.pathname);
  const areaDir  = isEnglishArea ? "ltr" : "rtl";
  const areaLang = isEnglishArea ? "en" : "he";

  return (
    <div className="app-shell">
      {/* Web-only Apple sign-in gate; hidden on /account, which hosts the same button. */}
      {loc.pathname !== "/account" && <LoginGate />}
      <Sidebar
        dueCount={dueCount + reviewDue}
        onBellClick={() => setShowPopCenter(true)}
        onMailClick={() => setShowMail(true)}
      />

      <main className="app-main">
        <div className="scroll-edge-top" aria-hidden="true" />
        {dataError && !errorDismissed && (
          <DataErrorBanner
            onRetry={() => { setErrorDismissed(false); retry(); }}
            onDismiss={() => setErrorDismissed(true)}
          />
        )}
        <ReminderToasts />
        {showPopCenter && (
          <PopCenter
            onClose={() => setShowPopCenter(false)}
            dueReviews={reviewDue}
            onReview={() => { setShowPopCenter(false); nav("/tests/review", { state: { filter: "due" } }); }}
          />
        )}
        {showMail && <EmailCenter onClose={() => setShowMail(false)} testStats={testStats} faStats={faStats} />}

        <div className={`route-fade${isEnglishArea ? " area-ltr" : " area-rtl"}`} key={loc.pathname} dir={areaDir} lang={areaLang}>
          <Routes>
            <Route path="/" element={
              <HomePage testStats={testStats} faStats={faStats} streak={getStreak()} questions={questions} loading={dataLoading} />
            } />
            <Route path="/step1" element={
              <WelcomeScreen
                onNav={(to, opts) => vtNavigate(nav, to, opts)}
                testStats={testStats}
                faStats={faStats}
                streak={getStreak()}
                questions={questions}
                loading={dataLoading}
              />
            } />
            <Route path="/tests" element={
              <TestDashboard onBack={() => nav("/step1")} onStudy={(deckFile, block) => nav("/tests/review", { state: { deckFile, block } })} />
            } />
            <Route path="/tests/review" element={
              <TestReview onBack={() => nav("/tests")} />
            } />
            <Route path="/fa" element={
              <FADashboard onBack={() => nav("/step1")} onTrack={() => nav("/fa/study")} />
            } />
            <Route path="/fa/study" element={
              <FATracker onBack={() => nav("/fa")} />
            } />
            <Route path="/fa/book" element={<FirstAidBook />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/strategy" element={<StrategyPage />} />
            <Route path="/errors" element={<ErrorLogPage />} />
            <Route path="/bank" element={<QuestionBank questions={questions} />} />
            <Route path="/progress" element={<ProgressTracker />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/aims"     element={<AIMSDashboard />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="*" element={
              <HomePage testStats={testStats} faStats={faStats} streak={getStreak()} questions={questions} loading={dataLoading} />
            } />
          </Routes>
        </div>
      </main>
    </div>
  );
}
