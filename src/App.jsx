import { useEffect, useMemo, useState } from "react";
import WelcomeScreen from "./components/WelcomeScreen.jsx";
import TestDashboard from "./components/TestDashboard.jsx";
import TestReview from "./components/TestReview.jsx";
import FADashboard from "./components/FADashboard.jsx";
import FATracker from "./components/FATracker.jsx";
import { loadProgress, getCard, isDue, getStreak } from "./lib/storage.js";

const BASE = import.meta.env.BASE_URL;

export default function App() {
  const [view, setView] = useState("welcome");
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
      if (c.status !== "new" && isDue(c)) due++;
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

  if (view === "tests-dash") return (
    <TestDashboard
      onBack={() => setView("welcome")}
      onStudy={() => setView("tests")}
    />
  );
  if (view === "tests") return <TestReview onBack={() => setView("tests-dash")} />;

  if (view === "fa-dash") return (
    <FADashboard
      onBack={() => setView("welcome")}
      onTrack={() => setView("fa")}
    />
  );
  if (view === "fa") return <FATracker onBack={() => setView("fa-dash")} />;

  return (
    <WelcomeScreen
      onNav={setView}
      testStats={testStats}
      faStats={faStats}
      streak={getStreak()}
    />
  );
}
