# Adaptive Step-1 Planner — how the schedule is built and how it self-corrects

This is the plain-language spec for the planner. Two files implement it:

- **`scripts/generate_topic_plan.py`** — turns the real First Aid book into the
  schedulable universe (`public/topic-plan.json`).
- **`src/lib/scheduler.js`** — the day-by-day engine: priority, interleaving,
  rollover, weakness ingestion, feasibility/triage, and the weekly retune.

Nothing leaves your device; the whole engine runs in the browser on
`localStorage`.

---

## 1. The unit: a right-sized study block (~45 min, Anki included)

The old plan used one FA **subsection** as one unit. That was the root of the
"subject distribution is very bad" problem: a subsection like *Psychiatry ›
Pathology* is 138 topics ≈ **7 hours**, so it blanketed two or three whole
calendar days with a single subject.

Now the generator splits every subsection into **blocks of ~45 minutes**, always
along whole top-level-topic boundaries (a topic and its indented sub-bullets are
never separated). *Psychiatry › Pathology* becomes 6 blocks of ~48 min each,
shown as `Pathology · 1/6 … 6/6`.

Each block's time estimate **includes making its Anki cards**:

```
estMinutes = Σ(3.0 per top-level topic + 1.2 per sub-bullet)   ← reading FA
           + Σ(1.0 per top-level topic)                        ← making Anki cards
```

Result: **188 blocks**, median **45 min**, none over ~72 min, summing to the full
3,594 FA topics and ~133 hours. A block is a real "piece you can finish in a
sitting, cards and all."

> Reviewing the *mature* Anki deck is separate daily maintenance and gets its own
> reserved time (`ankiReserveMin`, 45/60/75 min by capacity) on top of the blocks.

To re-generate after editing the book data: `python3 scripts/generate_topic_plan.py`
(it prints a check that the topic totals still reconcile to 3,594).

---

## 2. A day is a **mix of a few subjects** — never one subject three deep

Two things guarantee variety:

**Small blocks.** A normal day's content budget (~180 min for a Medium day) now
holds **3–4 blocks** instead of one giant slab.

**A diversity rule at pick time.** When filling a day, the engine takes the
highest-priority block first, then for every subsequent pick subtracts a penalty
from any subject already on the day, and enforces a **hard cap: no single system
may take more than 55 % of the day**. So the weakest/most-urgent subject still
*leads* the day, but it can't *own* it — the rest of the day pulls in different
systems. A lighter penalty also nudges the plan away from repeating *yesterday's*
subjects, so variety holds across days too.

```
priority(block, day) = base_priority(block)
                     − 0.7 · (blocks of this system already today)      // in-day spread
                     − 0.35 · (system was used yesterday ? 1 : 0)       // across-day spread
   … subject to: system_minutes_today + block ≤ 0.55 · day_budget
```

Because `0.7 / 0.35` are small next to the weakness weight (`1.8`) and the
lead-order weight (`2.0`), a genuinely weak subject is still front-loaded — it
just arrives interleaved. Simulated over the current data this produces ~4
blocks/day across **3+ different subjects every day**, finishing the content with
weeks of buffer before the exam.

Both the live "Today" plan (`planDay`) and the calendar/timeline projection
(`projectSchedule`) use this same rule, so what you see ahead matches how each day
actually gets planned.

---

## 3. Base priority — what makes a block "important"

`priority()` in `scheduler.js`. Every open block scores:

| Signal | Weight | Meaning |
|---|---|---|
| `weak` | **1.8** | how weak you are on this system (see §4). The strongest pull. |
| `lead` | **2.0** | anchor rotation: Cardio opens, then Neuro, Renal… unlock in order. |
| `yield` | 1.0 | high-yield chapters first. |
| `size` | 0.9 | bigger marquee systems surface earlier. |
| `hard` | 0.8 | hard systems (Neuro, Biochem, Renal) get earlier, repeated exposure. |
| `urgency` | 0.9 | rises as the content deadline nears / a block keeps getting postponed. |
| `spacing` | 0.5 | a finished block resurfaces only when its spaced-review interval is due. |
| `interleave` | 0.4 | small bonus for switching subjects vs. the last few completed. |

"Big and bold first, basics as seasoning": marquee **anchor** systems lead;
**basics** (Pathology, Biochem, Immuno, Pharm, Public Health) ride a small
guaranteed daily interleave budget so foundations arrive just-in-time rather than
as a wall you must clear first.

---

## 4. Weakness — four channels decide what gets pulled forward

`recomputeWeakness()` blends four independent signals into one `weaknessScore`
(0–1) per system, then the `weak` weight pulls high-scoring systems earlier:

- **A · Question deck** — misses on the in-app deck, mapped to FA chapters.
- **B · Manual seed** — `scripts/set_weakness.py "Renal:acid-base:0.8"` when you
  *know* a topic is shaky.
