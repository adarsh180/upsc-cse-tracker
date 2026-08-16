"""Parse the canonical UPSC curriculum PDF into a deterministic JSON manifest.

Usage:
  python scripts/parse-curriculum-pdf.py <source.pdf> data/curriculum-2026.json

The source PDF is never modified. The generated manifest is validated against the
counts declared by each SUBJECT record before it is written.
"""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys
from typing import Any

from pypdf import PdfReader


RECORD_STARTS = ("SUBJECT |", "PART |", "CHAPTER |", "TOPIC |")
IGNORED_LINE_PATTERNS = (
    re.compile(r"^UPSC CSE Tracker - Codex Integration Syllabus Specification 2026$"),
    re.compile(r"^Page \d+$"),
    re.compile(r"^\d+\.\s+.+$"),
)

def field(line: str, name: str) -> str:
    match = re.search(rf"(?:^|\|)\s*{re.escape(name)}=([^|]+)", line)
    if not match:
        raise ValueError(f"Missing {name!r} in record: {line}")
    return match.group(1).strip()


def ignored(line: str) -> bool:
    return not line or any(pattern.match(line) for pattern in IGNORED_LINE_PATTERNS)


def parse(source: Path) -> dict[str, Any]:
    reader = PdfReader(str(source))
    subjects: list[dict[str, Any]] = []
    current_subject: dict[str, Any] | None = None
    current_part: dict[str, Any] | None = None
    current_chapter: dict[str, Any] | None = None
    last_record: tuple[str, dict[str, Any]] | None = None

    # Pages 4-68 contain the canonical machine-readable curriculum.
    for page_number, page in enumerate(reader.pages[3:68], start=4):
        for raw_line in (page.extract_text() or "").splitlines():
            line = re.sub(r"\s+", " ", raw_line).strip()
            if ignored(line):
                continue

            if line.startswith("SUBJECT |"):
                current_subject = {
                    "sourceId": field(line, "subject_id"),
                    "title": field(line, "subject_name"),
                    "paper": field(line, "paper"),
                    "declaredCounts": {
                        "parts": int(field(line, "parts")),
                        "chapters": int(field(line, "chapters")),
                        "topics": int(field(line, "topics")),
                    },
                    "parts": [],
                }
                subjects.append(current_subject)
                current_part = None
                current_chapter = None
                last_record = ("subject", current_subject)
                continue

            if line.startswith("PART |"):
                if current_subject is None:
                    raise ValueError(f"PART without SUBJECT on PDF page {page_number}")
                number = int(field(line, "part_number"))
                current_part = {
                    "sourceId": f"{current_subject['sourceId']}.part.{number}",
                    "number": number,
                    "title": field(line, "part_name").replace(" Part A ", " Section A ").replace(" Part B ", " Section B "),
                    "chapters": [],
                }
                current_subject["parts"].append(current_part)
                current_chapter = None
                last_record = ("part", current_part)
                continue

            if line.startswith("CHAPTER |"):
                if current_subject is None or current_part is None:
                    raise ValueError(f"CHAPTER without PART on PDF page {page_number}")
                number = int(field(line, "chapter_number"))
                current_chapter = {
                    "sourceId": f"{current_subject['sourceId']}.chapter.{number}",
                    "number": number,
                    "title": field(line, "chapter_title"),
                    "topics": [],
                }
                current_part["chapters"].append(current_chapter)
                last_record = ("chapter", current_chapter)
                continue

            if line.startswith("TOPIC |"):
                if current_subject is None or current_chapter is None:
                    raise ValueError(f"TOPIC without CHAPTER on PDF page {page_number}")
                topic_id = field(line, "topic_id")
                topic = {
                    "sourceId": f"{current_subject['sourceId']}.topic.{topic_id}",
                    "number": topic_id,
                    "title": field(line, "topic_title"),
                }
                current_chapter["topics"].append(topic)
                last_record = ("topic", topic)
                continue

            # Long titles can visually wrap in the source PDF. Since every logical
            # record begins with an explicit marker, any other non-header line is a
            # continuation of the preceding record title.
            if last_record and not line.startswith(RECORD_STARTS):
                kind, record = last_record
                if kind != "subject":
                    record["title"] = f"{record['title']} {line}".strip()
                continue

    manifest = {
        "version": "2026.1",
        "source": source.name,
        "subjects": subjects,
    }
    validate(manifest)
    return manifest


def validate(manifest: dict[str, Any]) -> None:
    subjects = manifest["subjects"]
    if len(subjects) != 15:
        raise ValueError(f"Expected 15 subjects, found {len(subjects)}")

    seen_subject_ids: set[str] = set()
    totals = {"parts": 0, "chapters": 0, "topics": 0}
    for subject in subjects:
        subject_id = subject["sourceId"]
        if subject_id in seen_subject_ids:
            raise ValueError(f"Duplicate subject ID: {subject_id}")
        seen_subject_ids.add(subject_id)

        parts = subject["parts"]
        chapters = [chapter for part in parts for chapter in part["chapters"]]
        topics = [topic for chapter in chapters for topic in chapter["topics"]]
        actual = {"parts": len(parts), "chapters": len(chapters), "topics": len(topics)}
        if actual != subject["declaredCounts"]:
            raise ValueError(
                f"Count mismatch for {subject_id}: declared={subject['declaredCounts']} actual={actual}"
            )

        expected_chapters = list(range(1, len(chapters) + 1))
        actual_chapters = [chapter["number"] for chapter in chapters]
        if actual_chapters != expected_chapters:
            raise ValueError(f"Non-sequential chapters for {subject_id}")

        topic_ids = [topic["number"] for topic in topics]
        if len(topic_ids) != len(set(topic_ids)):
            raise ValueError(f"Duplicate topic IDs for {subject_id}")

        for key in totals:
            totals[key] += actual[key]

    expected_totals = {"parts": 85, "chapters": 340, "topics": 2984}
    if totals != expected_totals:
        raise ValueError(f"Manifest total mismatch: expected={expected_totals} actual={totals}")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: parse-curriculum-pdf.py <source.pdf> <output.json>")

    source = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    manifest = parse(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {output} with {len(manifest['subjects'])} subjects, "
        "85 parts, 340 chapters and 2,984 topics."
    )


if __name__ == "__main__":
    main()
