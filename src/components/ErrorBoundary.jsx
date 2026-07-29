import { Component } from "react";
import { exportAllData } from "../lib/storage.js";
import { localISODate } from "../lib/config.js";

// Route-level crash guard.
//
// The shell only ever handled *fetch* failures (DataErrorBanner). Any render
// throw — a malformed synced value reaching a chart, a bad date, a missing
// field after an import — unmounted the whole tree and left a blank page with
// no way to reach the export button. That is the worst possible moment to lose
// access to your data, so the fallback leads with "download a backup".
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  download = () => {
    try {
      const blob = new Blob([exportAllData()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `usmle-backup-${localISODate()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { /* nothing more we can do from here */ }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="page page-narrow eb" dir="rtl" lang="he" role="alert">
        <div className="eb-card">
          <span className="eb-ico" aria-hidden="true">⚠</span>
          <h1 className="eb-title">משהו נשבר במסך הזה</h1>
          <p className="eb-sub">
            ההתקדמות שלך שמורה ולא נפגעה. אפשר לחזור לדף הבית, או להוריד גיבוי מלא
            לפני שממשיכים — ליתר ביטחון.
          </p>
          <div className="eb-actions">
            <button className="btn-primary" onClick={() => { window.location.hash = "#/"; window.location.reload(); }}>
              חזרה לדף הבית
            </button>
            <button className="btn-secondary" onClick={this.download}>הורד גיבוי מלא</button>
          </div>
          <details className="eb-details">
            <summary>פרטים טכניים</summary>
            <pre dir="ltr">{String(error?.stack || error?.message || error)}</pre>
          </details>
        </div>
      </div>
    );
  }
}
