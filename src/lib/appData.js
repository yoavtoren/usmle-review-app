// ── Shared fetch cache for the app's static data files ──────────────────────
//
// Every route is keyed by pathname in App.jsx, so navigating REMOUNTS the page
// component and re-runs its data effects. That meant deck.json (~210 KB),
// topic-plan.json, fa-progress.json, profile.json and weakness-seed.json were
// re-fetched on every single navigation — and the Planner additionally re-parsed
// all 16 First Aid chapter markdowns each time it mounted.
//
// These files are build-time static: fetch each one ONCE per session and hand
// every caller the same promise. A failed fetch is not cached, so a retry after
// a dropped connection still works.

const BASE = import.meta.env.BASE_URL;

const cache = new Map(); // path -> Promise

/**
 * Fetch a JSON file from the app's public directory, once per session.
 * @param path   path relative to BASE, e.g. "questions/deck.json"
 * @param fallback value to resolve with if the fetch or parse fails
 */
export function fetchAppJSON(path, fallback = null) {
  const hit = cache.get(path);
  if (hit) return hit;

  const p = fetch(`${BASE}${path}`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .catch((err) => {
      cache.delete(path);   // never cache a failure — retry must be able to win
      if (fallback === undefined) throw err;
      return fallback;
    });

  cache.set(path, p);
  return p;
}

/** Same, for text (First Aid chapter markdown). */
export function fetchAppText(path, fallback = "") {
  const key = `text:${path}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const p = fetch(`${BASE}${path}`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .catch(() => { cache.delete(key); return fallback; });

  cache.set(key, p);
  return p;
}

/** Drop the cache so the next read re-fetches (the deck-error "retry" button). */
export function invalidateAppData(path) {
  if (path) { cache.delete(path); cache.delete(`text:${path}`); }
  else cache.clear();
}
