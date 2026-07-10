import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For the native (Capacitor/iOS) build, assets are served from the app bundle
// root, so use a relative base. The web (GitHub Pages) build keeps its subpath.
// Each build writes to its own outDir (dist vs dist-ios) so a web-base build
// can never be cap-synced into the native app — that yields a blank screen.
const isNative = process.env.CAP_BUILD === "1";

export default defineConfig({
  plugins: [react()],
  base: isNative ? "./" : "/usmle-review-app/",
  build: {
    outDir: isNative ? "dist-ios" : "dist",
    rollupOptions: {
      output: {
        // WKWebView can serve unknown extensions like .mjs as
        // application/octet-stream, which WebKit rejects for module scripts
        // ("Importing a module script failed" — seen in TestFlight installs).
        // Emit module assets (pdf.js worker) with a .js extension so they
        // always get a JavaScript MIME type.
        assetFileNames: (info) =>
          (info.names?.[0] || info.name || "").endsWith(".mjs")
            ? "assets/[name]-[hash].js"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
});
