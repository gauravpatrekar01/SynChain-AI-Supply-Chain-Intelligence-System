"""SynChain AI - Multi-Source Data Ingestion Package
Supports CSV, Excel (.xlsx, .xls) parsing, validation, column normalization, and database ingestion.
"""

from .csv_parser import parse_csv_file
from .excel_parser import parse_excel_file, get_excel_sheet_names
from .normalizer import (
    CANONICAL_SCHEMA,
    auto_map_columns,
    normalize_records,
)
from .validator import validate_supply_chain_data
from .service import IngestionService

__all__ = [
    "parse_csv_file",
    "parse_excel_file",
    "get_excel_sheet_names",
    "CANONICAL_SCHEMA",
    "auto_map_columns",
    "normalize_records",
    "validate_supply_chain_data",
    "IngestionService",
]
