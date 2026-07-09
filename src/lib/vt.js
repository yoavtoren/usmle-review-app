import { flushSync } from "react-dom";

// View Transitions API wrapper. Degrades to a plain synchronous update on
// browsers without startViewTransition or when the user prefers reduced motion
// (the CSS route-fade fallback still runs in that case).

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function withViewTransition(update) {
  if (typeof document === "undefined" || !document.startViewTransition || prefersReducedMotion()) {
    update();
    return null;
  }

  const html = document.documentElement;
  // vt-active lets the stylesheet suppress the old CSS route animation so the
  // two choreographies never run at once.
  html.classList.add("vt-active");
  const release = () => html.classList.remove("vt-active");

  let transition;
  try {
    transition = document.startViewTransition(() => {
      try {
        // flushSync so React commits the new DOM before the browser captures
        // the "new" snapshot.
        flushSync(update);
      } catch (err) {
        // A render error must not strand the class; rethrow so the browser
        // skips the transition (finished rejects → release below is a no-op).
        release();
        throw err;
      }
    });
  } catch (err) {
    release();
    throw err;
  }

  transition.finished.finally(release).catch(() => {});
  return transition;
}

export function vtNavigate(nav, to, opts) {
  withViewTransition(() => nav(to, opts));
}
