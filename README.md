# USMLE Review Deck

A personal, offline review app for the USMLE Step 1 questions you missed. Built as a
small React + Vite static site — no backend, no accounts, no network calls. Your
questions live as plain JSON files and your progress stays in your browser.

## Quick start

```bash
npm install
npm run dev      # open the printed http://localhost:5173 URL
```

See **GUIDE.md** for the full workflow, safety notes, and how to add new questions.

## What's inside

- `public/questions/` — one JSON file per question + a `deck.json` index (29 questions).
- `src/` — the React app (sidebar + 5-tab review card with spaced repetition).
- `schema/question.schema.json` — the shape of a question file.
- `scripts/generate_questions.py` — regenerates the JSON from a single source list.

## Status of this deck

29 questions from your first block (20 missed). Filter by **Missed** in the app to
drill them. Add future tests the same way — see GUIDE.md §4.
