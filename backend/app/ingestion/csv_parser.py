import csv
import io
import logging
from typing import Dict, Any, List, Tuple, Optional

logger = logging.getLogger("synchain.ingestion.csv")

MISSING_VALUE_STRINGS = {
    "", "null", "none", "nan", "n/a", "na", "-", "--", "nil", "undefined"
}


def detect_encoding(content: bytes) -> str:
    """Detect text encoding with fallbacks."""
    for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252", "iso-8859-1"):
        try:
            content.decode(enc)
            return enc
        except UnicodeDecodeError:
            continue
    return "utf-8"


def detect_delimiter(sample_text: str) -> str:
    """Sniff delimiter from sample text with fallback to comma."""
    if not sample_text:
        return ","
    try:
        sniffer = csv.Sniffer()
        dialect = sniffer.sniff(sample_text, delimiters=",\t;|")
        return dialect.delimiter
    except Exception:
        # Fallback heuristic: count common separators in first few lines
        lines = [line for line in sample_text.splitlines() if line.strip()][:5]
        if lines:
            counts = {
                ",": sum(l.count(",") for l in lines),
                ";": sum(l.count(";") for l in lines),
                "\t": sum(l.count("\t") for l in lines),
                "|": sum(l.count("|") for l in lines),
            }
            best = max(counts, key=counts.get)
            if counts[best] > 0:
                return best
        return ","


def clean_cell_value(val: Any) -> Any:
    """Clean and type-cast cell value where appropriate."""
    if val is None:
        return None
    if isinstance(val, str):
        trimmed = val.strip()
        if trimmed.lower() in MISSING_VALUE_STRINGS:
            return None
        return trimmed
    return val


def parse_csv_file(
    content: bytes,
    filename: str = "data.csv"
) -> Dict[str, Any]:
    """
    Safely parse CSV content into headers, structured rows, and malformed row reports.
    """
    logger.info(f"Parsing CSV file: {filename} (size: {len(content)} bytes)")
    
    encoding = detect_encoding(content)
    text = content.decode(encoding, errors="replace")
    
    # Split lines and drop empty lines
    raw_lines = text.splitlines()
    non_empty_lines = [line for line in raw_lines if line.strip()]
    
    if not non_empty_lines:
        return {
            "headers": [],
            "rows": [],
            "total_rows": 0,
            "malformed_rows": [],
            "delimiter": ",",
            "encoding": encoding,
        }

    sample_chunk = "\n".join(non_empty_lines[:15])
    delimiter = detect_delimiter(sample_chunk)
    logger.info(f"Detected delimiter: '{delimiter}', encoding: '{encoding}' for {filename}")

    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    
    headers: List[str] = []
    rows: List[Dict[str, Any]] = []
    malformed_rows: List[Dict[str, Any]] = []

    # Find first non-empty line as header
    header_row_index = -1
    for idx, row in enumerate(reader):
        cleaned_row = [c.strip() for c in row if c is not None]
        if any(cleaned_row):
            headers = [
                (c.strip() if c.strip() else f"column_{col_idx + 1}")
                for col_idx, c in enumerate(row)
            ]
            header_row_index = idx
            break

    if not headers:
        return {
            "headers": [],
            "rows": [],
            "total_rows": 0,
            "malformed_rows": [],
            "delimiter": delimiter,
            "encoding": encoding,
        }

    expected_cols_count = len(headers)
    current_data_row = 0

    for physical_idx, row in enumerate(reader):
        current_data_row += 1
        
        # Skip completely empty rows
        if not any(c.strip() for c in row if isinstance(c, str)):
            continue

        if len(row) != expected_cols_count:
            # Malformed row detected - record without crashing
            malformed_rows.append({
                "row_index": current_data_row,
                "error": f"Expected {expected_cols_count} columns, found {len(row)}",
                "raw_values": row[:10]  # truncate if huge
            })
            # If it has fewer cols, pad with None; if more, trim to headers length
            if len(row) < expected_cols_count:
                row = row + [None] * (expected_cols_count - len(row))
            else:
                row = row[:expected_cols_count]

        row_dict: Dict[str, Any] = {}
        for h, v in zip(headers, row):
            row_dict[h] = clean_cell_value(v)
            
        rows.append(row_dict)

    logger.info(f"Parsed {len(rows)} valid rows, {len(malformed_rows)} malformed rows from {filename}")

    return {
        "headers": headers,
        "rows": rows,
        "total_rows": len(rows),
        "malformed_rows": malformed_rows,
        "delimiter": delimiter,
        "encoding": encoding,
    }
