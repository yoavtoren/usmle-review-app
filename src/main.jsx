import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { cleanupRemovedAreas } from "./lib/storage.js";
import { initNative } from "./lib/native.js";
import { initICloudSync } from "./lib/icloudSync.js";
import { initSound } from "./lib/sound.js";
import "./styles.css";

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
  // One-time reset: wipe saved tasks/events from removed areas, keep USMLE progress.
  cleanupRemovedAreas();

  // Native (iOS) bootstrap — no-op on the web build.
  initNative();

  // Soft tactile audio on every interactive press (WebAudio, offline-safe).
  initSound();

  // Pull iCloud progress into localStorage before first render (no-op on web or
  // when not signed into iCloud). Never let a sync hiccup block startup.
  try { await initICloudSync(); } catch {}

  render();
}

boot();
