import { useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import WelcomeScreen from "./components/WelcomeScreen.jsx";
import TestDashboard from "./components/TestDashboard.jsx";
import TestReview from "./components/TestReview.jsx";
import FADashboard from "./components/FADashboard.jsx";
import FATracker from "./components/FATracker.jsx";
import Timeline from "./components/Timeline.jsx";
import AIMSDashboard from "./components/AIMSDashboard.jsx";
import NavBar from "./components/NavBar.jsx";
import ReminderToasts, { PopCenter } from "./components/ReminderToasts.jsx";
import { loadProgress, getCard, isDueRespectingMode, getStreak } from "./lib/storage.js";
import { getDueCount } from "./lib/reminderEngine.js";
import { generateICS, downloadICS } from "./lib/calendarExport.js";
import { loadTimelineEvents, loadAimsTasks } from "./lib/timelineData.js";

const BASE = import.meta.env.BASE_URL;

function useAppData() {
  const [deck, setDeck] = useState(null);
  const [faData, setFaData] = useState(null);
  const [progress] = useState(loadProgress());

  useEffect(() => {
    fetch(`${BASE}questions/deck.json`)
      .then((r) => r.json())
      .then(setDeck)
      .catch(() => {});
    fetch(`${BASE}fa/fa-progress.json`)
      .then((r) => r.json())
      .then(setFaData)
      .catch(() => {});
  }, []);

  const testStats = useMemo(() => {
    if (!deck) return { total: 0, missed: 0, mastered: 0, due: 0 };
    let mastered = 0, due = 0;
    for (const q of deck.questions) {
      const c = getCard(progress, q.id);
      if (c.status === "mastered") mastered++;
      if (c.status !== "new" && isDueRespectingMode(c)) due++;
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

  return { testStats, faStats, questions: deck?.questions || [] };
}

export default function App() {
  const { testStats, faStats, questions } = useAppData();
  const nav = useNavigate();

  const [dueCount, setDueCount]     = useState(getDueCount);
  const [showPopCenter, setShowPopCenter] = useState(false);

  // Refresh bell count every 60s
  useEffect(() => {
    const id = setInterval(() => setDueCount(getDueCount()), 60_000);
    return () => clearInterval(id);
  }, []);

  function handleExportICS() {
    const ics = generateICS(loadTimelineEvents(), loadAimsTasks());
    downloadICS(ics);
  }

  return (
    <>
      <NavBar
        dueCount={dueCount}
        onBellClick={() => setShowPopCenter(true)}
      />
      <ReminderToasts />
      {showPopCenter && <PopCenter onClose={() => setShowPopCenter(false)} />}

      <Routes>
        <Route path="/" element={
          <WelcomeScreen
            onNav={nav}
            testStats={testStats}
            faStats={faStats}
            streak={getStreak()}
            questions={questions}
          />
        } />
        <Route path="/tests" element={
          <TestDashboard onBack={() => nav("/")} onStudy={(deckFile, block) => nav("/tests/review", { state: { deckFile, block } })} />
        } />
        <Route path="/tests/review" element={
          <TestReview onBack={() => nav("/tests")} />
        } />
        <Route path="/fa" element={
          <FADashboard onBack={() => nav("/")} onTrack={() => nav("/fa/study")} />
        } />
        <Route path="/fa/study" element={
          <FATracker onBack={() => nav("/fa")} />
        } />
        <Route path="/timeline" element={
          <Timeline onExportICS={handleExportICS} />
        } />
        <Route path="/aims" element={
          <AIMSDashboard />
        } />
        <Route path="*" element={
          <WelcomeScreen
            onNav={nav}
            testStats={testStats}
            faStats={faStats}
            streak={getStreak()}
            questions={questions}
          />
        } />
      </Routes>
    </>
  );
}
