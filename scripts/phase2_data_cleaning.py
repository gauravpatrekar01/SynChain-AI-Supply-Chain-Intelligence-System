"""
=============================================================================
SYNCHAIN - PHASE 2: DATA CLEANING
=============================================================================

Objective:
    Clean all supply-chain datasets to prepare them for feature engineering.
    
    Steps:
    1. Drop useless columns (100% null, constant, PII, irrelevant)
    2. Handle missing values
    3. Fix data types (parse dates, correct numerics)
    4. Remove redundant columns (perfect correlations)
    5. Standardize column names
    6. Handle outliers (flag, don't remove)
    7. Validate and save clean datasets

Input:
    datasets/DataCoSupplyChainDataset.csv  (primary)
    datasets/supply_chain_data.csv         (supplier intelligence)
    datasets/Grocery_Inventory new v1.csv  (inventory features)
    datasets/retail_store_inventory.csv    (demand & weather)
    datasets/delivery_events.csv           (logistics)
    datasets/loads.csv                     (logistics)
    datasets/trips.csv                     (logistics)

Output:
    data/processed/dataco_cleaned.csv
    data/processed/supply_chain_cleaned.csv
    data/processed/grocery_inventory_cleaned.csv
    data/processed/retail_inventory_cleaned.csv
    data/processed/logistics_merged_cleaned.csv
    data/processed/cleaning_report.txt

Author: SynChain AI Team
Phase: 2 of 20
"""

import sys
import os
import warnings
from pathlib import Path
from typing import Optional, List, Dict, Tuple
import logging

import numpy as np
import pandas as pd

warnings.filterwarnings('ignore')
sys.stdout.reconfigure(encoding='utf-8')

