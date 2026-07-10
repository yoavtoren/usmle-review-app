import { useEffect, useRef, useState } from "react";
import {
  getSyncStatus, subscribeSyncStatus, syncNow, isLoginSkipped, setLoginSkipped,
} from "../lib/icloudSync.js";
import { adoptAuthButton, releaseAuthButtons } from "../lib/cloudkitWeb.js";
import { IconCheck, IconPulse } from "./icons.jsx";

function useSyncStatus() {
  const [s, setS] = useState(getSyncStatus);
  useEffect(() => subscribeSyncStatus(setS), []);
  return s;
}

// Hosts Apple's official sign-in/out button (rendered once by CloudKit JS and
// adopted into whichever card is currently showing it).
function AppleButton({ kind }) {
  const ref = useRef(null);
  useEffect(() => {
    adoptAuthButton(kind, ref.current);
    return () => releaseAuthButtons();
  }, [kind]);
  return <div ref={ref} className="acct-apple-btn" />;
}

function fmtTime(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

const STATE_LABEL = {
  on:           { txt: "מסונכרן", cls: "ok" },
  "signed-out": { txt: "לא מחובר", cls: "warn" },
  loading:      { txt: "מתחבר…", cls: "" },
  unconfigured: { txt: "דרושה הגדרה", cls: "warn" },
  unavailable:  { txt: "iCloud כבוי במכשיר", cls: "warn" },
  off:          { txt: "כבוי", cls: "" },
};

function SyncBody({ s, inGate = false, onSkip }) {
  const [busy, setBusy] = useState(false);
  const doSync = async () => {
    setBusy(true);
    try { await syncNow(); } finally { setBusy(false); }
  };

  if (s.platform === "native") {
    if (s.state === "on") {
      return (
        <>
          <p className="acct-line"><IconCheck size={15} /> ההתקדמות מסונכרנת דרך חשבון Apple של המכשיר — אין צורך בהתחברות.</p>
          <p className="acct-meta">
            ערוץ: {s.backendKind === "cloudkit-native" ? "CloudKit (משותף עם הדפדפן)" : "iCloud Key-Value (CloudKit יופעל אוטומטית אחרי ההגדרה החד-פעמית בקונסולת iCloud — ראה ICLOUD_SETUP.md)"}
            {" · "}סנכרון אחרון: {fmtTime(s.lastSyncAt)}
          </p>
          <button className="btn-secondary" onClick={doSync} disabled={busy}>{busy ? "מסנכרן…" : "סנכרן עכשיו"}</button>
        </>
      );
    }
    return <p className="acct-line">כדי לסנכרן, היכנס ל-iCloud בהגדרות המכשיר (Settings → Apple ID → iCloud) והפעל את האפליקציה מחדש.</p>;
  }

  // web
  switch (s.state) {
    case "on":
      return (
        <>
          <p className="acct-line"><IconCheck size={15} /> מחובר בתור <b>{s.user || "Apple ID"}</b> — כל שינוי נשמר לחשבון ומגיע לכל המכשירים.</p>
          <p className="acct-meta">סנכרון אחרון: {fmtTime(s.lastSyncAt)}</p>
          <div className="acct-actions">
            <button className="btn-secondary" onClick={doSync} disabled={busy}>{busy ? "מסנכרן…" : "סנכרן עכשיו"}</button>
            <AppleButton kind="out" />
          </div>
        </>
      );
    case "signed-out":
      return (
        <>
          <p className="acct-line">התחבר עם חשבון Apple כדי שההתקדמות — מבחנים, תכנון, First Aid וכרטיסיות — תסונכרן לכל המכשירים המחוברים לאותו חשבון.</p>
          <AppleButton kind="in" />
          {inGate && (
            <button className="acct-skip" onClick={onSkip}>לא עכשיו — המשך בלי סנכרון</button>
          )}
        </>
      );
    case "loading":
      return <p className="acct-line">מתחבר ל-iCloud…</p>;
    case "unconfigured":
      return (
        <p className="acct-line">
          סנכרון בדפדפן עדיין לא הוגדר: חסר CloudKit JS API token ב-<code>src/lib/cloudConfig.js</code>.
          ההוראות המלאות ב-<code>ICLOUD_SETUP.md</code>. (האפליקציות המקומיות במק ובאייפד מסתנכרנות גם בלי זה.)
        </p>
      );
    default:
      return <p className="acct-line">הסנכרון כבוי{s.error ? ` — ${s.error}` : ""}.</p>;
  }
}

export default function AccountPage() {
  const s = useSyncStatus();
  const st = STATE_LABEL[s.state] || STATE_LABEL.off;
  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Apple ID</div>
          <h1 className="page-title">פרופיל <em>וסנכרון</em></h1>
          <p className="page-sub">
            כל ההתקדמות נשמרת בבסיס הנתונים הפרטי שלך ב-iCloud ומסתנכרנת בין הדפדפן,
            האייפד והמק — לפי מי שמחובר לאותו חשבון Apple.
          </p>
        </div>
      </div>

      <div className="acct-card">
        <div className="acct-card-head">
          <span className="acct-title">מצב סנכרון</span>
          <span className={`acct-state ${st.cls}`}>{st.txt}</span>
        </div>
        <SyncBody s={s} />
        {s.error && s.state === "on" && <p className="acct-error">שגיאת סנכרון אחרונה: {s.error}</p>}
      </div>

      <p className="acct-footnote">
        מיזוג לפי "השינוי האחרון מנצח" עבור כל תחום בנפרד. לפני הקישור הראשון נשמר גיבוי
        מקומי מלא (usmle:icloud-prelink-backup), וייצוא ידני זמין דרך מסך האימייל.
      </p>
    </div>
  );
}

// Full-screen first-visit gate on the web build: sign in with Apple, or skip
// (device-local choice; the Account page can always sign in later).
export function LoginGate() {
  const s = useSyncStatus();
  const [skipped, setSkipped] = useState(isLoginSkipped);
  if (s.platform !== "web" || s.state !== "signed-out" || skipped) return null;
  return (
    <div className="login-gate" dir="rtl" lang="he">
      <div className="login-card">
        <span className="login-mark"><IconPulse size={22} /></span>
        <h2 className="login-title">לוח ההישרדות</h2>
        <p className="login-sub">התחבר עם Apple כדי להמשיך בדיוק מאיפה שעצרת — בכל מכשיר.</p>
        <SyncBody s={s} inGate onSkip={() => { setLoginSkipped(); setSkipped(true); }} />
      </div>
    </div>
  );
}
