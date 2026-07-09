#!/usr/bin/env python3
"""
Write public/weakness-seed.json so the adaptive scheduler pulls your weak
systems/topics forward on the next planning pass (Channel B in the build spec).

Usage:
  python3 scripts/set_weakness.py "Renal:acid-base:0.8" "Cardiovascular:pharm:0.6"
  python3 scripts/set_weakness.py Renal Cardiovascular            # level defaults to 0.7
  python3 scripts/set_weakness.py --clear

Each arg is  SYSTEM[:TOPIC[:LEVEL]]  (level 0..1, default 0.7).
SYSTEM should match a normalized system name (Cardiovascular, Renal, Respiratory,
Gastrointestinal, "Heme / Onc", Endocrine, Repro, "Neuro & Special Senses",
Psychiatry, "MSK, Skin & Connective", Biochemistry, Immunology, Microbiology,
Pharmacology, Pathology, "Public Health").
"""
import json, os, sys, datetime

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
OUT = os.path.join(ROOT, "public", "weakness-seed.json")


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return
    if argv[0] == "--clear":
        payload = {"updatedAt": datetime.date.today().isoformat(), "weak": []}
        json.dump(payload, open(OUT, "w"), ensure_ascii=False, indent=2)
        print("Cleared weakness seed.")
        return

    weak = []
    for a in argv:
        parts = a.split(":")
        system = parts[0].strip()
        topic = parts[1].strip() if len(parts) > 1 and parts[1].strip() else None
        level = float(parts[2]) if len(parts) > 2 else 0.7
        level = max(0.0, min(1.0, level))
        entry = {"system": system, "level": level}
        if topic:
            entry["topic"] = topic
        weak.append(entry)

    payload = {"updatedAt": datetime.date.today().isoformat(), "weak": weak}
    json.dump(payload, open(OUT, "w"), ensure_ascii=False, indent=2)
    print(f"Wrote {OUT}")
    for w in weak:
        print(f"  {w['system']}"
              + (f" / {w['topic']}" if w.get("topic") else "")
              + f"  @ {w['level']}")


if __name__ == "__main__":
    main(sys.argv[1:])
