import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the production build work when opened from any local folder.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
