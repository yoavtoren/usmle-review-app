import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { cleanupRemovedAreas, maybeAutoReset } from "./lib/storage.js";
import { initNative } from "./lib/native.js";
import { initICloudSync } from "./lib/icloudSync.js";
import { initSound } from "./lib/sound.js";
import { SUBJECTS } from "./lib/subjectColors.js";
import "./styles.css";

// Subject palette lives in subjectColors.js — project it onto the CSS custom
// props at boot so the stylesheet's --subj-* vars can never drift from the JS.
function injectSubjectColors() {
  const root = document.documentElement;
  for (const [key, { hex }] of Object.entries(SUBJECTS)) {
    root.style.setProperty(`--subj-${key}`, hex);
  }
}

function render() {
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  );
}

async function boot() {
  injectSubjectColors();

  // One-time reset: wipe saved tasks/events from removed areas, keep USMLE progress.
  cleanupRemovedAreas();

  // Native (iOS) bootstrap — no-op on the web build.
  initNative();

  // Soft tactile audio on every interactive press (WebAudio, offline-safe).
  initSound();

  // Pull iCloud progress into localStorage before first render (no-op on web or
  // when not signed into iCloud). Never let a sync hiccup block startup.
  try { await initICloudSync(); } catch {}

  // One-time full progress reset. Runs AFTER the iCloud pull + storage patch so
  // the wipe (and its guard flag) propagate to iCloud instead of being undone by
  // the next reconcile. Guard flag is a synced key → runs once across devices.
  maybeAutoReset();

  render();
}

boot();
