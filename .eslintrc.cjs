// Lint config kept deliberately narrow: this is a single-developer app whose
// Stop hook commits, deploys to gh-pages and rebuilds the Mac app on every
// change, with `vite build` as the only gate. Build success does not catch the
// bug classes that actually shipped here — a leaked Capacitor listener, an
// effect reading stale state, an unused import after a refactor — so these are
// the rules that would have caught them. Style is not policed.
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  settings: { react: { version: "detect" } },
  plugins: ["react", "react-hooks"],
  extends: ["eslint:recommended", "plugin:react/recommended", "plugin:react/jsx-runtime"],
  rules: {
    // The two that matter — both caught real bugs in this codebase.
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    "no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true }],
    "no-undef": "error",

    // Empty catch blocks are the house style for "never block the UI on this".
    "no-empty": ["error", { allowEmptyCatch: true }],

    // `while (true)` with an explicit break is the clearest way to express the
    // scheduler's "keep picking until nothing fits" fill loops.
    "no-constant-condition": ["error", { checkLoops: false }],

    // Hebrew copy is full of apostrophes and quotes; escaping them would hurt
    // readability far more than it helps.
    "react/no-unescaped-entities": "off",
    "react/prop-types": "off",
  },
  ignorePatterns: ["dist", "dist-ios", "node_modules", "ios", "public", "src/fonts"],
};
