import { useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import WelcomeScreen from "./components/WelcomeScreen.jsx";
import TestDashboard from "./components/TestDashboard.jsx";
import TestReview from "./components/TestReview.jsx";
import FADashboard from "./components/FADashboard.jsx";
import FATracker from "./components/FATracker.jsx";
import Timeline from "./components/Timeline.jsx";
import AIMSDashboard from "./components/AIMSDashboard.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ReminderToasts, { PopCenter } from "./components/ReminderToasts.jsx";
import EmailCenter from "./components/EmailCenter.jsx";
import { loadProgress, getCard, isDueRespectingMode, getStreak } from "./lib/storage.js";
import { getDueCount } from "./lib/reminderEngine.js";
import { generateICS, downloadICS } from "./lib/calendarExport.js";
import { loadTimelineEvents } from "./lib/timelineData.js";
import { loadAllWorkstreamTasks } from "./lib/workstreamData.js";
import { maybeSendDailyDigest } from "./lib/emailService.js";
import WorkstreamPage from "./components/WorkstreamPage.jsx";
import HomePage from "./components/HomePage.jsx";
import MedSchoolHub from "./components/MedSchoolHub.jsx";
import MedSchoolSubject from "./components/MedSchoolSubject.jsx";
import FirstAidBook from "./components/FirstAidBook.jsx";
import TasksPage from "./components/TasksPage.jsx";

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
  const loc = useLocation();

  const [dueCount, setDueCount]     = useState(getDueCount);
  const [showPopCenter, setShowPopCenter] = useState(false);
  const [showMail, setShowMail]     = useState(false);

  // Refresh bell count every 60s
  useEffect(() => {
    const id = setInterval(() => setDueCount(getDueCount()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Fire the daily email digest once per day if the user enabled it.
  useEffect(() => {
    maybeSendDailyDigest().catch(() => {});
  }, []);

  function handleExportICS() {
    const ics = generateICS(loadTimelineEvents(), loadAllWorkstreamTasks());
    downloadICS(ics);
  }

  // Step 1 & Med School are English / left-to-right; everything else is Hebrew / right-to-left.
  const isEnglishArea = /^\/(step1|tests|fa|medschool)(\/|$)/.test(loc.pathname);
  const areaDir  = isEnglishArea ? "ltr" : "rtl";
  const areaLang = isEnglishArea ? "en" : "he";

  return (
    <div className="app-shell">
      <Sidebar
        dueCount={dueCount}
        onBellClick={() => setShowPopCenter(true)}
        onMailClick={() => setShowMail(true)}
      />

      <main className="app-main">
        <ReminderToasts />
        {showPopCenter && <PopCenter onClose={() => setShowPopCenter(false)} />}
        {showMail && <EmailCenter onClose={() => setShowMail(false)} testStats={testStats} faStats={faStats} />}

        <div className={`route-fade${isEnglishArea ? " area-ltr" : " area-rtl"}`} key={loc.pathname} dir={areaDir} lang={areaLang}>
          <Routes>
            <Route path="/" element={
              <HomePage testStats={testStats} faStats={faStats} streak={getStreak()} />
            } />
            <Route path="/step1" element={
              <WelcomeScreen
                onNav={nav}
                testStats={testStats}
                faStats={faStats}
                streak={getStreak()}
                questions={questions}
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
            <Route path="/timeline" element={
              <Timeline onExportICS={handleExportICS} />
            } />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/aims"     element={<AIMSDashboard />} />
            <Route path="/medcross"  element={<WorkstreamPage categoryId="medcross" />} />
            <Route path="/selfcare"  element={<WorkstreamPage categoryId="selfcare" />} />
            <Route path="/medschool" element={<MedSchoolHub />} />
            <Route path="/medschool/subject/:subjectId" element={<MedSchoolSubject />} />
            <Route path="*" element={
              <HomePage testStats={testStats} faStats={faStats} streak={getStreak()} />
            } />
          </Routes>
        </div>
      </main>
    </div>
  );
}
