export default function WelcomeScreen({ onNav, testStats, faStats, streak }) {
  const faPct  = faStats.total  > 0 ? Math.round((faStats.seen  / faStats.total)  * 100) : 0;
  const testPct = testStats.total > 0 ? Math.round((testStats.mastered / testStats.total) * 100) : 0;
  const remaining = Math.max(0, testStats.missed - testStats.mastered);

  return (
    <div className="welcome">

      {/* ── Full-width hero banner ── */}
      <div className="welcome-banner">
        <div className="welcome-logo">⚕️</div>
        <h1 className="welcome-title">USMLE Step 1</h1>
        <p className="welcome-sub">Personal Review Dashboard</p>
        {streak > 0 && (
          <div className="streak-badge">🔥 {streak}-day streak</div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="welcome-body">

        {/* Floating stats bar */}
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
            <span className="qs-num">{remaining}</span>
            <span className="qs-label">remaining</span>
          </div>
          <div className="qs-divider" />
          <div className="qs-item">
            <span className="qs-num">{faPct}%</span>
            <span className="qs-label">FA covered</span>
          </div>
        </div>

        {/* Feature cards — 2-col on desktop */}
        <div className="welcome-cards">

          <button className="welcome-card wcard-blue" onClick={() => onNav("tests-dash")}>
            <div className="wcard-top">
              <div className="wcard-icon-wrap">📝</div>
              <span className="wcard-arrow">→</span>
            </div>
            <div className="wcard-body">
              <h2>Tests</h2>
              <p className="wcard-desc">
                Review every missed question with spaced repetition — the app tracks
                what needs re-study and surfaces it at the right time.
              </p>
              <div className="wcard-stats">
                <div className="wstat-block">
                  <span className="wstat-big">{testStats.missed}</span>
                  <span className="wstat-lbl">missed</span>
                </div>
                <div className="wstat-block wstat-ok">
                  <span className="wstat-big">{testStats.mastered}</span>
                  <span className="wstat-lbl">mastered</span>
                </div>
                {testStats.due > 0 && (
                  <div className="wstat-block wstat-warn">
                    <span className="wstat-big">{testStats.due}</span>
                    <span className="wstat-lbl">due now</span>
                  </div>
                )}
              </div>
              <div className="wcard-prog">
                <div className="wcard-prog-bar" style={{ width: `${testPct || 2}%` }} />
              </div>
              <span className="wcard-cta">Open dashboard →</span>
            </div>
          </button>

          <button className="welcome-card wcard-green" onClick={() => onNav("fa-dash")}>
            <div className="wcard-top">
              <div className="wcard-icon-wrap">📖</div>
              <span className="wcard-arrow">→</span>
            </div>
            <div className="wcard-body">
              <h2>First Aid Tracker</h2>
              <p className="wcard-desc">
                Track your coverage across all 16 First Aid chapters. Mark topics
                as you study and see exactly where you stand.
              </p>
              <div className="wcard-stats">
                <div className="wstat-block">
                  <span className="wstat-big">{faStats.seen}</span>
                  <span className="wstat-lbl">topics done</span>
                </div>
                <div className="wstat-block">
                  <span className="wstat-big">{faStats.total}</span>
                  <span className="wstat-lbl">total topics</span>
                </div>
                <div className="wstat-block wstat-ok">
                  <span className="wstat-big">{faPct}%</span>
                  <span className="wstat-lbl">covered</span>
                </div>
              </div>
              <div className="wcard-prog">
                <div className="wcard-prog-bar" style={{ width: `${faPct || 2}%` }} />
              </div>
              <span className="wcard-cta">Open tracker →</span>
            </div>
          </button>

        </div>

        <p className="welcome-footer muted">100% offline · progress saved in this browser</p>
      </div>
    </div>
  );
}
