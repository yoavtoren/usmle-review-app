import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { cleanupRemovedAreas } from "./lib/storage.js";
import "./styles.css";

// One-time reset: wipe saved tasks/events from removed areas, keep USMLE progress.
cleanupRemovedAreas();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
