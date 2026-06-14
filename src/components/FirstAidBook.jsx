import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { FA_PDF_URL, FA_INDEX_URL, FA_CONTENTS, FA_TOTAL_PAGES } from "../lib/firstAidData.js";

const LAST_PAGE_KEY = "fa-book-last-page";

export default function FirstAidBook() {
  const [page, setPage]       = useState(() => {
    const saved = Number(localStorage.getItem(LAST_PAGE_KEY));
    return saved >= 1 && saved <= FA_TOTAL_PAGES ? saved : 1;
  });
  const [available, setAvailable] = useState(null); // null = checking, true/false
  const [index, setIndex]     = useState([]);
  const [query, setQuery]     = useState("");
  const [openSec, setOpenSec] = useState(() => new Set(["s2", "s3"]));
  const [pageInput, setPageInput] = useState("");
  const [mobilePanel, setMobilePanel] = useState(false);

  // Check whether the local PDF is present (it's gitignored / local-only)
  useEffect(() => {
    let alive = true;
    fetch(FA_PDF_URL, { method: "HEAD" })
      .then(r => { if (alive) setAvailable(r.ok); })
      .catch(() => { if (alive) setAvailable(false); });
    return () => { alive = false; };
  }, []);

  // Lazy-load the index
  useEffect(() => {
    let alive = true;
    fetch(FA_INDEX_URL)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (alive) setIndex(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const go = useCallback((p) => {
    const n = Math.max(1, Math.min(FA_TOTAL_PAGES, Math.round(p)));
    setPage(n);
    localStorage.setItem(LAST_PAGE_KEY, String(n));
    setMobilePanel(false);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out = [];
    for (const e of index) {
      const t = e.t.toLowerCase();
      if (t.includes(q)) {
        // rank: prefix match first
        out.push({ ...e, rank: t.startsWith(q) ? 0 : 1 });
        if (out.length > 400) break;
      }
    }
    out.sort((a, b) => a.rank - b.rank || a.t.length - b.t.length);
    return out.slice(0, 60);
  }, [query, index]);

  function toggleSec(id) {
    setOpenSec(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const src = `${FA_PDF_URL}#page=${page}&zoom=page-width`;

  return (
    <div className="fa-book">
      {/* ── Sidebar / contents ── */}
      <aside className={`fa-side${mobilePanel ? " open" : ""}`}>
        <div className="fa-side-hd">
          <div>
            <h1 className="fa-side-title">First Aid 2025</h1>
            <p className="fa-side-sub">Step 1 · {FA_TOTAL_PAGES} עמ'</p>
          </div>
        </div>

        {/* Search */}
        <div className="fa-search-wrap">
          <input
            className="fa-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="🔍 חפש נושא (אנגלית)…"
          />
          {query && <button className="fa-search-clear" onClick={() => setQuery("")}>✕</button>}
        </div>

        {/* Search results OR contents tree */}
        {query.trim().length >= 2 ? (
          <div className="fa-results">
            <div className="fa-results-hd">{results.length ? `${results.length} תוצאות` : "אין תוצאות"}</div>
            {results.map((e, i) => (
              <button key={i} className="fa-result" onClick={() => go(e.p)}>
                <span className="fa-result-t">{e.t}</span>
                <span className="fa-result-p">{e.p}</span>
              </button>
            ))}
          </div>
        ) : (
          <nav className="fa-toc">
            {FA_CONTENTS.map(sec => {
              const open = openSec.has(sec.id);
              return (
                <div key={sec.id} className="fa-toc-sec">
                  <button className="fa-toc-sec-hd" onClick={() => toggleSec(sec.id)} style={{ "--c": sec.color }}>
                    <span className="fa-toc-caret" style={{ transform: open ? "rotate(90deg)" : "none" }}>›</span>
                    <span className="fa-toc-sec-dot" />
                    <span className="fa-toc-sec-title">{sec.title}</span>
                  </button>
                  {open && (
                    <div className="fa-toc-children">
                      {sec.children.map((ch, i) => (
                        <button key={i}
                          className={`fa-toc-item${page === ch.page ? " active" : ""}`}
                          onClick={() => go(ch.page)}>
                          <span className="fa-toc-item-t">{ch.title}</span>
                          <span className="fa-toc-item-p">{ch.page}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        )}
      </aside>

      {/* ── Viewer ── */}
      <main className="fa-viewer">
        <div className="fa-toolbar">
          <button className="fa-mobile-toggle" onClick={() => setMobilePanel(p => !p)}>☰ תוכן</button>
          <div className="fa-pager">
            <button className="fa-pg-btn" onClick={() => go(page - 1)} disabled={page <= 1}>‹</button>
            <form
              className="fa-pg-form"
              onSubmit={e => { e.preventDefault(); const n = parseInt(pageInput, 10); if (n) go(n); setPageInput(""); }}>
              <input
                className="fa-pg-input"
                value={pageInput}
                onChange={e => setPageInput(e.target.value.replace(/\D/g, ""))}
                placeholder={String(page)}
                inputMode="numeric"
              />
              <span className="fa-pg-total">/ {FA_TOTAL_PAGES}</span>
            </form>
            <button className="fa-pg-btn" onClick={() => go(page + 1)} disabled={page >= FA_TOTAL_PAGES}>›</button>
          </div>
          {available && (
            <a className="fa-open-ext" href={src} target="_blank" rel="noreferrer">פתח בכרטיסייה ↗</a>
          )}
        </div>

        <div className="fa-stage">
          {available === null && <div className="fa-state">בודק זמינות…</div>}
          {available === true && (
            <iframe key={page} className="fa-frame" src={src} title="First Aid 2025" />
          )}
          {available === false && (
            <div className="fa-unavail">
              <div className="fa-unavail-icon">📕</div>
              <h2>הספר זמין במחשב שלך בלבד</h2>
              <p>
                עותק ה‑First Aid נשמר מקומית ולא הועלה לאתר הציבורי (זכויות יוצרים + גודל הקובץ).
                הרץ את האפליקציה מקומית כדי לקרוא — התוכן והניווט עובדים, וכל לחיצה תפתח את העמוד הנכון.
              </p>
              <p className="fa-unavail-hint">
                העמוד הנבחר כעת: <strong>{page}</strong>. דפדוף בתוכן עדיין שומר את מיקומך.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
