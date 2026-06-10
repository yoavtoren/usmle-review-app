export default function WelcomeScreen({ onNav, testStats, faStats, streak }) {
  const faPct = faStats.total > 0 ? Math.round((faStats.seen / faStats.total) * 100) : 0;
  const testPct = testStats.total > 0 ? Math.round((testStats.mastered / testStats.total) * 100) : 0;

  return (
    <div className="welcome">
      <div className="welcome-hero">
        <div className="welcome-logo">⚕️</div>
        <h1 className="welcome-title">USMLE Step 1</h1>
        <p className="welcome-sub">Personal Review Dashboard</p>
        {streak > 0 && (
          <div className="streak-badge">🔥 {streak}-day streak</div>
        )}
      </div>

      <div className="quick-stats">
        <div className="qs-item">
          <span className={`qs-num${testStats.due > 0 ? " qs-due" : ""}`}>{testStats.due}</span>
          <span className="qs-label">due today</span>
        </div>
        <div className="qs-divider" />
        <div className="qs-item">
          <span className="qs-num">{testStats.mastered}</span>
          <span className="qs-label">mastered</span>
        </div>
        <div className="qs-divider" />
        <div className="qs-item">
          <span className="qs-num">{testStats.missed - testStats.mastered > 0 ? testStats.missed - testStats.mastered : 0}</span>
          <span className="qs-label">remaining</span>
        </div>
        <div className="qs-divider" />
        <div className="qs-item">
          <span className="qs-num">{faPct}%</span>
          <span className="qs-label">FA covered</span>
        </div>
      </div>

      <div className="welcome-cards">
        <button className="welcome-card" onClick={() => onNav("tests-dash")}>
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
              {testStats.due > 0 && (
                <span className="wstat wstat-due">
                  <b>{testStats.due}</b> due now
                </span>
              )}
            </div>
            <div className="wcard-bar-wrap">
              <div className="wcard-bar-fill" style={{ width: `${testPct}%` }} />
            </div>
          </div>
          <span className="wcard-arrow">→</span>
        </button>

        <button className="welcome-card" onClick={() => onNav("fa-dash")}>
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
                <b>{faPct}%</b> covered
              </span>
            </div>
            <div className="wcard-bar-wrap">
              <div className="wcard-bar-fill" style={{ width: `${faPct}%` }} />
            </div>
          </div>
          <span className="wcard-arrow">→</span>
        </button>
      </div>

      <p className="welcome-footer muted">100% offline · progress saved in this browser</p>
    </div>
  );
}
