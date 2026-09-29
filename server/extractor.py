"""
Universal Question Bank Extractor (Zero-AI, PyMuPDF Deterministic Parser)
Extracts structured questions, options, answers, marks, units, AND embedded diagram/table images.
Outputs: Hierarchical JSON, Flat JSON, Markdown, CSV, and local image assets.
"""

import sys
import os
import json
import csv
import re
from datetime import datetime
from typing import Dict, List, Any, Optional
import fitz  # PyMuPDF

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def clean_text(text: str) -> str:
    """Normalize whitespace, smart quotes, soft line wraps, standardize blanks, and strip non-breaking spaces."""
    if not text:
        return ""

    # Normalize unicode quotation marks & special spaces
    t = text.replace("\xa0", " ").replace("\r", "")
    t = t.replace("\u2018", "'").replace("\u2019", "'")
    t = t.replace("\u201c", '"').replace("\u201d", '"')

    # Standardize underlines (3 or more underscores -> '_______')
    t = re.sub(r"_{3,}", "_______", t)

    # Clean spurious underline prefix before interrogative/imperative sentences:
    t = re.sub(
        r"^_______\s+(?=(Which|What|How|If|Why|Who|When|Where|Define|Explain|Describe|Geometric|Radio|The|A\s|An\s|Two|Three|Count|In|UDP|TCP|IP|Port|For|User|Routing|Transport|ARQ|Convert|Given|State|Draw|Differentiate|Compare|Write|Create))",
        "",
        t,
        flags=re.IGNORECASE,
    )

    # If text ends with \n_______ but starts with a predicate (e.g. 'can determine...', 'is a medium...'):
    if re.search(r"\n_______\s*$", t) and re.match(r"^(can|is|does|consists|provides|are)\b", t, re.IGNORECASE):
        t = re.sub(r"\n_______\s*$", "", t)
        t = "_______ " + t

    # Protect numbered lists like 1. or (a)
    t = re.sub(r"\n(?=(\d+\.|\([a-z]\)))", " __NEWLINE__ ", t)
    # Join soft wraps
    t = re.sub(r"\s+", " ", t)
    t = t.replace(" __NEWLINE__ ", "\n")

    return t.strip()


def detect_column_indices(rows: List[List[Optional[str]]]) -> Dict[str, int]:
    """Dynamically detect table column indices from header rows."""
    indices = {
        "sr": 0,
        "unit": 1,
        "q": 2,
        "ans": 3,
        "marks": 4,
        "opt_a": 5,
        "opt_b": 6,
        "opt_c": 7,
        "opt_d": 8,
    }

    for r in rows[:25]:
        if not r or not any(r):
            continue
        cleaned_cells = [c.lower().replace("\n", "").replace(" ", "").replace("_", "") if c else "" for c in r]

        has_sr = any("sr" in c for c in cleaned_cells)
        has_q = any("question" in c for c in cleaned_cells)

        if has_sr and has_q:
            for idx, c in enumerate(cleaned_cells):
                raw_cell = r[idx].lower() if r[idx] else ""
                if "sr" in c:
                    indices["sr"] = idx
                elif "unit" in c:
                    indices["unit"] = idx
                elif "question" in c:
                    indices["q"] = idx
                elif "answer" in c or "mcq" in c:
                    indices["ans"] = idx
                elif "mark" in c:
                    indices["marks"] = idx
                elif "option1" in c or "optiona" in c or "(a)" in raw_cell:
                    indices["opt_a"] = idx
                elif "option2" in c or "optionb" in c or "(b)" in raw_cell:
                    indices["opt_b"] = idx
                elif "option3" in c or "optionc" in c or "(c)" in raw_cell:
                    indices["opt_c"] = idx
                elif "option4" in c or "optiond" in c or "(d)" in raw_cell:
                    indices["opt_d"] = idx
            break

    return indices


