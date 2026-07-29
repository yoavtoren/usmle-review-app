import { defineConfig } from "vitest/config";

// Unit tests cover the pure data/scheduling functions only — the layer where a
// silent regression costs real study data. `jsdom` is not needed: everything
// under test talks to localStorage, which the shim below provides.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/lib/__tests__/setup.js"],
    include: ["src/**/*.test.js"],
  },
});