- **C · Live test stats** — the per-subject/per-system breakdown you enter for
  each UWorld/NBME test. As you log more questions in a system **and** score
  better, its weakness falls; a system you keep missing rises. Confidence-weighted
  (`CONF_K = 30`): ~30 logged questions in a system = half-trust, 90 =
  three-quarters, so your real scores progressively override the priors.
- **D · Profile baseline** — per-system % from your `profile.json`, a static prior
  until live data accrues.

**E · First Aid coverage (live progress).** Independently, the fraction of a
block's FA topics you've ticked in the tracker *relieves* its weakness. At **90 %
ticked the block auto-completes** and leaves the calendar; if you later untick, it
comes back. This is how "my progress (or lack of it)" continuously reshapes the
plan without any manual step. (These tick marks survived the re-chunk — the block
IDs are unchanged — so anything you'd already read is already credited.)

The daily **UWorld block** closes the loop: log it, and every system you missed
gets a weakness bump and is re-queued as tomorrow's "study this miss" target; a
system marked done reverts to spaced re-review until it comes back correct.

Hit **🔄 Refresh** on the planner to re-read all four channels + FA progress and
re-rank on the spot; it tells you which systems moved.

---

## 5. Self-correction — what happens when you fall behind (or race ahead)

This is the "modify the schedule if I'm missing something" machinery. Every
signal is bounded so one bad day can't wreck the model.

**Rollover (each day).** Any block scheduled for a past day that you didn't finish
is pushed back into the pool with `postponeCount += 1`. Postponing raises its
`urgency`, so a dodged block bubbles back up instead of quietly disappearing.

**Miss reasons (per skipped block).** When you skip a block you say *why*, and the
engine adapts:

| Reason | What it changes |
|---|---|
| ⏰ Ran out of time | trims tomorrow's budget (`capacityBias`), lowers the completion estimate |
| 🧠 Couldn't focus | shortens the work block, leans harder on interleaving |
| 😴 Tired | learns which hours are low-focus (drives your "best window") |
| 🥵 Too hard | tags the block as hard so it's broken up / interleaved more |
| 🎈 Didn't feel like it | dings the completion estimate only |
| 🌍 Life got in the way | **no penalty** — rolls forward cleanly |
| 🔄 Did a different topic | swap, no penalty |

**Feasibility monitor + triage.** Continuously compares *remaining minutes* vs.
*capacity left to the content deadline* (honoring your rest/reduced days and any
assessment days that eat into study time):

- ratio > 1.3 → **red**, > 1.0 → **amber**, < 0.5 → **ahead**.
- **Auto-triage** (amber/red): converts the lowest-yield blocks to *skim* (half
  time) or, in the red, *drops* the yield-1–2 tail — but **never** touches
  yield ≥ 4 or strongly-weak (≥ 0.7) systems. It stops the moment feasibility is
  back to green, so it cuts the minimum needed.

**Weekly retune.** Once a week the engine reads your rolling completion rate:

- consistently finishing < 60 % → adds buffer and raises `urgency` (front-load the
  important stuff while time is tight).
- finishing > 90 % → hands back buffer capacity (you can take more).
- if "couldn't focus / too hard" dominate your skips → permanently raises the
  interleave weight so heavy systems get more easy-win seasoning between them.

**Phase switch.** After the content deadline the plan flips to **Dedicated**: the
anchor/basics split dissolves, everything becomes targeted spaced review, and the
daily UWorld block goes to random/mixed mode.

**Assessment arc.** NBME/UWSA/Free-120 checkpoints are back-scheduled from the
exam date; each such day is protected (Anki + light review only), and your logged
scores drive a readiness projection (predicted score, on-track/at-risk).

---

## 6. Where each piece lives

| Concern | Location |
|---|---|
| Book → 45-min blocks | `scripts/generate_topic_plan.py` |
| Priority + interleave + hard per-system day cap | `scheduler.js` → `priority`, `planDay`, `projectSchedule` |
| Weakness blend (4 channels + FA coverage) | `scheduler.js` → `recomputeWeakness` |
| Rollover / miss reasons / undo | `scheduler.js` → `rollover`, `recordMiss`, `recordDone` |
| Feasibility + triage | `scheduler.js` → `feasibility`, `applyTriage` |
| Weekly retune + phase switch | `scheduler.js` → `maybeRetune`, `maybeSwitchPhase` |
| Manual weak-spot seed | `scripts/set_weakness.py` |

Tunable knobs worth knowing: `TARGET_MIN` (block size) in the generator;
`DIVERSITY_PENALTY`, `CARRYOVER_PENALTY`, `SYS_DAY_FRACTION` (interleaving), and
the `weights` block (priority mix) in `scheduler.js`.
