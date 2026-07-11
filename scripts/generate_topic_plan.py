#!/usr/bin/env python3
"""
Build public/topic-plan.json — the schedulable "universe" for the adaptive
Step-1 scheduler (see PLANNER_ALGORITHM.md).

One UNIT = a right-sized STUDY BLOCK: ~35–55 minutes of work *including making
its Anki cards*. A First-Aid subsection (`## NN Title — seen/total`) is split into
as many blocks as its length needs, always along whole top-level-topic boundaries
so a topic and its sub-bullets never land in different blocks. Small subsections
stay as one block; a 138-topic monster like "Psychiatry › Pathology" becomes
~8 interleavable blocks instead of one 7-hour slab.

Why blocks, not subsections: the calendar can only look good if a *day* holds a
few short pieces from different systems. Coarse subsection units (up to 400 min)
forced one subject to blanket several days — the exact "subject distribution is
very bad" the plan is meant to avoid.

Source of truth is the real FA data this app already ships:
  public/fa/fa-progress.json     -> chapter list (name, total, md file)
  public/fa/chapters/NN_*.md      -> `## subsection — s/t` + `- [ ] topic` + subs

Usage:  python3 scripts/generate_topic_plan.py
Verify: sum(topicCount) == fa-progress.json totalTopics   (printed at the end)
"""
import json, os, re, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
FA_DIR = os.path.join(ROOT, "public", "fa")
OUT = os.path.join(ROOT, "public", "topic-plan.json")

# Plan anchors (kept in sync with the sidebar's exam countdown).
EXAM_DATE = "2026-10-11"
CONTENT_DEADLINE = "2026-09-14"

# ── Time model (minutes) ─────────────────────────────────────────────────────
# A top-level FA topic reads slower than one of its terse sub-bullets, and each
# top-level concept costs ~1 min to turn into an Anki card. estMinutes therefore
# already INCLUDES carding the new material — a unit is a piece "including anki".
# (The scheduler additionally reserves a separate daily block for reviewing the
# mature deck; that is deck maintenance, not making today's cards.)
TOP_MIN = 3.0          # minutes to study one top-level topic
SUB_MIN = 1.2          # minutes to study one indented sub-bullet
ANKI_MIN = 1.0         # minutes to make/first-pass Anki per top-level concept
MIN_PER_TOPIC = 3      # legacy field kept for the UWorld/pace math in the app

# ── Chunking targets (minutes of estMinutes per block) ───────────────────────
TARGET_MIN = 48        # aim each study block near this
SOLO_MAX = 66          # a subsection at/under this stays a single block
MERGE_MIN = 24         # a trailing sliver under this folds back into the prior block

# chapter number -> (yieldWeight 1..5, track, leadWeek, colorKey)
#   track "anchor" = big/hard/important; LEADS the schedule (Cardio opens W0).
#   track "basics" = interleaved daily in small just-in-time doses (leadWeek = None).
CHAPTER_META = {
    "07": (5, "anchor", 0, "cardio"),   # biggest / highest-yield -> opens
    "12": (5, "anchor", 1, "neuro"),
    "14": (5, "anchor", 2, "renal"),
    "16": (4, "anchor", 2, "resp"),
    "10": (5, "anchor", 3, "heme"),
    "08": (4, "anchor", 3, "endo"),
    "09": (4, "anchor", 4, "gi"),
    "15": (4, "anchor", 4, "repro"),
    "03": (4, "anchor", 5, "micro"),
    "11": (3, "anchor", 6, "msk"),
    "13": (3, "anchor", 6, "psych"),
    # basics, interleaved daily just-in-time (no leadWeek):
    "04": (5, "basics", None, "patho"),
    "01": (4, "basics", None, "biochem"),
    "02": (4, "basics", None, "immuno"),
    "05": (4, "basics", None, "pharm"),
    "06": (4, "basics", None, "publichealth"),
}

# Per-chapter difficulty hint (drives `hardness`; default 0.5).
HARDNESS = {
    "12": 0.85, "01": 0.8, "14": 0.75, "10": 0.7, "05": 0.65,
}

CHAPTER_SYSTEM = {
    "01": "Biochemistry", "02": "Immunology", "03": "Microbiology",
    "04": "Pathology", "05": "Pharmacology", "06": "Public Health",
    "07": "Cardiovascular", "08": "Endocrine", "09": "Gastrointestinal",
    "10": "Heme / Onc", "11": "MSK, Skin & Connective",
    "12": "Neuro & Special Senses", "13": "Psychiatry", "14": "Renal",
    "15": "Repro", "16": "Respiratory",
}

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
TOP_RE = re.compile(r"^- \[[ x]\] (.+)$")            # top-level topic (no indent)
SUB_RE = re.compile(r"^\s+- \[[ x]\]")                # indented sub-bullet


def parse_sections(md_text):
    """Return [{title, total, groups}] per `## ... — s/t` block.

    A *group* is one top-level topic plus the sub-bullets nested under it:
      {name, subs}  where weight = 1 + subs (matches the s/t accounting) and
      minutes = TOP_MIN + SUB_MIN*subs + ANKI_MIN.
    Splitting only ever happens between whole groups, so a topic is never torn
    from its sub-bullets.
    """
    sections = []
    current = None
    group = None
    for line in md_text.split("\n"):
        m = HEADING_RE.match(line)
        if m:
            current = {"title": m.group(1).strip(), "total": int(m.group(3)), "groups": []}
            sections.append(current)
            group = None
            continue
        if current is None:
            continue
        tm = TOP_RE.match(line)
        if tm:
            group = {"name": tm.group(1).strip(), "subs": 0}
            current["groups"].append(group)
        elif SUB_RE.match(line) and group is not None:
            group["subs"] += 1
    return sections


