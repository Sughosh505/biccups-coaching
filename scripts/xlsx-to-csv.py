#!/usr/bin/env python3
"""
Split a client's workbook into one CSV per tab, so import-checkins.mjs can read it.

    python scripts/xlsx-to-csv.py "PRANAV CHAD TRANSFORMATION.xlsx" scratch/pranav

Standard library only — an .xlsx is a zip of XML, and a migration tool run a
handful of times should not add a dependency to the app.

Two things it has to get right or the import is silently wrong:

* **Dates are serial numbers**, not text. Excel counts days from 1899-12-30, and
  a cell only reads as a date because its style says so — so styles.xml has to be
  consulted to tell 2026-08-25 from the number 46264.
* **Times are fractions of a day.** A bedtime of 00:30 is stored as 0.0208333,
  and rendering it as a number would lose it entirely.

Everything else is passed through as written, including the mess: fixing values
is import-checkins.mjs's job, and it reports what it changed. A converter that
also cleaned would hide that.
"""
import csv
import re
import sys
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}

# Formats Excel ships as dates/times without spelling them out in styles.xml.
BUILTIN_DATE_FMTS = set(range(14, 23)) | set(range(45, 48)) | {27, 30, 36, 50, 57}


def col_index(ref):
    """'BC12' -> 54. Column letters are base-26 with no zero."""
    letters = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def load_shared_strings(zf):
    try:
        root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    out = []
    for si in root.findall("m:si", NS):
        # A cell with mixed formatting is split into <r> runs; join them back.
        out.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
    return out


def load_date_styles(zf):
    """Return the set of style indices whose number format renders a date or time."""
    try:
        root = ET.fromstring(zf.read("xl/styles.xml"))
    except KeyError:
        return set(), {}

    custom = {}
    for nf in root.iter(f"{{{NS['m']}}}numFmt"):
        code = nf.get("formatCode", "")
        fid = int(nf.get("numFmtId"))
        # Strip literals and colour codes before looking for date tokens.
        bare = re.sub(r'\[[^\]]*\]|"[^"]*"', "", code)
        if re.search(r"[dmyhs]", bare, re.I):
            custom[fid] = code

    date_styles, time_only = set(), {}
    cell_xfs = root.find("m:cellXfs", NS)
    if cell_xfs is None:
        return date_styles, time_only

    for i, xf in enumerate(cell_xfs.findall("m:xf", NS)):
        fid = int(xf.get("numFmtId", 0))
        code = custom.get(fid)
        if fid in BUILTIN_DATE_FMTS or code:
            date_styles.add(i)
            probe = code or ""
            bare = re.sub(r'\[[^\]]*\]|"[^"]*"', "", probe)
            # h/s without y/d/m-as-month means a clock time, which must not be
            # rendered as a date — a bedtime is a fraction of a day, not a day.
            if re.search(r"[hs]", bare, re.I) and not re.search(r"[yd]", bare, re.I):
                time_only[i] = True
    return date_styles, time_only


def serial_to_text(value, time_only):
    """Excel's epoch is 1899-12-30 (its 1900 leap-year bug is already baked in)."""
    try:
        days = float(value)
    except (TypeError, ValueError):
        return value
    if time_only or (0 <= days < 1):
        total = round(days * 24 * 60)
        return f"{total // 60 % 24:02d}:{total % 60:02d}"
    dt = datetime(1899, 12, 30) + timedelta(days=days)
    if dt.hour or dt.minute:
        return dt.strftime("%Y-%m-%d %H:%M")
    return dt.strftime("%Y-%m-%d")


def sheet_rows(zf, path, strings, date_styles, time_only):
    root = ET.fromstring(zf.read(path))
    rows = []
    for row in root.iter(f"{{{NS['m']}}}row"):
        cells = {}
        for c in row.findall("m:c", NS):
            ref = c.get("r")
            if not ref:
                continue
            idx = col_index(ref)
            ctype = c.get("t")
            style = int(c.get("s", -1))

            if ctype == "inlineStr":
                is_el = c.find("m:is", NS)
                text = "".join(t.text or "" for t in is_el.iter(f"{{{NS['m']}}}t")) if is_el is not None else ""
            else:
                v = c.find("m:v", NS)
                if v is None or v.text is None:
                    continue
                raw = v.text
                if ctype == "s":
                    text = strings[int(raw)] if int(raw) < len(strings) else ""
                elif ctype == "b":
                    text = "TRUE" if raw == "1" else "FALSE"
                elif style in date_styles:
                    text = serial_to_text(raw, time_only.get(style, False))
                else:
                    # Trim float noise: 78.80000000000001 -> 78.8
                    try:
                        f = float(raw)
                        text = str(int(f)) if f == int(f) else f"{f:.10g}"
                    except ValueError:
                        text = raw
            cells[idx] = text
        width = max(cells) + 1 if cells else 0
        rows.append([cells.get(i, "") for i in range(width)])
    return rows


def main():
    if len(sys.argv) < 3:
        print("usage: python scripts/xlsx-to-csv.py <workbook.xlsx> <out-dir>")
        return 2

    src, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(src) as zf:
        strings = load_shared_strings(zf)
        date_styles, time_only = load_date_styles(zf)

        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        target = {r.get("Id"): r.get("Target") for r in rels}

        book = ET.fromstring(zf.read("xl/workbook.xml"))
        for sheet in book.iter(f"{{{NS['m']}}}sheet"):
            name = sheet.get("name")
            rid = sheet.get(f"{{{NS['r']}}}id")
            path = target.get(rid, "")
            if not path:
                continue
            if not path.startswith("xl/"):
                path = "xl/" + path.lstrip("/")

            rows = sheet_rows(zf, path, strings, date_styles, time_only)
            safe = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").lower()
            dest = out_dir / f"{safe}.csv"
            with open(dest, "w", newline="", encoding="utf-8") as fh:
                csv.writer(fh).writerows(rows)
            filled = sum(1 for r in rows if any(c.strip() for c in r))
            print(f"  {name:<24} -> {dest}  ({filled} non-empty rows)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
