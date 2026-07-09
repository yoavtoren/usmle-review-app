#!/usr/bin/env python3
"""
Build public/topic-plan.json — the schedulable "universe" for the adaptive
Step-1 scheduler (see CLAUDE_CODE_BUILD_SPEC.md).

One UNIT = one First-Aid subsection (a `## NN Title — seen/total` block inside a
chapter markdown file). Subsection granularity is coarse enough to schedule a day
around, fine enough to swap in/out and map onto UWorld/Anki.

Source of truth is the real FA data this app already ships:
  public/fa/fa-progress.json     -> chapter list (name, total, md file)
  public/fa/chapters/NN_*.md      -> the `## subsection — s/t` headings + topics

Usage:  python3 scripts/generate_topic_plan.py
Verify: sum(topicCount) == fa-progress.json totalTopics
"""
import json, os, re, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
FA_DIR = os.path.join(ROOT, "public", "fa")
OUT = os.path.join(ROOT, "public", "topic-plan.json")

# Plan anchors (kept in sync with the sidebar's exam countdown).
EXAM_DATE = "2026-10-11"
CONTENT_DEADLINE = "2026-09-14"
MIN_PER_TOPIC = 3  # minutes; tuned later from real completion data

# chapter number -> (yieldWeight 1..5, track, leadWeek, colorKey)
#   track "anchor" = big/hard/important; LEADS the schedule (Cardio opens W0).
#   track "basics" = interleaved daily in small just-in-time doses (leadWeek = None).
# This is the "big and bold first, basics as seasoning" model — NO foundation
# gating; anchors lead by leadWeek, basics ride a separate daily interleave budget.
CHAPTER_META = {
    # 🔥 anchors, lead order via leadWeek (Cardio opens):
    "07": (5, "anchor", 0, "cardio"),   # biggest / highest-yield → opens
    "12": (5, "anchor", 1, "neuro"),    # big + hard + important
    "14": (5, "anchor", 2, "renal"),
    "16": (4, "anchor", 2, "resp"),
    "10": (5, "anchor", 3, "heme"),
    "08": (4, "anchor", 3, "endo"),
    "09": (4, "anchor", 4, "gi"),
    "15": (4, "anchor", 4, "repro"),
    "03": (4, "anchor", 5, "micro"),    # big; Sketchy-driven → anchor
    "11": (3, "anchor", 6, "msk"),
    "13": (3, "anchor", 6, "psych"),    # easy wins
    # 🧊 basics, interleaved daily just-in-time (no leadWeek):
    "04": (5, "basics", None, "patho"),  # fundamentals from day 1
    "01": (4, "basics", None, "biochem"),
    "02": (4, "basics", None, "immuno"),
    "05": (4, "basics", None, "pharm"),
    "06": (4, "basics", None, "publichealth"),
}

# Per-chapter difficulty hint (drives `hardness`; default 0.5).
HARDNESS = {
    "12": 0.85, "01": 0.8, "14": 0.75, "10": 0.7, "05": 0.65,
}

# chapter number -> normalized system (matches faMap.js chapter names / deck vocab)
CHAPTER_SYSTEM = {
    "01": "Biochemistry", "02": "Immunology", "03": "Microbiology",
    "04": "Pathology", "05": "Pharmacology", "06": "Public Health",
    "07": "Cardiovascular", "08": "Endocrine", "09": "Gastrointestinal",
    "10": "Heme / Onc", "11": "MSK, Skin & Connective",
    "12": "Neuro & Special Senses", "13": "Psychiatry", "14": "Renal",
    "15": "Repro", "16": "Respiratory",
}

