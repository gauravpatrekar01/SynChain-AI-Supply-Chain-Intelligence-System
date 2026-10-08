import io
import logging
from typing import Dict, Any, List, Optional
import pandas as pd
import openpyxl

logger = logging.getLogger("synchain.ingestion.excel")

MISSING_VALUE_STRINGS = {
    "", "null", "none", "nan", "n/a", "na", "-", "--", "nil", "undefined"
}


def clean_cell_value(val: Any) -> Any:
    """Clean and type-cast cell value where appropriate."""
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (pd.Timestamp, )):
        return val.isoformat()
    if hasattr(val, "isoformat") and callable(val.isoformat):
        try:
            return val.isoformat()
        except Exception:
            pass
    if isinstance(val, str):
        trimmed = val.strip()
        if trimmed.lower() in MISSING_VALUE_STRINGS:
            return None
        return trimmed
    if isinstance(val, (int, float)):
        # Check if float is whole number
        if isinstance(val, float) and val.is_integer():
            return int(val)
        return val
    return str(val)


def get_excel_sheet_names(content: bytes, filename: str) -> List[str]:
    """
    Safely inspect and return all sheet names inside an Excel workbook (.xlsx or .xls).
    """
    is_xls = filename.lower().endswith(".xls")
    try:
        buffer = io.BytesIO(content)
        if is_xls:
            excel_file = pd.ExcelFile(buffer, engine="xlrd")
            return list(excel_file.sheet_names)
        else:
            # openpyxl with read_only=True avoids memory spikes and disables external references
            wb = openpyxl.load_workbook(buffer, read_only=True, keep_links=False, data_only=True)
            return list(wb.sheetnames)
    except Exception as e:
        logger.error(f"Failed to read sheet names from {filename}: {str(e)}")
        raise ValueError(f"Unable to read Excel workbook sheets: {str(e)}")


def parse_excel_file(
    content: bytes,
    filename: str,
    sheet_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Safely parse a specified sheet (or first sheet) from an Excel workbook (.xlsx or .xls).
    """
    logger.info(f"Parsing Excel file: {filename} (requested sheet: {sheet_name})")
    sheet_names = get_excel_sheet_names(content, filename)
    
    if not sheet_names:
        return {
            "sheet_names": [],
            "selected_sheet": "",
            "headers": [],
            "rows": [],
            "total_rows": 0,
            "malformed_rows": []
        }

    target_sheet = sheet_name if (sheet_name and sheet_name in sheet_names) else sheet_names[0]
    is_xls = filename.lower().endswith(".xls")
    engine = "xlrd" if is_xls else "openpyxl"

    buffer = io.BytesIO(content)
    try:
        df = pd.read_excel(
            buffer,
            sheet_name=target_sheet,
            engine=engine,
            dtype=object  # Preserve raw strings/types for custom normalization
        )
    except Exception as e:
        logger.error(f"Error reading Excel sheet '{target_sheet}' from {filename}: {str(e)}")
        raise ValueError(f"Failed to read Excel sheet '{target_sheet}': {str(e)}")

    # Clean headers
    raw_headers = [str(col).strip() for col in df.columns]
    headers: List[str] = []
    for idx, col in enumerate(raw_headers):
        if col.startswith("Unnamed:") or not col:
            headers.append(f"column_{idx + 1}")
        else:
            headers.append(col)

    df.columns = headers

    # Drop rows that are completely NaN/empty
    df = df.dropna(how="all")

    rows: List[Dict[str, Any]] = []
    malformed_rows: List[Dict[str, Any]] = []

    for idx, row in df.iterrows():
        row_dict: Dict[str, Any] = {}
        has_data = False
        for col in headers:
            raw_val = row[col]
            cleaned_val = clean_cell_value(raw_val)
            if cleaned_val is not None:
                has_data = True
            row_dict[col] = cleaned_val

        if has_data:
            rows.append(row_dict)

    logger.info(
        f"Parsed Excel sheet '{target_sheet}' in {filename}: "
        f"{len(rows)} valid rows, {len(headers)} columns"
    )

    return {
        "sheet_names": sheet_names,
        "selected_sheet": target_sheet,
        "headers": headers,
        "rows": rows,
        "total_rows": len(rows),
        "malformed_rows": malformed_rows
    }