def parse_pdf_question_bank(
    pdf_path: str, extract_images: bool = True, output_dir: str = "."
) -> Dict[str, Any]:
    """Parse any compatible institutional PDF question bank into structured JSON with images."""
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(pdf_path)
    base_slug = os.path.splitext(os.path.basename(pdf_path))[0].replace(" ", "_")
    img_dir = os.path.join(output_dir, "images", base_slug)
    if extract_images:
        os.makedirs(img_dir, exist_ok=True)

    print(f"[*] Processing '{os.path.basename(pdf_path)}' ({len(doc)} pages)...")

    # Pass 1: Extract all table rows and match image rects
    first_pages_rows = []
    for page in doc[:3]:
        tabs = page.find_tables().tables
        for tab in tabs:
            first_pages_rows.extend(tab.extract())

    col = detect_column_indices(first_pages_rows)
    print(f"[*] Detected column mapping: {col}")

    chapters: Dict[int, Dict[str, Any]] = {}
    unit_titles: Dict[int, str] = {}
    q_map: Dict[int, Dict[str, Any]] = {}

    total_mcqs = 0
    total_short_answer = 0
    total_descriptive = 0
    total_extracted_images = 0

    current_unit_banner_id = None

    for page_idx, page in enumerate(doc):
        page_num = page_idx + 1
        tabs = page.find_tables().tables
        if not tabs:
            continue
        tab = tabs[0]
        rows = tab.extract()

        # Step A: Parse question rows on this page
        row_sr_map: Dict[int, int] = {}  # table row_idx -> sr_no

        for row_idx, r in enumerate(rows):
            if not r or not any(r):
                continue
            cells = [c.strip() if c else "" for c in r]
            first_cell = cells[col["sr"]] if len(cells) > col["sr"] else ""

            # Detect Unit Banner Rows (e.g. 'Unit-1 Introduction')
            unit_match = re.match(r"^Unit\s*[-–—]?\s*(\d+)(.*)", first_cell, re.IGNORECASE)
            if unit_match:
                u_id = int(unit_match.group(1))
                raw_title = clean_text(first_cell)
                current_unit_banner_id = u_id
                unit_titles[u_id] = raw_title
                continue

            # Ignore headers & institution banners
            if (
                "sr" in first_cell.lower()
                or "question" in first_cell.lower()
                or "note:" in first_cell.lower()
                or "note :" in first_cell.lower()
                or "institute" in first_cell.lower()
            ):
                continue

            if first_cell.isdigit():
                sr_no = int(first_cell)
                row_sr_map[row_idx] = sr_no

                unit_str = cells[col["unit"]] if len(cells) > col["unit"] else ""
                q_text = cells[col["q"]] if len(cells) > col["q"] else ""
                ans_raw = cells[col["ans"]] if len(cells) > col["ans"] else ""
                marks_str = cells[col["marks"]] if len(cells) > col["marks"] else "1"

                opt_a = cells[col["opt_a"]] if len(cells) > col["opt_a"] else ""
                opt_b = cells[col["opt_b"]] if len(cells) > col["opt_b"] else ""
                opt_c = cells[col["opt_c"]] if len(cells) > col["opt_c"] else ""
                opt_d = cells[col["opt_d"]] if len(cells) > col["opt_d"] else ""

                u_num_match = re.search(r"\d+", unit_str)
                if u_num_match:
                    unit_id = int(u_num_match.group())
                elif current_unit_banner_id is not None:
                    unit_id = current_unit_banner_id
                else:
                    unit_id = 1

                if unit_id in unit_titles:
                    unit_name = unit_titles[unit_id]
                else:
                    unit_name = f"Unit-{unit_id}"
                    unit_titles[unit_id] = unit_name

                q_text_clean = clean_text(q_text)
                opt_a_clean = clean_text(opt_a)
                opt_b_clean = clean_text(opt_b)
                opt_c_clean = clean_text(opt_c)
                opt_d_clean = clean_text(opt_d)
                ans_clean = clean_text(ans_raw)
                ans_upper = ans_clean.upper()

                try:
                    marks = int(re.search(r"\d+", marks_str).group()) if re.search(r"\d+", marks_str) else 1
                except Exception:
                    marks = 1

                has_options = any([opt_a_clean, opt_b_clean, opt_c_clean, opt_d_clean])

                if has_options or ans_upper in ["A", "B", "C", "D"]:
                    q_type = "mcq"
                    total_mcqs += 1
                    options = {
                        "A": opt_a_clean,
                        "B": opt_b_clean,
                        "C": opt_c_clean,
                        "D": opt_d_clean,
                    }
                    correct_opt = ans_upper if ans_upper in ["A", "B", "C", "D"] else None
                    correct_text = options.get(correct_opt, "") if correct_opt else ans_clean
                elif ans_clean:
                    q_type = "short_answer"
                    total_short_answer += 1
                    options = {}
                    correct_opt = None
                    correct_text = ans_clean
                else:
                    q_type = "descriptive"
                    total_descriptive += 1
                    options = {}
                    correct_opt = None
                    correct_text = None

                q_obj = {
                    "sr_no": sr_no,
                    "unit_number": unit_id,
                    "unit_name": unit_name,
                    "type": q_type,
                    "marks": marks,
                    "question": q_text_clean,
                    "options": options,
                    "correct_option": correct_opt,
                    "correct_answer_text": correct_text,
                    "images": [],
                    "page": page_num,
                }

                if unit_id not in chapters:
                    chapters[unit_id] = {
                        "unit_id": unit_id,
                        "unit_title": unit_name,
                        "questions": [],
                    }

                chapters[unit_id]["questions"].append(q_obj)
                q_map[sr_no] = q_obj

        # Step B: Associate page images with question rows based on vertical position
        if extract_images:
            imgs = page.get_images()
            for img in imgs:
                xref = img[0]
                rects = page.get_image_rects(xref)
                for r_idx, rect in enumerate(rects):
                    y_center = (rect.y0 + rect.y1) / 2
                    # Find which table row bounds this image
                    for row_idx, table_row in enumerate(tab.rows):
                        if table_row.bbox[1] <= y_center <= table_row.bbox[3]:
                            if row_idx in row_sr_map:
                                sr_no = row_sr_map[row_idx]
                                img_idx = len(q_map[sr_no]["images"]) + 1
                                img_filename = f"q_{sr_no}_{img_idx}.png"
                                img_rel_path = f"images/{base_slug}/{img_filename}"
                                img_abs_path = os.path.join(img_dir, img_filename)

                                # Render crisp crop of image bounding box
                                pix = page.get_pixmap(clip=rect, dpi=150)
                                pix.save(img_abs_path)

                                q_map[sr_no]["images"].append(img_rel_path)
                                total_extracted_images += 1
                            break

    # Sort chapters by unit_id
    sorted_chapters = [chapters[uid] for uid in sorted(chapters.keys())]
    total_q = sum(len(ch["questions"]) for ch in sorted_chapters)

    payload = {
        "metadata": {
            "source_file": os.path.basename(pdf_path),
            "source_path": os.path.abspath(pdf_path),
            "extracted_at": datetime.now().isoformat(),
            "total_questions": total_q,
            "total_mcqs": total_mcqs,
            "total_short_answers": total_short_answer,
            "total_descriptive": total_descriptive,
            "total_images": total_extracted_images,
            "total_units": len(sorted_chapters),
            "parser": "Universal Deterministic Table & Image Parser (Zero-AI)",
        },
        "chapters": sorted_chapters,
    }

    return payload


