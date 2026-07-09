import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { FA_PDF_URL, FA_INDEX_URL, FA_CONTENTS, FA_TOTAL_PAGES } from "../lib/firstAidData.js";

// pdf.js renders the PDF itself (to a canvas) instead of handing the file to the
// browser's built-in PDF preview. That built-in viewer (esp. iOS WKWebView)
// ignores `#page=N` URL fragments, so programmatic page jumps did nothing there.
// Driving pdf.js directly gives us reliable, cross-platform page navigation.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const LAST_PAGE_KEY = "fa-book-last-page";

export default function FirstAidBook() {
  const [page, setPage]       = useState(() => {
    const saved = Number(localStorage.getItem(LAST_PAGE_KEY));
    return saved >= 1 && saved <= FA_TOTAL_PAGES ? saved : 1;
  });
  const [status, setStatus]   = useState("loading"); // loading | ready | error
  const [index, setIndex]     = useState([]);
  const [query, setQuery]     = useState("");
  const [openSec, setOpenSec] = useState(() => new Set(["s2", "s3"]));
  const [pageInput, setPageInput] = useState("");
  const [mobilePanel, setMobilePanel] = useState(false);

  const pdfRef        = useRef(null);   // loaded PDFDocumentProxy
  const canvasRef     = useRef(null);
  const scrollRef     = useRef(null);   // scroll container (measured for fit-width)
  const renderTaskRef = useRef(null);   // in-flight RenderTask, so we can cancel

  // Load the document once with pdf.js
  useEffect(() => {
    let cancelled = false;
    const task = pdfjsLib.getDocument({ url: FA_PDF_URL });
    task.promise
      .then(doc => {
        if (cancelled) { doc.destroy(); return; }
        pdfRef.current = doc;
        setStatus("ready");
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => {
      cancelled = true;
      try { task.destroy(); } catch {}
      try { pdfRef.current?.destroy(); } catch {}
      pdfRef.current = null;
    };
  }, []);

  // Lazy-load the search index
  useEffect(() => {
    let alive = true;
    fetch(FA_INDEX_URL)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (alive) setIndex(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Render the current page to the canvas, fit to the container width.
  const renderPage = useCallback(async () => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    const scroll = scrollRef.current;
    if (!doc || !canvas || !scroll) return;

    renderTaskRef.current?.cancel();

    let pg;
    try { pg = await doc.getPage(page); } catch { return; }
    if (canvasRef.current !== canvas) return; // unmounted mid-await

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const base = pg.getViewport({ scale: 1 });
    const avail = Math.max(240, scroll.clientWidth - 32); // 16px padding each side
    const scale = (avail / base.width) * dpr;
    const viewport = pg.getViewport({ scale });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

    const ctx = canvas.getContext("2d");
    const task = pg.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try {
      await task.promise;
      scroll.scrollTop = 0;
    } catch { /* render cancelled — expected on rapid page changes */ }
  }, [page]);

  // Re-render on ready / page change
  useEffect(() => {
    if (status === "ready") renderPage();
  }, [status, page, renderPage]);

  // Re-render (fit width) when the stage resizes — orientation, sidebar toggle…
  useEffect(() => {
    if (status !== "ready") return;
    const scroll = scrollRef.current;
    if (!scroll || typeof ResizeObserver === "undefined") return;
    let t;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(renderPage, 150); });
    ro.observe(scroll);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [status, renderPage]);

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
        </div>

        <div className="fa-stage">
          {status === "loading" && <div className="fa-state">טוען ספר…</div>}
          {status === "error" && (
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
          <div className="fa-scroll" ref={scrollRef} style={{ display: status === "ready" ? "flex" : "none" }}>
            <canvas ref={canvasRef} className="fa-canvas" />
          </div>
        </div>
      </main>
    </div>
  );
}
