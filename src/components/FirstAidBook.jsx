import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { FA_PDF_URL, FA_INDEX_URL, FA_CONTENTS, FA_TOTAL_PAGES, FA_CMAP_URL, FA_STD_FONTS_URL, FA_EDITION } from "../lib/firstAidData.js";

// pdf.js renders the PDF itself (to a canvas) instead of handing the file to the
// browser's built-in PDF preview. That built-in viewer (esp. iOS WKWebView)
// ignores `#page=N` URL fragments, so programmatic page jumps did nothing there.
// Driving pdf.js directly gives us reliable, cross-platform page navigation.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const LAST_PAGE_KEY = "fa-book-last-page";

// Zoom multiplier applied on top of the fit-to-width baseline (1 = 100%).
const ZOOM_MIN = 0.75;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

export default function FirstAidBook() {
  const [page, setPage]       = useState(() => {
    const saved = Number(localStorage.getItem(LAST_PAGE_KEY));
    return saved >= 1 && saved <= FA_TOTAL_PAGES ? saved : 1;
  });
  const [status, setStatus]   = useState("loading"); // loading | ready | error
  const [errDetail, setErrDetail] = useState("");
  const [index, setIndex]     = useState([]);
  const [query, setQuery]     = useState("");
  const [openSec, setOpenSec] = useState(() => new Set(["s2", "s3"]));
  const [pageInput, setPageInput] = useState("");
  const [mobilePanel, setMobilePanel] = useState(false);
  const [zoom, setZoom] = useState(1); // 1 = fit-to-width (100%)

  const pdfRef        = useRef(null);   // loaded PDFDocumentProxy
  const canvasRef     = useRef(null);
  const scrollRef     = useRef(null);   // scroll container (measured for fit-width)
  const renderTaskRef = useRef(null);   // in-flight RenderTask, so we can cancel
  const lastRenderedPageRef = useRef(0); // preserve scroll position on same-page re-renders (zoom/resize)

  // Load the document once with pdf.js
  useEffect(() => {
    let cancelled = false;
    const task = pdfjsLib.getDocument({
      url: FA_PDF_URL,
      // First Aid embeds no fonts — pdf.js needs its substitute fonts and CID
      // cMaps to render glyphs at the correct widths (otherwise text is garbled).
      cMapUrl: FA_CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: FA_STD_FONTS_URL,
    });
    task.promise
      .then(doc => {
        if (cancelled) { doc.destroy(); return; }
        pdfRef.current = doc;
        setStatus("ready");
      })
      .catch(err => {
        if (cancelled) return;
        setErrDetail(`${err?.name || "Error"}: ${err?.message || String(err)}`);
        setStatus("error");
      });
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
    const scale = (avail / base.width) * zoom * dpr; // fit-to-width is the 100% baseline
    const viewport = pg.getViewport({ scale });

    // Same-page re-render (zoom / resize): keep the reader's relative position.
    const samePage = lastRenderedPageRef.current === page;
    const prevFrac = scroll.scrollHeight > 0 ? scroll.scrollTop / scroll.scrollHeight : 0;

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

    const ctx = canvas.getContext("2d");
    const task = pg.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try {
      await task.promise;
      lastRenderedPageRef.current = page;
      scroll.scrollTop = samePage ? prevFrac * scroll.scrollHeight : 0;
    } catch { /* render cancelled — expected on rapid page changes */ }
  }, [page, zoom]);

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

  const zoomBy = useCallback((delta) => {
    setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100)));
  }, []);

  // Pinch-zoom: trackpad pinch / ctrl+wheel (and cmd+wheel) over the page.
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    };
    scroll.addEventListener("wheel", onWheel, { passive: false });
    return () => scroll.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  // Keyboard page navigation (skipped while typing in the search / page inputs).
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(page - 1);
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        go(page + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, page]);

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
            <h1 className="fa-side-title">{FA_EDITION}</h1>
            <p className="fa-side-sub">Step 1 · {FA_TOTAL_PAGES} p.</p>
          </div>
        </div>

        {/* Search */}
        <div className="fa-search-wrap">
          <input
            className="fa-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="🔍 Search topics…"
          />
          {query && <button className="fa-search-clear" onClick={() => setQuery("")}>✕</button>}
        </div>

        {/* Search results OR contents tree */}
        {query.trim().length >= 2 ? (
          <div className="fa-results">
            <div className="fa-results-hd">{results.length ? `${results.length} results` : "No results"}</div>
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
          <button className="fa-mobile-toggle" onClick={() => setMobilePanel(p => !p)}>☰ Contents</button>
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
          <div className="fa-pager">
            <button className="fa-pg-btn" onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} title="Zoom out">−</button>
            <button
              className="fa-pg-btn"
              style={{ width: "auto", padding: "0 10px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}
              onClick={() => setZoom(1)}
              title="Reset zoom (fit width)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button className="fa-pg-btn" onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} title="Zoom in">+</button>
          </div>
        </div>

        <div className="fa-stage">
          {status === "loading" && <div className="fa-state">Loading book…</div>}
          {status === "error" && (
            <div className="fa-unavail" dir="ltr">
              <div className="fa-unavail-icon">📕</div>
              <h2>The book is only available in the local app</h2>
              <p>
                The First Aid copy is stored locally and is not uploaded to the public site
                (copyright + file size). Run the app locally to read — the contents and
                navigation still work, and every click opens the right page.
              </p>
              <p className="fa-unavail-hint">
                Currently selected page: <strong>{page}</strong>. Browsing the contents still saves your place.
                If you see this in the desktop or iPad app, quit and relaunch the app to retry.
              </p>
              {errDetail && <p className="fa-unavail-detail" dir="ltr">{errDetail}</p>}
            </div>
          )}
          <div
            className="fa-scroll"
            ref={scrollRef}
            style={{
              display: status === "ready" ? "flex" : "none",
              // LTR + start-aligned so a zoomed page stays fully reachable by scrolling;
              // the canvas centers itself via auto margins when it fits.
              direction: "ltr",
              justifyContent: "flex-start",
            }}
          >
            <canvas
              ref={canvasRef}
              className="fa-canvas"
              style={{ margin: "0 auto", maxWidth: zoom > 1 ? "none" : "100%" }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
