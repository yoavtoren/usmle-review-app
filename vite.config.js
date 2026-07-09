import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For the native (Capacitor/iOS) build, assets are served from the app bundle
// root, so use a relative base. The web (GitHub Pages) build keeps its subpath.
const isNative = process.env.CAP_BUILD === "1";

export default defineConfig({
  plugins: [react()],
  base: isNative ? "./" : "/usmle-review-app/",
});
