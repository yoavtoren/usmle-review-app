import { useMemo, useState } from "react";
import {
  loadEmailConfig, saveEmailConfig, isConfigured, buildDigest, sendDigest,
  getEmailLog, clearEmailLog,
} from "../lib/emailService.js";
import { IconClose, IconMail, IconSettings, IconClock, IconCheck, IconSparkle } from "./icons.jsx";

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "הרגע";
  if (s < 3600) return `לפני ${Math.floor(s / 60)} דק׳`;
  if (s < 86400) return `לפני ${Math.floor(s / 3600)} שע׳`;
  return new Date(ts).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

export default function EmailCenter({ onClose, testStats, faStats }) {
  const [tab, setTab] = useState("digest");
  const [cfg, setCfg] = useState(loadEmailConfig);
  const [status, setStatus] = useState(null); // {kind, msg}
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState(getEmailLog);

  const configured = isConfigured(cfg);

  const digest = useMemo(
    () => buildDigest({ dueReviews: testStats?.due, faCoverage: faStats }),
    [testStats, faStats]
  );

  function patch(p) {
    const next = saveEmailConfig(p);
    setCfg(next);
  }

  async function handleSend() {
    setStatus(null);
    setSending(true);
    try {
      await sendDigest(digest, loadEmailConfig());
      setStatus({ kind: "ok", msg: `נשלח אל ${cfg.toEmail}` });
      setLog(getEmailLog());
    } catch (e) {
      setStatus({ kind: "err", msg: e.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mc-overlay" onClick={onClose}>
      <div className="mc-modal" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="mc-head">
          <div className="mc-head-title">
            <span className="mc-head-ico"><IconMail size={18} /></span>
            <div>
              <div className="mc-head-h">תזכורות באימייל</div>
              <div className="mc-head-sub">
                {configured ? (cfg.enabled ? "תקציר יומי פעיל" : "מוגדר — שליחה ידנית") : "לא מוגדר עדיין"}
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="סגור"><IconClose size={16} /></button>
        </div>

        <div className="mc-tabs">
          {[
            ["digest", "תקציר", <IconSparkle size={15} key="i" />],
            ["settings", "הגדרות", <IconSettings size={15} key="i" />],
            ["history", "היסטוריה", <IconClock size={15} key="i" />],
          ].map(([k, label, ico]) => (
            <button key={k} className={`mc-tab${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>
              {ico}<span>{label}</span>
              {k === "history" && log.length > 0 && <span className="mc-tab-count">{log.length}</span>}
            </button>
          ))}
        </div>

        <div className="mc-body">
          {tab === "digest" && (
            <>
              {!configured && (
                <div className="mc-notice">
                  כדי לשלוח אימייל אמיתי, הוסף את מפתחות EmailJS בלשונית <b>הגדרות</b>. התצוגה למטה היא בדיוק מה שיישלח.
                </div>
              )}
              <div className="mc-preview">
                <div className="mc-preview-subject">{digest.subject}</div>
                <div className="mc-preview-intro">{digest.intro}</div>
                <div className="mc-preview-divider" />
                {digest.sections.map((s, i) => (
                  <div key={i} className="mc-sec">
                    <div className="mc-sec-title">{s.title}</div>
                    {s.lines.map((l, j) => (
                      <div key={j} className="mc-sec-line">{l.replace(/^•\s*/, "")}</div>
                    ))}
                  </div>
                ))}
              </div>

              {status && (
                <div className={`mc-status ${status.kind}`}>
                  {status.kind === "ok" ? <IconCheck size={15} /> : "⚠"} {status.msg}
                </div>
              )}

              <div className="mc-actions">
                <button className="btn-secondary" onClick={onClose}>סגור</button>
                <button className="btn-primary" onClick={handleSend} disabled={!configured || sending}>
                  <IconMail size={15} />
                  {sending ? "שולח…" : "שלח עכשיו"}
                </button>
              </div>
            </>
          )}

          {tab === "settings" && (
            <div className="mc-form">
              <label className="mc-toggle">
                <span>
                  <span className="mc-toggle-title">תקציר יומי אוטומטי</span>
                  <span className="mc-toggle-sub">נשלח פעם ביום כשהאפליקציה פתוחה, אחרי {cfg.sendHour}:00</span>
                </span>
                <button
                  className={`mc-switch${cfg.enabled ? " on" : ""}`}
                  onClick={() => patch({ enabled: !cfg.enabled })}
                  disabled={!configured}
                  aria-pressed={cfg.enabled}
                >
                  <span className="mc-switch-knob" />
                </button>
              </label>

              <div className="mc-field">
                <label>כתובת אימייל לקבלה</label>
                <input className="mc-input" dir="ltr" type="email" value={cfg.toEmail}
                  onChange={(e) => patch({ toEmail: e.target.value })} placeholder="you@example.com" />
              </div>

              <div className="mc-field-row">
                <div className="mc-field">
                  <label>שעת שליחה</label>
                  <input className="mc-input" dir="ltr" type="number" min="0" max="23" value={cfg.sendHour}
                    onChange={(e) => patch({ sendHour: Math.max(0, Math.min(23, +e.target.value || 0)) })} />
                </div>
              </div>

              <div className="mc-divider-label">מפתחות EmailJS</div>
              <div className="mc-field">
                <label>Service ID</label>
                <input className="mc-input" dir="ltr" value={cfg.serviceId}
                  onChange={(e) => patch({ serviceId: e.target.value.trim() })} placeholder="service_xxxxxxx" />
              </div>
              <div className="mc-field">
                <label>Template ID</label>
                <input className="mc-input" dir="ltr" value={cfg.templateId}
                  onChange={(e) => patch({ templateId: e.target.value.trim() })} placeholder="template_xxxxxxx" />
              </div>
              <div className="mc-field">
                <label>Public Key</label>
                <input className="mc-input" dir="ltr" value={cfg.publicKey}
                  onChange={(e) => patch({ publicKey: e.target.value.trim() })} placeholder="xxxxxxxxxxxxxxxx" />
              </div>

              <div className={`mc-config-state ${configured ? "ok" : ""}`}>
                {configured ? <><IconCheck size={14} /> מוגדר ומוכן לשליחה</> : "השלם את שלושת המפתחות כדי לאפשר שליחה"}
              </div>

              <a className="mc-help-link" href="https://dashboard.emailjs.com/admin" target="_blank" rel="noopener noreferrer">
                פתח את לוח הבקרה של EmailJS ↗
              </a>
              <p className="mc-help-text">
                המפתחות נשמרים מקומית בדפדפן בלבד. צור שירות + תבנית עם המשתנים
                <code> subject</code>, <code> intro</code>, <code> body</code>, <code> to_email</code>.
              </p>
            </div>
          )}

          {tab === "history" && (
            <div className="mc-history">
              {log.length === 0 && <div className="mc-empty">עדיין לא נשלחו אימיילים.</div>}
              {log.map((e, i) => (
                <div key={i} className={`mc-log-item${e.ok ? "" : " err"}`}>
                  <span className={`mc-log-dot${e.ok ? " ok" : " err"}`} />
                  <div className="mc-log-body">
                    <div className="mc-log-subject">{e.subject}</div>
                    <div className="mc-log-meta">
                      {e.ok ? `נשלח אל ${e.to}` : `נכשל — ${e.error}`} · {timeAgo(e.at)}
                    </div>
                  </div>
                </div>
              ))}
              {log.length > 0 && (
                <button className="mc-clear" onClick={() => { clearEmailLog(); setLog([]); }}>נקה היסטוריה</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
