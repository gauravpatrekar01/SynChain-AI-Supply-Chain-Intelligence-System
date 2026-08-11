"""
SynChain - Phase 1: Dataset Header Inspection
Quick scan of all datasets to understand their structure before deep EDA.
"""

import os
import sys
import pandas as pd
from pathlib import Path

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = Path(r"d:\SynChain-AI-Supply-Chain-Intelligence-System\datasets")

csv_files = sorted(DATA_DIR.glob("*.csv"))
xlsx_files = sorted(DATA_DIR.glob("*.xlsx"))

print("=" * 80)
print("SYNCHAIN - PHASE 1: DATASET INVENTORY & HEADER INSPECTION")
print("=" * 80)
print(f"\nTotal CSV files: {len(csv_files)}")
print(f"Total XLSX files: {len(xlsx_files)}")
print()

for f in csv_files:
    size_mb = f.stat().st_size / (1024 * 1024)
    print(f"\n{'-' * 80}")
    print(f"FILE: {f.name}  ({size_mb:.1f} MB)")
    print(f"{'-' * 80}")
    
    try:
        df = pd.read_csv(f, nrows=5, encoding='latin-1')
        print(f"  Columns ({len(df.columns)}): {list(df.columns)}")
    except Exception as e:
        print(f"  ERROR reading: {e}")

for f in xlsx_files:
    size_mb = f.stat().st_size / (1024 * 1024)
    print(f"\n{'-' * 80}")
    print(f"FILE: {f.name}  ({size_mb:.1f} MB)")
    print(f"{'-' * 80}")
    
    try:
        df = pd.read_excel(f, nrows=5)
        print(f"  Columns ({len(df.columns)}): {list(df.columns)}")
    except Exception as e:
        print(f"  ERROR reading: {e}")
