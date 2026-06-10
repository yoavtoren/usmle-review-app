# USMLE Review Deck — build & safety guide

A personal, **100% offline** review app for the questions you missed. You open it in
Claude Code (inside VSCode), run two commands, and study in your browser. Nothing
is uploaded anywhere; your questions and progress stay on your machine.

---

## 1. Why this design is the safe choice for you

You asked for something that "actually [is] safe" running in local files. Here's what
makes this setup safe and low-risk:

- **No backend, no database, no accounts.** It's a static front-end. There's no server
  storing your data and nothing to misconfigure or expose.
- **No network calls at runtime.** The app only `fetch`es JSON files that sit next to it
  in the same folder. It never calls the internet, so it works fully offline (airplane,
  library Wi-Fi, anywhere).
- **Your progress stays in your browser** via `localStorage` — it never leaves your laptop.
- **Plain, auditable files.** Each question is a readable `.json` file. You (or Claude Code)
  can open and verify exactly what's there. No binary blobs, no hidden data.
- **Few dependencies.** Only React + Vite (both mainstream, widely used). The smaller the
  dependency list, the smaller the risk surface.

The one thing to be normal-careful about, like any JS project: only run
`npm install` for *this* project's `package.json`, and don't paste in random
dependencies you don't recognize. Everything here uses well-known packages.

---

## 2. Run it (the whole workflow)

Prerequisite: **Node.js 18+** installed (`node -v` to check; if missing, get it from
nodejs.org or `brew install node`).

In VSCode, open the `usmle-review-app` folder, then in the terminal:

```bash
npm install        # one time — installs React + Vite locally into node_modules
npm run dev        # starts a local dev server, prints a http://localhost:5173 URL
```

Open that URL in your browser. That's it. To stop, press `Ctrl+C` in the terminal.

**Want a permanent offline copy** (e.g. to keep studying without the dev server)?

```bash
npm run build      # outputs a static site into dist/
npm run preview    # serves dist/ locally to check it
```

The `dist/` folder is self-contained — you can keep it anywhere and serve it with any
static server.

---

## 3. How it's organized

```
usmle-review-app/
├─ index.html               # entry point
├─ package.json             # dependencies + scripts
├─ vite.config.js
├─ src/
│  ├─ main.jsx              # boots React
│  ├─ App.jsx               # sidebar, filters, loads the deck
│  ├─ styles.css            # all styling (light + dark)
│  ├─ lib/storage.js        # local progress + spaced repetition (localStorage)
│  └─ components/
│     └─ QuestionCard.jsx   # the 5-tab review card
├─ public/
│  └─ questions/
│     ├─ deck.json          # auto-generated index of all questions
│     └─ q01_*.json … q29_* # one file per question
├─ schema/
│  └─ question.schema.json  # the shape of a question file
└─ scripts/
   └─ generate_questions.py # regenerates the JSON files + deck.json
```

What the app does:

- Sidebar lists questions with filters: **Missed**, **Due** (spaced-repetition),
  **All**, **Mastered**, plus a search box.
- Each question opens as a card with five tabs — **Question** (tap clues to reveal why
  they matter, lock in a guess), **Eliminate** (tap each wrong answer), **Answer**
  (reveal + build the reasoning chain + mechanism), **Keywords** (flip flashcards),
  **First Aid** (where to read).
- After revealing the answer you tag *what made it hard* and rate it **Review again**
  or **Got it** — that schedules the next review (1 → 3 → 7 → 16 → 35 days).

---

## 4. Adding new questions (your ongoing workflow)

This is built so every future test feeds the same deck. Two easy options:

**Option A — let Claude Code do it.** Tell Claude Code: *"Add a new question file to
`public/questions/` following `schema/question.schema.json`, then re-run the generator
index."* Paste the vignette + options. It writes `q30_*.json` and updates `deck.json`.

**Option B — do it by hand.**
1. Copy any existing file in `public/questions/`, rename it `q30_<slug>.json`.
2. Edit the fields to match `schema/question.schema.json` (give it a new `id`,
   set `yourAnswer` to what you picked so it shows up under **Missed**).
3. Add the same question's data to `QUESTIONS` in `scripts/generate_questions.py`
   (so the index stays reproducible), then run:
   ```bash
   python3 scripts/generate_questions.py
   ```
   That rewrites every `*.json` plus `deck.json`. Refresh the browser.

> Tip: a question counts as **missed** when `yourAnswer` is set and differs from
> `correct`. Leave `yourAnswer` as `null` for ones you got right or haven't taken.

---

## 5. Verify nothing's broken

```bash
# all JSON parses?
for f in public/questions/*.json; do python3 -m json.tool "$f" > /dev/null && echo "ok $f"; done
# app compiles?
npm run build
```

If both pass, you're good.

---

## 6. If you ever want to grow it

Natural next steps you can ask Claude Code for, in rough order of effort:
- A **"quiz me" mode** that picks random Due questions and hides the answer until you commit.
- **Tag/topic filters** in the sidebar (data's already there: `system`, `topic`).
- **Export/import** your progress as a JSON file (so it survives clearing the browser).
- A small **stats page** (accuracy by system, streaks).

None of these change the safety model — it stays a local, no-backend static app.
