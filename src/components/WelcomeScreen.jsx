export default function WelcomeScreen({ onNav, testStats, faStats }) {
  return (
    <div className="welcome">
      <div className="welcome-hero">
        <div className="welcome-logo">⚕️</div>
        <h1 className="welcome-title">USMLE Step 1</h1>
        <p className="welcome-sub">Personal Review Dashboard</p>
      </div>

      <div className="welcome-cards">
        <button className="welcome-card" onClick={() => onNav("tests")}>
          <div className="wcard-icon">📝</div>
          <div className="wcard-body">
            <h2>Test Review</h2>
            <p className="wcard-meta">May 18, 2026 · 28% score</p>
            <p className="wcard-desc">
              Review the questions you missed. Spaced repetition tracks what needs
              re-study.
            </p>
            <div className="wcard-stats">
              <span className="wstat">
                <b>{testStats.missed}</b> missed
              </span>
              <span className="wstat">
                <b>{testStats.mastered}</b> mastered
              </span>
              <span className="wstat">
                <b>{testStats.due}</b> due today
              </span>
            </div>
          </div>
          <span className="wcard-arrow">→</span>
        </button>

        <button className="welcome-card" onClick={() => onNav("fa")}>
          <div className="wcard-icon">📖</div>
          <div className="wcard-body">
            <h2>First Aid Tracker</h2>
            <p className="wcard-meta">First Aid for USMLE Step 1</p>
            <p className="wcard-desc">
              Track your coverage across all 16 chapters of First Aid. Mark topics
              as you study them.
            </p>
            <div className="wcard-stats">
              <span className="wstat">
                <b>{faStats.seen}</b> / {faStats.total} topics
              </span>
              <span className="wstat progress-pct">
                <b>{Math.round((faStats.seen / faStats.total) * 100)}%</b> covered
              </span>
            </div>
            <div className="wcard-bar-wrap">
              <div
                className="wcard-bar-fill"
                style={{ width: `${(faStats.seen / faStats.total) * 100}%` }}
              />
            </div>
          </div>
          <span className="wcard-arrow">→</span>
        </button>
      </div>
    </div>
  );
}
