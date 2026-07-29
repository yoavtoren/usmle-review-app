import { beforeEach, describe, expect, it, vi } from "vitest";
import { DATA_KEYS } from "../dataKeys.js";
import {
  testScore, isDue, getReviewSchedule, exportAllData, importAllData,
  snapshotAll, listSnapshots, restoreSnapshot, resetAllProgress,
  maybeAutoReset, saveTestLog, loadTestLog, deleteTest,
  saveRailNotes, loadRailNotes, rate, loadProgress,
} from "../storage.js";

const DAY = 86_400_000;

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("testScore", () => {
  it("prefers an explicit score", () => {
    expect(testScore({ score: 72, subjects: { Path: { total: 10, correct: 1 } } })).toBe(72);
  });

  it("derives from the subject breakdown when there is no score", () => {
    expect(testScore({ subjects: { Path: { total: 10, correct: 7 }, Pharm: { total: 10, correct: 5 } } })).toBe(60);
  });

  it("falls back to systems, then to null", () => {
    expect(testScore({ systems: { "Renal, Urinary Systems & Electrolytes": { total: 4, correct: 3 } } })).toBe(75);
    expect(testScore({})).toBeNull();
    expect(testScore(null)).toBeNull();
  });
});

describe("isDue", () => {
  // Regression: dueAt is null for BOTH new and mastered cards, so the old
  // `!dueAt || dueAt <= now` reported them as due.
  it("is false for new and mastered cards even with a null dueAt", () => {
    expect(isDue({ status: "new", dueAt: null })).toBe(false);
    expect(isDue({ status: "mastered", dueAt: null })).toBe(false);
  });

  it("is true for a review card at or past its due time", () => {
    expect(isDue({ status: "review", dueAt: Date.now() - 1000 })).toBe(true);
    expect(isDue({ status: "review", dueAt: null })).toBe(true);
    expect(isDue({ status: "review", dueAt: Date.now() + DAY })).toBe(false);
  });
});

describe("getReviewSchedule", () => {
  const qs = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

  it("splits overdue / due-today / upcoming and always returns 14 days", () => {
    const midday = new Date(); midday.setHours(12, 0, 0, 0);
    const progress = {
      a: { status: "review", dueAt: Date.now() - 3 * DAY },  // overdue
      b: { status: "review", dueAt: midday.getTime() },      // due today
      c: { status: "review", dueAt: Date.now() + 3 * DAY },  // upcoming
      d: { status: "mastered", dueAt: null },
    };
    const s = getReviewSchedule(qs, progress);
    expect(s.overdue).toBe(1);
    expect(s.mastered).toBe(1);
    expect(s.upcomingTotal).toBe(1);
    expect(s.days).toHaveLength(14);
    expect(s.days[0].isToday).toBe(true);
  });

  it("zeroes today's load when light mode is paused", () => {
    localStorage.setItem("usmle-light-mode-v1", JSON.stringify({ paused: true }));
    const s = getReviewSchedule(qs, { a: { status: "review", dueAt: Date.now() - DAY } });
    expect(s.paused).toBe(true);
    expect(s.dueNow).toBe(0);
    expect(s.days[0].count).toBe(0);
  });
});

describe("export / import", () => {
  it("covers every synced key, including ones the old hand-written list missed", () => {
    localStorage.setItem("usmle-error-log-v1", JSON.stringify([{ id: "e1", why: "gap" }]));
    localStorage.setItem("usmle-app:aims-tasks-v2", JSON.stringify([{ id: 1 }]));
    saveRailNotes("remember the Krebs cycle");

    const dump = JSON.parse(exportAllData());
    expect(dump["usmle-error-log-v1"]).toHaveLength(1);
    expect(dump["usmle-app:aims-tasks-v2"]).toHaveLength(1);
    expect(dump["usmle-app:rail-notes-v1"]).toBe("remember the Krebs cycle");
  });

  it("round-trips raw-string keys without double-encoding them", () => {
    saveRailNotes("plain text, not JSON");
    localStorage.setItem("fa-book-last-page", "304");
    const dump = exportAllData();
    localStorage.clear();

    expect(importAllData(dump).ok).toBe(true);
    expect(loadRailNotes()).toBe("plain text, not JSON");
    expect(localStorage.getItem("fa-book-last-page")).toBe("304");
  });

  it("survives an empty scratch note (JSON.parse('') would throw)", () => {
    saveRailNotes("");
    expect(() => exportAllData()).not.toThrow();
  });

  it("rejects junk and never writes unknown keys", () => {
    expect(importAllData("not json").ok).toBe(false);
    expect(importAllData("[1,2,3]").ok).toBe(false);
    expect(importAllData(JSON.stringify({ evil: 1 })).ok).toBe(false);

    const r = importAllData(JSON.stringify({ "usmle-streak-v1": { streak: 4 }, evil: "x" }));
    expect(r).toMatchObject({ ok: true, count: 1, skipped: 1 });
    expect(localStorage.getItem("evil")).toBeNull();
  });

  it("snapshots before importing", () => {
    localStorage.setItem("usmle-streak-v1", JSON.stringify({ streak: 9 }));
    importAllData(JSON.stringify({ "usmle-streak-v1": { streak: 1 } }));
    expect(listSnapshots()[0].label).toBe("pre-import");
    expect(listSnapshots()[0].data["usmle-streak-v1"].streak).toBe(9);
  });
});