def export_all(data: Dict[str, Any], output_dir: str = ".") -> Dict[str, str]:
    """Export the structured data to JSON, Flat JSON, Markdown, and CSV."""
    os.makedirs(output_dir, exist_ok=True)
    base_name = os.path.splitext(data.get("metadata", {}).get("source_file", "export"))[0]

    # 1. Hierarchical JSON
    json_path = os.path.join(output_dir, f"{base_name}_structured.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[OK] Hierarchical JSON saved: {json_path}")

    # 2. Flat List JSON
    flat_questions = []
    for ch in data["chapters"]:
        for q in ch["questions"]:
            flat_questions.append(q)

    flat_json_path = os.path.join(output_dir, f"{base_name}_flat.json")
    with open(flat_json_path, "w", encoding="utf-8") as f:
        json.dump(flat_questions, f, indent=2, ensure_ascii=False)
    print(f"[OK] Flat JSON saved: {flat_json_path}")

    # 3. Clean Markdown Export
    md_path = os.path.join(output_dir, f"{base_name}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# Question Bank: {data['metadata']['source_file']}\n\n")
        f.write(f"- **Total Questions**: {data['metadata']['total_questions']}\n")
        f.write(f"- **MCQs**: {data['metadata']['total_mcqs']}\n")
        f.write(f"- **Short Answers**: {data['metadata']['total_short_answers']}\n")
        f.write(f"- **Descriptive/Theory**: {data['metadata']['total_descriptive']}\n")
        f.write(f"- **Extracted Images**: {data['metadata']['total_images']}\n")
        f.write(f"- **Chapters/Units**: {data['metadata']['total_units']}\n\n")
        f.write("---\n\n")

        for ch in data["chapters"]:
            f.write(f"## {ch['unit_title']}\n\n")
            f.write(f"*Total Questions in Chapter: {len(ch['questions'])}*\n\n")

            for q in ch["questions"]:
                f.write(f"### Q{q['sr_no']}. {q['question']}\n\n")
                f.write(f"- **Marks**: {q['marks']} | **Type**: {q['type'].upper()} | **Page**: {q['page']}\n")

                if q.get("images"):
                    for img in q["images"]:
                        f.write(f"\n![Diagram / Table for Q{q['sr_no']}]({img})\n")

                if q["type"] == "mcq":
                    f.write("\n")
                    for opt_key, opt_val in q["options"].items():
                        is_correct = " *(Correct)*" if opt_key == q["correct_option"] else ""
                        f.write(f"- **({opt_key})** {opt_val}{is_correct}\n")
                    ans_label = q["correct_option"] or ""
                    ans_detail = f" ({q['correct_answer_text']})" if q["correct_answer_text"] else ""
                    f.write(f"\n> **Answer**: **{ans_label}**{ans_detail}\n\n")
                elif q["type"] == "short_answer":
                    f.write(f"\n> **Solution / Key**: `{q['correct_answer_text']}`\n\n")
                else:
                    f.write("\n*(Descriptive question - No answer key provided in source)*\n\n")

                f.write("---\n\n")
    print(f"[OK] Markdown saved: {md_path}")

    # 4. CSV Export
    csv_path = os.path.join(output_dir, f"{base_name}.csv")
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Sr_No",
            "Unit_Id",
            "Unit_Name",
            "Type",
            "Marks",
            "Question",
            "Option_A",
            "Option_B",
            "Option_C",
            "Option_D",
            "Correct_Option",
            "Correct_Answer_Text",
            "Images",
            "Page",
        ])
        for q in flat_questions:
            writer.writerow([
                q["sr_no"],
                q["unit_number"],
                q["unit_name"],
                q["type"],
                q["marks"],
                q["question"],
                q["options"].get("A", ""),
                q["options"].get("B", ""),
                q["options"].get("C", ""),
                q["options"].get("D", ""),
                q["correct_option"] or "",
                q["correct_answer_text"] or "",
                ";".join(q.get("images", [])),
                q["page"],
            ])
    print(f"[OK] CSV saved: {csv_path}")

    return {
        "json_path": json_path,
        "flat_json_path": flat_json_path,
        "md_path": md_path,
        "csv_path": csv_path,
    }


if __name__ == "__main__":
    target_pdf = "Python-2 Practice Book 2025.pdf"
    if len(sys.argv) > 1:
        target_pdf = sys.argv[1]

    out_folder = "."
    if len(sys.argv) > 2:
        out_folder = sys.argv[2]

    parsed = parse_pdf_question_bank(target_pdf, extract_images=True, output_dir=out_folder)
    paths = export_all(parsed, out_folder)

    print("\n[SUCCESS] Extraction completed:")
    print(f"  - Total Questions: {parsed['metadata']['total_questions']}")
    print(f"  - MCQs: {parsed['metadata']['total_mcqs']}")
    print(f"  - Short Answers: {parsed['metadata']['total_short_answers']}")
    print(f"  - Descriptive: {parsed['metadata']['total_descriptive']}")
    print(f"  - Images Extracted: {parsed['metadata']['total_images']}")
    print(f"  - Chapters: {parsed['metadata']['total_units']}")