def group_minutes(g):
    return TOP_MIN + SUB_MIN * g["subs"] + ANKI_MIN


def group_weight(g):
    return 1 + g["subs"]


def chunk_groups(groups):
    """Split an ordered list of groups into blocks of ~TARGET_MIN estMinutes.

    Greedy: accumulate whole groups until the running estimate reaches TARGET_MIN,
    then start a new block. A final sliver under MERGE_MIN is folded back into the
    previous block so we never emit a 5-minute orphan. Returns list[list[group]].
    """
    total_min = sum(group_minutes(g) for g in groups)
    if total_min <= SOLO_MAX or len(groups) <= 1:
        return [groups]

    blocks, cur, cur_min = [], [], 0.0
    for g in groups:
        gm = group_minutes(g)
        # Close the current block once it is full enough AND something remains to
        # justify a new one. A single oversized group still gets its own block.
        if cur and cur_min + gm > TARGET_MIN and cur_min >= MERGE_MIN:
            blocks.append(cur)
            cur, cur_min = [], 0.0
        cur.append(g)
        cur_min += gm
    if cur:
        # Fold a too-small tail into the previous block instead of orphaning it.
        if blocks and cur_min < MERGE_MIN:
            blocks[-1].extend(cur)
        else:
            blocks.append(cur)
    return blocks


def main():
    with open(os.path.join(FA_DIR, "fa-progress.json")) as f:
        prog = json.load(f)

    # ── Pass 1: parse + chunk every subsection so sizeRank (a block's topicCount
    # percentile) can be computed across the whole universe before emitting.
    raw = []  # (ch, chapter_name, num, si, section_title, block_groups)
    total_topics = 0
    for ch in prog["chapters"]:
        chapter_name = ch["chapter"]                 # e.g. "07 Cardio"
        num = chapter_name.split(" ", 1)[0]          # "07"
        with open(os.path.join(FA_DIR, ch["file"])) as mf:
            sections = parse_sections(mf.read())
        for si, sec in enumerate(sections, start=1):
            total_topics += sec["total"]
            for block in chunk_groups(sec["groups"]):
                raw.append((ch, chapter_name, num, si, sec["title"], block))

    def block_topics(block):
        return sum(group_weight(g) for g in block)

    counts = sorted(block_topics(b[5]) for b in raw)
    n = len(counts)

    def size_rank(count):
        below = sum(1 for c in counts if c <= count)
        return round(below / n, 3) if n else 0.0

    # ── Pass 2: how many blocks each subsection produced, so part i/N labels are
    # right (a subsection kept whole shows no "· i/N" suffix).
    parts_total = {}
    for ch, chapter_name, num, si, title, block in raw:
        parts_total[(num, si)] = parts_total.get((num, si), 0) + 1

    # ── Pass 3: emit one unit per block.
    units = []
    part_idx = {}
    for ch, chapter_name, num, si, title, block in raw:
        pnum = parts_total[(num, si)]
        pi = part_idx.get((num, si), 0) + 1
        part_idx[(num, si)] = pi

        y_weight, track, lead_week, color_key = CHAPTER_META.get(num, (3, "anchor", 6, "patho"))
        topic_count = block_topics(block)                       # weighted (sums to total)
        fa_min = round(sum(TOP_MIN + SUB_MIN * g["subs"] for g in block))
        anki_min = round(sum(ANKI_MIN for _ in block))
        est_min = fa_min + anki_min

        # Display title: keep the leading "NN " (the UI strips it) and append the
        # part index only when the subsection was actually split.
        label = title if pnum == 1 else f"{title} · {pi}/{pnum}"
        key = f"{num}.{si:02d}.{pi:02d}"
        fa_ids = [f'{ch["file"]}::{title}::{g["name"]}' for g in block]

        units.append({
            "key": key,
            "chapterNum": num,
            "chapter": chapter_name,
            "subsection": label,
            "subsectionBase": title,
            "part": pi,
            "partsTotal": pnum,
            "system": CHAPTER_SYSTEM.get(num, chapter_name),
            "colorKey": color_key,
            "faFile": ch["file"],
            "faItemIds": fa_ids,
            "topicCount": topic_count,
            "yieldWeight": y_weight,
            "track": track,
            "leadWeek": lead_week,
            "sizeRank": size_rank(topic_count),
            "hardness": HARDNESS.get(num, 0.5),
            "faMinutes": fa_min,
            "ankiMinutes": anki_min,
            "estMinutes": est_min,
            "resources": CHAPTER_RESOURCES.get(num, ["FA"]),
        })

    out = {
        "examDate": EXAM_DATE,
        "contentDeadline": CONTENT_DEADLINE,
        "generatedAt": datetime.date.today().isoformat(),
        "minPerTopic": MIN_PER_TOPIC,
        "timeModel": {"topMin": TOP_MIN, "subMin": SUB_MIN, "ankiMin": ANKI_MIN,
                      "targetBlockMin": TARGET_MIN},
        "totalTopics": total_topics,
        "unitCount": len(units),
        "units": units,
    }
    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    expected = prog["totalTopics"]
    ests = sorted(u["estMinutes"] for u in units)
    print(f"Wrote {OUT}")
    print(f"  units: {len(units)}  (was 77 coarse subsections)")
    print(f"  estMinutes  min/median/max: {ests[0]} / {ests[len(ests)//2]} / {ests[-1]}")
    print(f"  total study minutes: {sum(ests)}  (~{sum(ests)//60} h incl. Anki carding)")
    print(f"  sum(topicCount): {total_topics}  (fa-progress totalTopics: {expected})")
    print("  ✓ topic totals match." if total_topics == expected
          else "  ⚠ topic totals differ — check for sections the parser missed.")


if __name__ == "__main__":
    main()