# ── Configuration ──────────────────────────────────────────────────────────────
DATA_DIR = Path(r"d:\SynChain-AI-Supply-Chain-Intelligence-System\datasets")
OUTPUT_DIR = Path(r"d:\SynChain-AI-Supply-Chain-Intelligence-System\data\processed")
REPORT_DIR = Path(r"d:\SynChain-AI-Supply-Chain-Intelligence-System\outputs\phase2_cleaning")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(REPORT_DIR / 'cleaning.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger(__name__)


# ── Utility Functions ─────────────────────────────────────────────────────────
def section_header(title: str) -> None:
    """Print a formatted section header."""
    logger.info("=" * 80)
    logger.info(f"  {title}")
    logger.info("=" * 80)


def log_shape_change(name: str, before: Tuple[int, int], after: Tuple[int, int]) -> None:
    """Log the shape change after a cleaning step."""
    row_diff = before[0] - after[0]
    col_diff = before[1] - after[1]
    logger.info(f"  {name}:")
    logger.info(f"    Before: {before[0]:,} rows x {before[1]} cols")
    logger.info(f"    After:  {after[0]:,} rows x {after[1]} cols")
    logger.info(f"    Removed: {row_diff:,} rows, {col_diff} columns")


def standardize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """
    Standardize column names to snake_case.
    
    Rules:
    - lowercase
    - spaces and special chars to underscores
    - remove parentheses and brackets
    - collapse multiple underscores
    """
    new_cols = {}
    for col in df.columns:
        new_name = col.lower().strip()
        new_name = new_name.replace(' ', '_')
        new_name = new_name.replace('(', '').replace(')', '')
        new_name = new_name.replace('/', '_')
        new_name = new_name.replace('-', '_')
        new_name = new_name.replace('.', '_')
        # Collapse multiple underscores
        while '__' in new_name:
            new_name = new_name.replace('__', '_')
        new_name = new_name.strip('_')
        new_cols[col] = new_name
    
    df = df.rename(columns=new_cols)
    return df


# =============================================================================
# SECTION 1: CLEAN PRIMARY DATASET (DataCoSupplyChain)
# =============================================================================
def clean_dataco() -> pd.DataFrame:
    """
    Clean the DataCoSupplyChainDataset.
    
    Cleaning steps:
    1. Drop useless columns (PII, 100% null, constant, irrelevant URLs)
    2. Drop redundant columns (perfect correlations found in Phase 1)
    3. Handle remaining missing values
    4. Parse date columns
    5. Fix data types
    6. Standardize column names
    7. Flag outliers (preserve data, add flag columns)
    8. Add leakage warning metadata
    """
    section_header("1. CLEANING PRIMARY DATASET: DataCoSupplyChainDataset.csv")
    
    logger.info("Loading dataset...")
    df = pd.read_csv(DATA_DIR / "DataCoSupplyChainDataset.csv", encoding='latin-1')
    initial_shape = df.shape
    logger.info(f"  Loaded: {df.shape[0]:,} rows x {df.shape[1]} columns")
    
    # ── Step 1: Drop Useless Columns ──────────────────────────────────────
    logger.info("\n  STEP 1: Dropping useless columns")
    
    # 1a. PII columns (all masked/constant - zero predictive value)
    pii_cols = ['Customer Email', 'Customer Password', 'Customer Street']
    logger.info(f"    PII columns to drop: {pii_cols}")
    for col in pii_cols:
        if col in df.columns:
            unique_vals = df[col].nunique()
            logger.info(f"      {col}: {unique_vals} unique value(s) - confirmed useless")
    
    # 1b. 100% null column
    null_cols = ['Product Description']
    logger.info(f"    100% null columns to drop: {null_cols}")
    
    # 1c. Highly sparse column (86% missing)
    sparse_cols = ['Order Zipcode']
    logger.info(f"    Highly sparse columns to drop (>80% missing): {sparse_cols}")
    
    # 1d. Constant columns (zero variance)
    constant_cols = ['Product Status']
    logger.info(f"    Constant columns to drop: {constant_cols}")
    for col in constant_cols:
        if col in df.columns:
            logger.info(f"      {col}: always = {df[col].unique()}")
    
    # 1e. Irrelevant columns (URLs, no predictive value)
    irrelevant_cols = ['Product Image']
    logger.info(f"    Irrelevant columns to drop: {irrelevant_cols}")
    
    # 1f. Customer name columns (PII, not useful for ML)
    name_cols = ['Customer Fname', 'Customer Lname']
    logger.info(f"    Customer name columns to drop: {name_cols}")
    
    cols_to_drop_step1 = pii_cols + null_cols + sparse_cols + constant_cols + irrelevant_cols + name_cols
    existing_drops = [c for c in cols_to_drop_step1 if c in df.columns]
    df = df.drop(columns=existing_drops)
    
    log_shape_change("Step 1 - Drop useless columns", initial_shape, df.shape)
    
    # ── Step 2: Drop Redundant Columns ────────────────────────────────────
    logger.info("\n  STEP 2: Dropping redundant columns (perfect correlations)")
    
    # From Phase 1 correlation analysis:
    # Order Item Total == Sales per customer (corr = 1.000) -> keep Sales per customer, drop Order Item Total
    # Benefit per order == Order Profit Per Order (corr = 1.000) -> keep Benefit per order, drop Order Profit Per Order
    # Category Id == Product Category Id (same values) -> keep Category Id, drop Product Category Id
    # Customer Id == Order Customer Id (same values) -> keep Customer Id, drop Order Customer Id
    # Order Item Cardprod Id == Product Card Id (same values) -> keep Product Card Id, drop Order Item Cardprod Id
    
    redundant_pairs = {
        'Order Item Total': 'Sales per customer',
        'Order Profit Per Order': 'Benefit per order',
        'Product Category Id': 'Category Id',
        'Order Customer Id': 'Customer Id',
        'Order Item Cardprod Id': 'Product Card Id',
    }
    
    for drop_col, keep_col in redundant_pairs.items():
        if drop_col in df.columns and keep_col in df.columns:
            # Verify they are indeed redundant
            if df[drop_col].dtype in ['float64', 'int64'] and df[keep_col].dtype in ['float64', 'int64']:
                corr = df[[drop_col, keep_col]].corr().iloc[0, 1]
                logger.info(f"    Dropping '{drop_col}' (corr={corr:.4f} with '{keep_col}')")
            else:
                match_pct = (df[drop_col] == df[keep_col]).mean() * 100
                logger.info(f"    Dropping '{drop_col}' ({match_pct:.1f}% match with '{keep_col}')")
    
    redundant_to_drop = [c for c in redundant_pairs.keys() if c in df.columns]
    before_shape = df.shape
    df = df.drop(columns=redundant_to_drop)
    log_shape_change("Step 2 - Drop redundant columns", before_shape, df.shape)
    
    # ── Step 3: Handle Missing Values ─────────────────────────────────────
    logger.info("\n  STEP 3: Handling remaining missing values")
    
    missing = df.isnull().sum()
    missing_cols = missing[missing > 0]
    
    if len(missing_cols) > 0:
        logger.info(f"    Columns with missing values:")
        for col, cnt in missing_cols.items():
            pct = cnt / len(df) * 100
            logger.info(f"      {col}: {cnt:,} missing ({pct:.2f}%)")
        
        # Customer Zipcode: 3 missing - fill with mode by Customer State
        if 'Customer Zipcode' in df.columns and df['Customer Zipcode'].isnull().sum() > 0:
            n_missing = df['Customer Zipcode'].isnull().sum()
            # For these 3 rows, fill with the most common zipcode in their state
            for idx in df[df['Customer Zipcode'].isnull()].index:
                state = df.loc[idx, 'Customer State']
                mode_zip = df[df['Customer State'] == state]['Customer Zipcode'].mode()
                if len(mode_zip) > 0:
                    df.loc[idx, 'Customer Zipcode'] = mode_zip.iloc[0]
                else:
                    df.loc[idx, 'Customer Zipcode'] = df['Customer Zipcode'].mode().iloc[0]
            logger.info(f"    Customer Zipcode: {n_missing} values imputed using state-based mode")
    else:
        logger.info("    No remaining missing values!")
    
    # Final missing check
    remaining_missing = df.isnull().sum().sum()
    logger.info(f"    Total remaining missing values: {remaining_missing}")
    
    # ── Step 4: Parse Date Columns ────────────────────────────────────────
    logger.info("\n  STEP 4: Parsing date columns")
    
    date_cols = {
        'order date (DateOrders)': 'order_date',
        'shipping date (DateOrders)': 'shipping_date',
    }
    
    for orig_col, new_name in date_cols.items():
        if orig_col in df.columns:
            df[orig_col] = pd.to_datetime(df[orig_col], errors='coerce')
            valid = df[orig_col].notna().sum()
            logger.info(f"    {orig_col} -> parsed: {valid:,}/{len(df):,} valid dates")
            logger.info(f"      Range: {df[orig_col].min()} to {df[orig_col].max()}")
    
    # ── Step 5: Fix Data Types ────────────────────────────────────────────
    logger.info("\n  STEP 5: Fixing data types")
    
    # Late_delivery_risk should be int (already is, just confirm)
    if 'Late_delivery_risk' in df.columns:
        df['Late_delivery_risk'] = df['Late_delivery_risk'].astype(int)
        logger.info(f"    Late_delivery_risk: confirmed int, values = {sorted(df['Late_delivery_risk'].unique())}")
    
    # Category Id, Department Id should be int
    int_cols = ['Category Id', 'Department Id']
    for col in int_cols:
        if col in df.columns:
            df[col] = df[col].astype(int)
            logger.info(f"    {col}: cast to int")
    
    # Customer Zipcode has float (due to missing vals) - convert to nullable int then string
    if 'Customer Zipcode' in df.columns:
        df['Customer Zipcode'] = df['Customer Zipcode'].astype(int).astype(str)
        logger.info(f"    Customer Zipcode: converted to string (zip codes are categorical)")
    
    # Order Item Id should remain int (it's a unique identifier)
    if 'Order Item Id' in df.columns:
        df['Order Item Id'] = df['Order Item Id'].astype(int)
        logger.info(f"    Order Item Id: confirmed int (unique identifier)")
    
    # ── Step 6: Standardize Column Names ──────────────────────────────────
    logger.info("\n  STEP 6: Standardizing column names to snake_case")
    
    old_cols = list(df.columns)
    df = standardize_column_names(df)
    new_cols = list(df.columns)
    
    logger.info(f"    Column name mapping:")
    for old, new in zip(old_cols, new_cols):
        if old != new:
            logger.info(f"      '{old}' -> '{new}'")
    
    # ── Step 7: Flag Outliers ─────────────────────────────────────────────
    logger.info("\n  STEP 7: Flagging outliers (IQR method, preserving data)")
    
    # We flag outliers rather than remove them - they may be legitimate extreme values
    outlier_cols = ['sales', 'benefit_per_order', 'order_item_discount',
                    'order_item_profit_ratio', 'order_item_product_price',
                    'sales_per_customer']
    outlier_cols = [c for c in outlier_cols if c in df.columns]
    
    total_outlier_flags = 0
    for col in outlier_cols:
        Q1 = df[col].quantile(0.25)
        Q3 = df[col].quantile(0.75)
        IQR = Q3 - Q1
        lower = Q1 - 1.5 * IQR
        upper = Q3 + 1.5 * IQR
        
        flag_col = f'{col}_outlier'
        df[flag_col] = ((df[col] < lower) | (df[col] > upper)).astype(int)
        n_flagged = df[flag_col].sum()
        total_outlier_flags += n_flagged
        logger.info(f"    {col}: {n_flagged:,} outliers flagged ({n_flagged/len(df)*100:.2f}%)")
        logger.info(f"      Bounds: [{lower:.2f}, {upper:.2f}]")
    
    logger.info(f"    Total outlier flags added: {total_outlier_flags:,}")
    
    # ── Step 8: Mark Leakage Columns ──────────────────────────────────────
    logger.info("\n  STEP 8: Documenting leakage columns (NOT dropped, flagged for Phase 3)")
    
    leakage_cols = []
    for col in df.columns:
        if col in ['delivery_status', 'days_for_shipping_real', 'shipping_date_dateorders']:
            leakage_cols.append(col)
    
    logger.info(f"    HIGH-RISK leakage columns (to be excluded in feature engineering):")
    for col in leakage_cols:
        logger.info(f"      - {col}")
    logger.info(f"    NOTE: These columns are RETAINED for analysis but will be EXCLUDED from ML features")
    
    # ── Step 9: Data Validation ───────────────────────────────────────────
    logger.info("\n  STEP 9: Final validation")
    
    # Check for any remaining issues
    logger.info(f"    Final shape: {df.shape[0]:,} rows x {df.shape[1]} columns")
    logger.info(f"    Total missing values: {df.isnull().sum().sum()}")
    logger.info(f"    Duplicate rows: {df.duplicated().sum()}")
    
    # Validate target variable integrity
    if 'late_delivery_risk' in df.columns:
        target_dist = df['late_delivery_risk'].value_counts()
        logger.info(f"    Target variable distribution:")
        for val, cnt in target_dist.items():
            logger.info(f"      {val}: {cnt:,} ({cnt/len(df)*100:.1f}%)")
    
    # Validate date ranges
    for col in ['order_date_dateorders', 'shipping_date_dateorders']:
        if col in df.columns:
            logger.info(f"    {col}: {df[col].min()} to {df[col].max()}")
    
    # List final columns
    logger.info(f"\n    Final columns ({len(df.columns)}):")
    for i, col in enumerate(df.columns, 1):
        dtype = df[col].dtype
        logger.info(f"      {i:3d}. {col:50s} ({dtype})")
    
    # ── Save ──────────────────────────────────────────────────────────────
    output_path = OUTPUT_DIR / 'dataco_cleaned.csv'
    df.to_csv(output_path, index=False)
    size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info(f"\n  SAVED: {output_path} ({size_mb:.1f} MB)")
    
    log_shape_change("DataCo Total Cleaning", initial_shape, df.shape)
    
    return df


# =============================================================================
# SECTION 2: CLEAN SUPPLY CHAIN DATA (Supplier Intelligence)
# =============================================================================
def clean_supply_chain() -> pd.DataFrame:
    """Clean supply_chain_data.csv for supplier intelligence features."""
    section_header("2. CLEANING: supply_chain_data.csv")
    
    logger.info("Loading dataset...")
    df = pd.read_csv(DATA_DIR / "supply_chain_data.csv")
    initial_shape = df.shape
    logger.info(f"  Loaded: {df.shape[0]:,} rows x {df.shape[1]} columns")
    
    # Check missing values
    missing = df.isnull().sum()
    missing_cols = missing[missing > 0]
    if len(missing_cols) > 0:
        logger.info(f"  Missing values:")
        for col, cnt in missing_cols.items():
            logger.info(f"    {col}: {cnt}")
    else:
        logger.info("  No missing values")
    
    # Check duplicates
    dupes = df.duplicated().sum()
    logger.info(f"  Duplicates: {dupes}")
    if dupes > 0:
        df = df.drop_duplicates()
        logger.info(f"  Removed {dupes} duplicate rows")
    
    # Standardize column names
    df = standardize_column_names(df)
    
    # Fix data types
    # Numeric columns that might be read as strings
    numeric_cols = ['price', 'availability', 'number_of_products_sold', 'revenue_generated',
                    'stock_levels', 'lead_times', 'order_quantities', 'shipping_times',
                    'shipping_costs', 'lead_time', 'production_volumes',
                    'manufacturing_lead_time', 'manufacturing_costs', 'defect_rates', 'costs']
    
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    logger.info(f"  Final shape: {df.shape[0]:,} rows x {df.shape[1]} columns")
    logger.info(f"  Columns: {list(df.columns)}")
    
    # Save
    output_path = OUTPUT_DIR / 'supply_chain_cleaned.csv'
    df.to_csv(output_path, index=False)
    logger.info(f"  SAVED: {output_path}")
    
    return df


# =============================================================================
# SECTION 3: CLEAN GROCERY INVENTORY (Inventory Features)
# =============================================================================
def clean_grocery_inventory() -> pd.DataFrame:
    """Clean Grocery_Inventory for inventory intelligence features."""
    section_header("3. CLEANING: Grocery_Inventory new v1.csv")
    
    logger.info("Loading dataset...")
    df = pd.read_csv(DATA_DIR / "Grocery_Inventory new v1.csv")
    initial_shape = df.shape
    logger.info(f"  Loaded: {df.shape[0]:,} rows x {df.shape[1]} columns")
    
    # Check missing values
    missing = df.isnull().sum()
    missing_cols = missing[missing > 0]
    if len(missing_cols) > 0:
        logger.info(f"  Missing values:")
        for col, cnt in missing_cols.items():
            pct = cnt / len(df) * 100
            logger.info(f"    {col}: {cnt} ({pct:.1f}%)")
        
        # Impute numeric columns with median
        for col in missing_cols.index:
            if df[col].dtype in ['float64', 'int64']:
                median_val = df[col].median()
                df[col] = df[col].fillna(median_val)
                logger.info(f"    {col}: filled {missing_cols[col]} values with median ({median_val})")
            else:
                mode_val = df[col].mode().iloc[0] if len(df[col].mode()) > 0 else 'Unknown'
                df[col] = df[col].fillna(mode_val)
                logger.info(f"    {col}: filled {missing_cols[col]} values with mode ('{mode_val}')")
    else:
        logger.info("  No missing values")
    
    # Fix typo in column name
    if 'Catagory' in df.columns:
        df = df.rename(columns={'Catagory': 'Category'})
        logger.info("  Fixed column name: 'Catagory' -> 'Category'")
    
    # Parse dates
    date_cols = ['Date_Received', 'Last_Order_Date', 'Expiration_Date']
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
            valid = df[col].notna().sum()
            logger.info(f"  Parsed {col}: {valid}/{len(df)} valid dates")
    
    # Check for duplicates
    dupes = df.duplicated().sum()
    logger.info(f"  Duplicates: {dupes}")
    if dupes > 0:
        df = df.drop_duplicates()
    
    # Standardize column names
    df = standardize_column_names(df)
    
    # Validate key inventory metrics
    if 'stock_quantity' in df.columns:
        neg_stock = (df['stock_quantity'] < 0).sum()
        if neg_stock > 0:
            logger.info(f"  WARNING: {neg_stock} rows have negative stock quantity")
    
    if 'reorder_level' in df.columns and 'stock_quantity' in df.columns:
        below_reorder = (df['stock_quantity'] < df['reorder_level']).sum()
        logger.info(f"  Items below reorder level: {below_reorder}/{len(df)} ({below_reorder/len(df)*100:.1f}%)")
    
    logger.info(f"  Final shape: {df.shape[0]:,} rows x {df.shape[1]} columns")
    
    # Save
    output_path = OUTPUT_DIR / 'grocery_inventory_cleaned.csv'
    df.to_csv(output_path, index=False)
    logger.info(f"  SAVED: {output_path}")
    
    return df


# =============================================================================
# SECTION 4: CLEAN RETAIL STORE INVENTORY (Demand & Weather)
# =============================================================================
def clean_retail_inventory() -> pd.DataFrame:
    """Clean retail_store_inventory.csv for demand forecasting and weather analysis."""
    section_header("4. CLEANING: retail_store_inventory.csv")
    
    logger.info("Loading dataset...")
    df = pd.read_csv(DATA_DIR / "retail_store_inventory.csv")
    initial_shape = df.shape
    logger.info(f"  Loaded: {df.shape[0]:,} rows x {df.shape[1]} columns")
    
    # Check missing values
    missing = df.isnull().sum()
    missing_cols = missing[missing > 0]
    if len(missing_cols) > 0:
        logger.info(f"  Missing values:")
        for col, cnt in missing_cols.items():
            logger.info(f"    {col}: {cnt}")
        
        for col in missing_cols.index:
            if df[col].dtype in ['float64', 'int64']:
                df[col] = df[col].fillna(df[col].median())
            else:
                df[col] = df[col].fillna(df[col].mode().iloc[0])
    else:
        logger.info("  No missing values")
    
    # Parse date column
    if 'Date' in df.columns:
        df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
        valid = df['Date'].notna().sum()
        logger.info(f"  Parsed Date: {valid}/{len(df)} valid dates")
        if valid > 0:
            logger.info(f"    Range: {df['Date'].min()} to {df['Date'].max()}")
    
    # Check duplicates
    dupes = df.duplicated().sum()
    logger.info(f"  Duplicates: {dupes}")
    if dupes > 0:
        df = df.drop_duplicates()
        logger.info(f"  Removed {dupes} duplicate rows")
    
    # Validate inventory logic
    if 'Inventory Level' in df.columns and 'Units Sold' in df.columns:
        neg_inv = (df['Inventory Level'] < 0).sum()
        logger.info(f"  Negative inventory levels: {neg_inv}")
        stockout = (df['Inventory Level'] == 0).sum()
        logger.info(f"  Zero inventory (stockout) records: {stockout}")
    
    # Standardize column names
    df = standardize_column_names(df)
    
    logger.info(f"  Final shape: {df.shape[0]:,} rows x {df.shape[1]} columns")
    logger.info(f"  Columns: {list(df.columns)}")
    
    # Save
    output_path = OUTPUT_DIR / 'retail_inventory_cleaned.csv'
    df.to_csv(output_path, index=False)
    logger.info(f"  SAVED: {output_path}")
    
    return df


# =============================================================================
# SECTION 5: CLEAN & MERGE LOGISTICS DATA
# =============================================================================
def clean_logistics() -> pd.DataFrame:
    """
    Clean and merge logistics cluster datasets:
    loads + trips + delivery_events (delivery subset only).
    
    This creates a single logistics dataset with trip performance,
    delivery timing, and on-time status.
    """
    section_header("5. CLEANING & MERGING: Logistics Cluster")
    
    # ── Load datasets ──
    logger.info("Loading logistics datasets...")
    loads = pd.read_csv(DATA_DIR / "loads.csv")
    trips = pd.read_csv(DATA_DIR / "trips.csv")
    # Only load delivery events (not full file to save memory)
    delivery_events = pd.read_csv(DATA_DIR / "delivery_events.csv")
    
    logger.info(f"  loads:           {loads.shape[0]:,} rows x {loads.shape[1]} cols")
    logger.info(f"  trips:           {trips.shape[0]:,} rows x {trips.shape[1]} cols")
    logger.info(f"  delivery_events: {delivery_events.shape[0]:,} rows x {delivery_events.shape[1]} cols")
    
    # ── Clean loads ──
    logger.info("\n  Cleaning loads...")
    loads_missing = loads.isnull().sum().sum()
    loads_dupes = loads.duplicated().sum()
    logger.info(f"    Missing: {loads_missing}, Duplicates: {loads_dupes}")
    
    if 'load_date' in loads.columns:
        loads['load_date'] = pd.to_datetime(loads['load_date'], errors='coerce')
    
    # ── Clean trips ──
    logger.info("  Cleaning trips...")
    trips_missing = trips.isnull().sum().sum()
    trips_dupes = trips.duplicated().sum()
    logger.info(f"    Missing: {trips_missing}, Duplicates: {trips_dupes}")
    
    if 'dispatch_date' in trips.columns:
        trips['dispatch_date'] = pd.to_datetime(trips['dispatch_date'], errors='coerce')
    
    # ── Clean delivery events ──
    logger.info("  Cleaning delivery_events...")
    de_missing = delivery_events.isnull().sum().sum()
    de_dupes = delivery_events.duplicated().sum()
    logger.info(f"    Missing: {de_missing}, Duplicates: {de_dupes}")
    
    for col in ['scheduled_datetime', 'actual_datetime']:
        if col in delivery_events.columns:
            delivery_events[col] = pd.to_datetime(delivery_events[col], errors='coerce')
    
    # Filter to delivery events only (not pickups) for delivery performance
    if 'event_type' in delivery_events.columns:
        deliveries_only = delivery_events[delivery_events['event_type'] == 'Delivery'].copy()
        logger.info(f"    Filtered to delivery events: {len(deliveries_only):,} rows")
    else:
        deliveries_only = delivery_events.copy()
    
    # ── Merge: loads + trips (on load_id) ──
    logger.info("\n  Merging loads + trips on 'load_id'...")
    loads_trips = pd.merge(loads, trips, on='load_id', how='inner', suffixes=('_load', '_trip'))
    logger.info(f"    Result: {loads_trips.shape[0]:,} rows x {loads_trips.shape[1]} cols")
    
    # ── Merge with delivery events (on load_id + trip_id) ──
    logger.info("  Merging with delivery events on 'load_id'...")
    logistics = pd.merge(
        loads_trips,
        deliveries_only[['load_id', 'trip_id', 'scheduled_datetime', 'actual_datetime',
                          'detention_minutes', 'on_time_flag', 'facility_id']],
        on=['load_id', 'trip_id'],
        how='left'
    )
    logger.info(f"    Result: {logistics.shape[0]:,} rows x {logistics.shape[1]} cols")
    
    # ── Calculate delivery delay ──
    if 'scheduled_datetime' in logistics.columns and 'actual_datetime' in logistics.columns:
        logistics['delivery_delay_minutes'] = (
            (logistics['actual_datetime'] - logistics['scheduled_datetime']).dt.total_seconds() / 60
        )
        logger.info(f"    Computed delivery_delay_minutes:")
        logger.info(f"      Mean: {logistics['delivery_delay_minutes'].mean():.1f} min")
        logger.info(f"      Median: {logistics['delivery_delay_minutes'].median():.1f} min")
        logger.info(f"      Max: {logistics['delivery_delay_minutes'].max():.1f} min")
    
    # ── On-time statistics ──
    if 'on_time_flag' in logistics.columns:
        on_time_pct = logistics['on_time_flag'].mean() * 100
        logger.info(f"    On-time delivery rate: {on_time_pct:.1f}%")
    
    # Standardize column names
    logistics = standardize_column_names(logistics)
    
    # Drop duplicate or unnecessary columns
    drop_cols = [c for c in logistics.columns if c.endswith('_load') and c.replace('_load', '_trip') in logistics.columns]
    if drop_cols:
        logger.info(f"    Dropping duplicate join columns: {drop_cols}")
        logistics = logistics.drop(columns=drop_cols)
    
    logger.info(f"\n  Final logistics shape: {logistics.shape[0]:,} rows x {logistics.shape[1]} cols")
    logger.info(f"  Columns: {list(logistics.columns)}")
    
    # Save
    output_path = OUTPUT_DIR / 'logistics_merged_cleaned.csv'
    logistics.to_csv(output_path, index=False)
    size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info(f"  SAVED: {output_path} ({size_mb:.1f} MB)")
    
    return logistics


# =============================================================================
# SECTION 6: GENERATE CLEANING SUMMARY REPORT
# =============================================================================
def generate_cleaning_report(dataco: pd.DataFrame, supply_chain: pd.DataFrame,
                             grocery: pd.DataFrame, retail: pd.DataFrame,
                             logistics: pd.DataFrame) -> None:
    """Generate a comprehensive cleaning summary report."""
    section_header("6. CLEANING SUMMARY REPORT")
    
    datasets = {
        'dataco_cleaned.csv': dataco,
        'supply_chain_cleaned.csv': supply_chain,
        'grocery_inventory_cleaned.csv': grocery,
        'retail_inventory_cleaned.csv': retail,
        'logistics_merged_cleaned.csv': logistics,
    }
    
    logger.info(f"  {'Dataset':<40s} {'Rows':>10s} {'Cols':>6s} {'Missing':>10s} {'Dupes':>8s}")
    logger.info(f"  {'-'*40} {'-'*10} {'-'*6} {'-'*10} {'-'*8}")
    
    for name, df in datasets.items():
        missing = df.isnull().sum().sum()
        dupes = df.duplicated().sum()
        logger.info(f"  {name:<40s} {df.shape[0]:>10,} {df.shape[1]:>6} {missing:>10,} {dupes:>8,}")
    
    # DataCo specific summary
    logger.info("\n  PRIMARY DATASET (dataco_cleaned.csv) DETAILS:")
    logger.info(f"    Rows: {dataco.shape[0]:,}")
    logger.info(f"    Columns: {dataco.shape[1]}")
    logger.info(f"    Missing values: {dataco.isnull().sum().sum()}")
    logger.info(f"    Memory: {dataco.memory_usage(deep=True).sum() / (1024**2):.1f} MB")
    
    if 'late_delivery_risk' in dataco.columns:
        target_dist = dataco['late_delivery_risk'].value_counts()
        logger.info(f"    Target distribution:")
        for val, cnt in target_dist.items():
            logger.info(f"      {val}: {cnt:,} ({cnt/len(dataco)*100:.1f}%)")
    
    # Columns marked as leakage
    leakage_cols = ['delivery_status', 'days_for_shipping_real', 'shipping_date_dateorders']
    found_leakage = [c for c in leakage_cols if c in dataco.columns]
    logger.info(f"\n    Leakage columns retained (for analysis only):")
    for col in found_leakage:
        logger.info(f"      - {col}")
    
    # Outlier flag columns
    outlier_flags = [c for c in dataco.columns if c.endswith('_outlier')]
    logger.info(f"\n    Outlier flag columns added: {len(outlier_flags)}")
    for col in outlier_flags:
        n_flagged = dataco[col].sum()
        logger.info(f"      {col}: {n_flagged:,} flagged")
    
    logger.info("\n" + "=" * 80)
    logger.info("  PHASE 2 COMPLETE - ALL DATASETS CLEANED")
    logger.info("=" * 80)
    logger.info(f"\n  Clean files saved to: {OUTPUT_DIR}")
    logger.info(f"  Cleaning logs saved to: {REPORT_DIR}")
    logger.info("\n  NEXT: Phase 3 - Feature Engineering")
    logger.info("  STATUS: AWAITING REVIEW")


# =============================================================================
# MAIN EXECUTION
# =============================================================================
if __name__ == '__main__':
    logger.info("=" * 80)
    logger.info("  SYNCHAIN - PHASE 2: DATA CLEANING PIPELINE")
    logger.info("=" * 80)
    
    # Clean all datasets
    dataco_clean = clean_dataco()
    supply_chain_clean = clean_supply_chain()
    grocery_clean = clean_grocery_inventory()
    retail_clean = clean_retail_inventory()
    logistics_clean = clean_logistics()
    
    # Generate summary report
    generate_cleaning_report(
        dataco_clean,
        supply_chain_clean,
        grocery_clean,
        retail_clean,
        logistics_clean
    )
    
    logger.info("\n[PHASE 2 COMPLETE]")