describe("snapshot ring", () => {
  it("keeps the five most recent snapshots, newest first", () => {
    for (let i = 0; i < 7; i++) {
      localStorage.setItem("usmle-streak-v1", JSON.stringify({ streak: i }));
      snapshotAll(`s${i}`);
    }
    const snaps = listSnapshots();
    expect(snaps).toHaveLength(5);
    expect(snaps[0].label).toBe("s6");
  });

  it("restores a snapshot and snapshots the current state first", () => {
    localStorage.setItem("usmle-streak-v1", JSON.stringify({ streak: 3 }));
    snapshotAll("before");
    const at = listSnapshots()[0].at;

    localStorage.setItem("usmle-streak-v1", JSON.stringify({ streak: 99 }));
    expect(restoreSnapshot(at).ok).toBe(true);
    expect(JSON.parse(localStorage.getItem("usmle-streak-v1")).streak).toBe(3);
    expect(listSnapshots().some((s) => s.label === "pre-restore")).toBe(true);
  });

  it("is not itself a synced key — it must survive a reset", () => {
    expect(DATA_KEYS).not.toContain("usmle:snapshots-v1");
    localStorage.setItem("usmle-streak-v1", JSON.stringify({ streak: 5 }));
    resetAllProgress();
    expect(localStorage.getItem("usmle-streak-v1")).toBeNull();
    expect(listSnapshots()[0].data["usmle-streak-v1"].streak).toBe(5);
  });
});

describe("maybeAutoReset", () => {
  // Regression: this used to wipe every progress key when the guard flag was
  // missing, which could fire before the iCloud reconcile had pulled it.
  it("writes the guard flag but never deletes data", () => {
    saveTestLog([{ id: "t1", date: "2026-07-01", score: 61 }]);
    localStorage.setItem("usmle-review-progress-v1", JSON.stringify({ q1: { status: "review" } }));

    maybeAutoReset();

    expect(loadTestLog()).toHaveLength(1);
    expect(loadProgress().q1).toBeTruthy();
    expect(localStorage.getItem("usmle-app:reset-progress-v2")).toContain("retired");
  });

  it("is idempotent", () => {
    maybeAutoReset();
    const first = localStorage.getItem("usmle-app:reset-progress-v2");
    maybeAutoReset();
    expect(localStorage.getItem("usmle-app:reset-progress-v2")).toBe(first);
  });
});

describe("deleteTest", () => {
  it("removes the entry and leaves a restorable snapshot", () => {
    saveTestLog([{ id: "t1", score: 55 }, { id: "t2", score: 70 }]);
    const left = deleteTest("t1");
    expect(left.map((t) => t.id)).toEqual(["t2"]);
    expect(listSnapshots()[0].label).toBe("pre-delete-test");
    expect(listSnapshots()[0].data["test-log-v9"]).toHaveLength(2);
  });
});

describe("rate", () => {
  it("advances the streak and retires to mastered at the last interval", () => {
    let p;
    for (let i = 0; i < 4; i++) p = rate("q1", "got");
    expect(p.q1.status).toBe("mastered");
    expect(p.q1.dueAt).toBeGreaterThan(Date.now());

    p = rate("q1", "again");
    expect(p.q1.status).toBe("review");
    expect(p.q1.streak).toBe(0);
  });
});