# resource hint chips per chapter (display only)
CHAPTER_RESOURCES = {
    "01": ["FA", "B&B", "Sketchy Biochem"], "02": ["FA", "B&B", "Sketchy Immuno"],
    "03": ["FA", "Sketchy Micro"], "04": ["FA", "Pathoma"], "05": ["FA", "Sketchy Pharm"],
    "06": ["FA", "UWorld Biostat"], "07": ["FA", "Pathoma", "B&B"],
    "08": ["FA", "Pathoma", "B&B"], "09": ["FA", "Pathoma", "B&B"],
    "10": ["FA", "Pathoma", "Sketchy"], "11": ["FA", "Pathoma"],
    "12": ["FA", "B&B"], "13": ["FA", "B&B"], "14": ["FA", "Pathoma", "B&B"],
    "15": ["FA", "B&B"], "16": ["FA", "Pathoma", "B&B"],
}

HEADING_RE = re.compile(r"^## (.+?) — (\d+)/(\d+)")
TOPIC_RE = re.compile(r"^- \[[ x]\] (.+)$")


def parse_sections(md_text):
    """Return [{title, total, topics:[str]}] for each `## ... — s/t` block."""
    sections = []
    current = None
    for line in md_text.split("\n"):
        m = HEADING_RE.match(line)
        if m:
            current = {"title": m.group(1).strip(),
                       "total": int(m.group(3)), "topics": []}
            sections.append(current)
            continue
        if current is not None:
            tm = TOPIC_RE.match(line)  # top-level topics only (no leading indent)
            if tm:
                current["topics"].append(tm.group(1).strip())
    return sections


def main():
    with open(os.path.join(FA_DIR, "fa-progress.json")) as f:
        prog = json.load(f)

    # ── Pass 1: collect raw sections so sizeRank (topicCount percentile) can be
    # computed across the whole universe before emitting units.
    raw = []
    total_topics = 0
    for ch in prog["chapters"]:
        chapter_name = ch["chapter"]             # e.g. "07 Cardio"
        num = chapter_name.split(" ", 1)[0]      # "07"
        md_path = os.path.join(FA_DIR, ch["file"])
        with open(md_path) as mf:
            sections = parse_sections(mf.read())
        for si, sec in enumerate(sections, start=1):
            total_topics += sec["total"]
            raw.append((ch, chapter_name, num, si, sec))

    counts = sorted(r[4]["total"] for r in raw)
    n = len(counts)

    def size_rank(count):
        # Fraction of units with a topicCount <= this one → big topics ≈ 1.0.
        below = sum(1 for c in counts if c <= count)
        return round(below / n, 3) if n else 0.0

    # ── Pass 2: emit one unit per subsection.
    units = []
    for ch, chapter_name, num, si, sec in raw:
        count = sec["total"]
        y_weight, track, lead_week, color_key = CHAPTER_META.get(num, (3, "anchor", 6, "patho"))
        key = f"{num}.{si:02d}"
        units.append({
            "key": key,
            "chapterNum": num,
            "chapter": chapter_name,
            "subsection": sec["title"],
            "system": CHAPTER_SYSTEM.get(num, chapter_name),
            "colorKey": color_key,
            "faFile": ch["file"],
            "faItemIds": [f'{ch["file"]}::{sec["title"]}::{t}' for t in sec["topics"]],
            "topicCount": count,
            "yieldWeight": y_weight,
            "track": track,
            "leadWeek": lead_week,
            "sizeRank": size_rank(count),
            "hardness": HARDNESS.get(num, 0.5),
            "estMinutes": max(count * MIN_PER_TOPIC, MIN_PER_TOPIC),
            "resources": CHAPTER_RESOURCES.get(num, ["FA"]),
        })

    out = {
        "examDate": EXAM_DATE,
        "contentDeadline": CONTENT_DEADLINE,
        "generatedAt": datetime.date.today().isoformat(),
        "minPerTopic": MIN_PER_TOPIC,
        "totalTopics": total_topics,
        "unitCount": len(units),
        "units": units,
    }
    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    expected = prog["totalTopics"]
    print(f"Wrote {OUT}")
    print(f"  units: {len(units)}")
    print(f"  sum(topicCount): {total_topics}  (fa-progress totalTopics: {expected})")
    if total_topics != expected:
        print("  ⚠ topic totals differ — check for sections the parser missed.")
    else:
        print("  ✓ topic totals match.")


if __name__ == "__main__":
    main()
