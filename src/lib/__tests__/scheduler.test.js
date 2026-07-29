import { beforeEach, describe, expect, it } from "vitest";
import {
  seedDefault, ensureUnits, planDay, recordUworld, uworldDone, uworldPacing,
  rollover, feasibility, projectSchedule, applyTriage, todayISO, POOL_STATUSES,
} from "../scheduler.js";

// Two anchors + one basics unit is enough to exercise the fill loop, the
// per-system diversity cap and the triage path.
const UNITS = [
  { key: "u1", chapter: "07 Cardio", subsection: "1 Anatomy", system: "Cardiovascular",
    colorKey: "cardio", chapterNum: "07", track: "anchor", leadWeek: 0,
    yieldWeight: 5, sizeRank: 0.9, hardness: 0.8, estMinutes: 45, topicCount: 6,
    faItemIds: [], resources: [] },
  { key: "u2", chapter: "14 Renal", subsection: "1 Physiology", system: "Renal",
    colorKey: "renal", chapterNum: "14", track: "anchor", leadWeek: 2,
    yieldWeight: 4, sizeRank: 0.6, hardness: 0.6, estMinutes: 45, topicCount: 5,
    faItemIds: [], resources: [] },
  { key: "u3", chapter: "01 Biochem", subsection: "1 Metabolism", system: "Biochemistry",
    colorKey: "biochem", chapterNum: "01", track: "basics", leadWeek: null,
    yieldWeight: 2, sizeRank: 0.3, hardness: 0.4, estMinutes: 45, topicCount: 4,
    faItemIds: [], resources: [] },
];

const boot = () => ensureUnits(seedDefault({}), UNITS);

beforeEach(() => localStorage.clear());

describe("planDay", () => {
  it("plans content blocks and emits a UWorld block", () => {
    const s = planDay(boot(), UNITS, todayISO(), "med");
    const day = s.days[todayISO()];
    expect(day.capacity).toBe("med");
    expect(day.planned.length).toBeGreaterThan(0);
    expect(day.uworld.done).toBe(false);
    expect(day.uworld.targetQ).toBeGreaterThan(0);
  });

  // The regression this whole audit started from.
  it("does NOT erase a logged UWorld block when the day is re-planned", () => {
    const date = todayISO();
    let s = planDay(boot(), UNITS, date, "med");
    s = recordUworld(s, UNITS, { correct: 31, total: 40, missedSystems: ["Renal"] }, date);
    expect(uworldDone(s)).toBe(40);

    // Resize the day — this used to rebuild `uworld` from scratch.
    s = planDay(s, UNITS, date, "high");
    const uw = s.days[date].uworld;
    expect(uw.done).toBe(true);
    expect(uw.correct).toBe(31);
    expect(uw.total).toBe(40);
    expect(uw.missedSystems).toEqual(["Renal"]);
    expect(uworldDone(s)).toBe(40);          // pace must not walk backwards
  });

  it("still refreshes the block's targets on a re-plan", () => {
    const date = todayISO();
    let s = planDay(boot(), UNITS, date, "low");
    const lowMinutes = s.days[date].uworld.minutes;
    s = planDay(s, UNITS, date, "high");
    expect(s.days[date].uworld.minutes).toBeGreaterThan(lowMinutes);
  });

  it("preserves completed / anki state across a re-plan", () => {
    const date = todayISO();
    let s = planDay(boot(), UNITS, date, "med");
    s.days[date].completed = ["u1"];
    s.days[date].ankiDone = true;
    s = planDay(s, UNITS, date, "low");
    expect(s.days[date].completed).toEqual(["u1"]);
    expect(s.days[date].ankiDone).toBe(true);
  });
});

describe("uworld pacing", () => {
  it("counts the offset plus every logged block", () => {
    let s = boot();
    s.settings.uworldDoneOffset = 120;
    s = planDay(s, UNITS, todayISO(), "med");
    s = recordUworld(s, UNITS, { correct: 20, total: 25 }, todayISO());
    expect(uworldDone(s)).toBe(145);

    const pace = uworldPacing(s, todayISO());
    expect(pace.done).toBe(145);
    expect(pace.remaining).toBe(pace.goal - 145);
    expect(pace.perDay).toBeGreaterThan(0);
  });
});

describe("skim contract", () => {
  it("is one shared status list across planner, feasibility and projection", () => {
    expect(POOL_STATUSES).toContain("skim");
  });

  it("keeps a skimmed unit schedulable and counted as remaining work", () => {
    let s = boot();
    s.units.u3 = { ...s.units.u3, status: "skim" };

    // Counted (at half cost) by the feasibility monitor…
    const full = feasibility(boot(), UNITS, todayISO()).remainingMin;
    const withSkim = feasibility(s, UNITS, todayISO()).remainingMin;
    expect(withSkim).toBe(full - UNITS[2].estMinutes / 2);

    // …projected forward…
    const proj = projectSchedule(s, UNITS, todayISO());
    expect(Object.keys(proj.spans)).toContain("u3");

    // …and actually plannable, staying `skim` while it sits on the day.
    const planned = planDay(s, UNITS, todayISO(), "high");
    expect(planned.days[todayISO()].planned).toContain("u3");
    expect(planned.units.u3.status).toBe("skim");
  });

  it("rolls a stale skim forward without promoting it", () => {
    let s = boot();
    s.units.u3 = { ...s.units.u3, status: "skim", plannedDate: "2020-01-01" };
    s = rollover(s, todayISO());
    expect(s.units.u3.status).toBe("skim");
    expect(s.units.u3.plannedDate).toBeNull();
    expect(s.units.u3.postponeCount).toBe(1);
  });
});

describe("applyTriage", () => {
  it("leaves a comfortable schedule untouched", () => {
    const { changed } = applyTriage(boot(), UNITS, todayISO());
    expect(changed).toEqual([]);
  });
});

describe("projectSchedule", () => {
  it("gives every outstanding unit a single-day span", () => {
    const proj = projectSchedule(boot(), UNITS, todayISO());
    expect(Object.keys(proj.spans).sort()).toEqual(["u1", "u2", "u3"]);
    for (const sp of Object.values(proj.spans)) expect(sp.start).toBe(sp.end);
  });
});
