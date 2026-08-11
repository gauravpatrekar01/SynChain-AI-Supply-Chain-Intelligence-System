"""
=============================================================================
SYNCHAIN - PHASE 1: COMPREHENSIVE DATASET INSPECTION & EXPLORATORY DATA ANALYSIS
=============================================================================

This script performs a thorough analysis of all supply-chain-relevant datasets
to establish the data foundation for the SynChain AI system.

Output:
  - Console report with statistics
  - Visualization PNGs saved to outputs/phase1_eda/

Author: SynChain AI Team
Phase: 1 of 20
"""

import sys
import os
import warnings
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns

warnings.filterwarnings('ignore')
sys.stdout.reconfigure(encoding='utf-8')

# ── Configuration ──────────────────────────────────────────────────────────────
DATA_DIR = Path(r"d:\SynChain-AI-Supply-Chain-Intelligence-System\datasets")
OUTPUT_DIR = Path(r"d:\SynChain-AI-Supply-Chain-Intelligence-System\outputs\phase1_eda")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Style
plt.style.use('seaborn-v0_8-darkgrid')
sns.set_palette("husl")
plt.rcParams.update({
    'figure.figsize': (14, 8),
    'font.size': 11,
    'axes.titlesize': 14,
    'figure.dpi': 100,
})


# ── Utility Functions ─────────────────────────────────────────────────────────
def section_header(title: str) -> None:
    """Print a formatted section header."""
    print(f"\n{'=' * 80}")
    print(f"  {title}")
    print(f"{'=' * 80}\n")


def sub_header(title: str) -> None:
    """Print a formatted sub-header."""
    print(f"\n--- {title} ---\n")


def safe_save_fig(fig: plt.Figure, name: str) -> None:
    """Save figure to output directory."""
    path = OUTPUT_DIR / f"{name}.png"
    fig.savefig(path, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print(f"  [SAVED] {path}")


def analyze_dataset_basic(df: pd.DataFrame, name: str) -> dict:
    """Perform basic dataset analysis and return summary dict."""
    info = {
        'name': name,
        'rows': len(df),
        'columns': len(df.columns),
        'memory_mb': df.memory_usage(deep=True).sum() / (1024 * 1024),
        'duplicates': df.duplicated().sum(),
        'total_missing': df.isnull().sum().sum(),
        'missing_pct': (df.isnull().sum().sum() / (len(df) * len(df.columns))) * 100,
    }
    return info


# =============================================================================
# SECTION 1: PRIMARY DATASET - DataCoSupplyChain
# =============================================================================
section_header("1. PRIMARY DATASET: DataCoSupplyChainDataset.csv")

print("Loading DataCoSupplyChain dataset (96 MB)...")
dataco = pd.read_csv(DATA_DIR / "DataCoSupplyChainDataset.csv", encoding='latin-1')
print(f"Loaded successfully.\n")

# 1.1 Shape
sub_header("1.1 Dataset Shape")
print(f"  Rows:    {dataco.shape[0]:,}")
print(f"  Columns: {dataco.shape[1]}")
print(f"  Memory:  {dataco.memory_usage(deep=True).sum() / (1024**2):.1f} MB")

# 1.2 All Columns
sub_header("1.2 All Columns")
for i, col in enumerate(dataco.columns, 1):
    print(f"  {i:3d}. {col}")

# 1.3 Data Types
sub_header("1.3 Data Types")
dtype_counts = dataco.dtypes.value_counts()
print(f"  Data type distribution:")
for dtype, count in dtype_counts.items():
    cols = list(dataco.select_dtypes(include=[dtype]).columns)
    print(f"    {str(dtype):15s}: {count:3d} columns")
    for c in cols[:5]:
        print(f"      - {c}")
    if len(cols) > 5:
        print(f"      ... and {len(cols) - 5} more")

# 1.4 Missing Values
sub_header("1.4 Missing Values Analysis")
missing = dataco.isnull().sum()
missing_pct = (missing / len(dataco) * 100).round(2)
missing_df = pd.DataFrame({
    'Column': missing.index,
    'Missing Count': missing.values,
    'Missing %': missing_pct.values
}).sort_values('Missing Count', ascending=False)

has_missing = missing_df[missing_df['Missing Count'] > 0]
if len(has_missing) > 0:
    print(f"  Columns with missing values: {len(has_missing)}")
    print(f"  Total missing cells: {dataco.isnull().sum().sum():,}")
    print()
    print(has_missing.to_string(index=False))
else:
    print("  No missing values found!")

# 1.5 Duplicate Records
sub_header("1.5 Duplicate Records")
dupes = dataco.duplicated().sum()
print(f"  Exact duplicate rows: {dupes:,} ({dupes/len(dataco)*100:.2f}%)")

# Check for near-duplicates by key columns
if 'Order Id' in dataco.columns and 'Order Item Id' in dataco.columns:
    key_dupes = dataco.duplicated(subset=['Order Id', 'Order Item Id']).sum()
    print(f"  Duplicate (Order Id, Order Item Id) pairs: {key_dupes:,}")

# 1.6 Unique Values
sub_header("1.6 Unique Values per Column")
for col in dataco.columns:
    n_unique = dataco[col].nunique()
    print(f"  {col:45s}: {n_unique:>8,} unique values")

# 1.7 Numerical Statistics
sub_header("1.7 Numerical Variable Statistics")
numerical_cols = dataco.select_dtypes(include=[np.number]).columns.tolist()
print(f"  Numerical columns: {len(numerical_cols)}")
print()
num_stats = dataco[numerical_cols].describe().T
num_stats['skewness'] = dataco[numerical_cols].skew()
num_stats['kurtosis'] = dataco[numerical_cols].kurtosis()
print(num_stats.to_string())

# 1.8 Categorical Analysis
sub_header("1.8 Categorical Variable Analysis")
categorical_cols = dataco.select_dtypes(include=['object']).columns.tolist()
print(f"  Categorical columns: {len(categorical_cols)}")
for col in categorical_cols:
    print(f"\n  >> {col}")
    vc = dataco[col].value_counts()
    print(f"     Unique values: {len(vc)}")
    print(f"     Top 5:")
    for val, cnt in vc.head(5).items():
        print(f"       {str(val)[:50]:50s} : {cnt:>8,} ({cnt/len(dataco)*100:.1f}%)")

# 1.9 Date Analysis
sub_header("1.9 Date Field Analysis")
date_candidates = ['order date (DateOrders)', 'shipping date (DateOrders)']
for col in date_candidates:
    if col in dataco.columns:
        try:
            dates = pd.to_datetime(dataco[col], errors='coerce')
            valid = dates.notna().sum()
            print(f"  {col}:")
            print(f"    Valid dates: {valid:,} / {len(dataco):,}")
            print(f"    Min date:    {dates.min()}")
            print(f"    Max date:    {dates.max()}")
            print(f"    Date range:  {(dates.max() - dates.min()).days} days")
            print()
        except Exception as e:
            print(f"  {col}: Could not parse - {e}")

# 1.10 Outlier Analysis (IQR method)
sub_header("1.10 Outlier Analysis (IQR Method)")
key_numerical = ['Sales', 'Order Item Quantity', 'Benefit per order',
                 'Order Item Discount', 'Order Item Profit Ratio',
                 'Days for shipping (real)', 'Days for shipment (scheduled)',
                 'Order Item Product Price', 'Order Item Total']
key_numerical = [c for c in key_numerical if c in dataco.columns]

outlier_summary = []
for col in key_numerical:
    Q1 = dataco[col].quantile(0.25)
    Q3 = dataco[col].quantile(0.75)
    IQR = Q3 - Q1
    lower = Q1 - 1.5 * IQR
    upper = Q3 + 1.5 * IQR
    n_outliers = ((dataco[col] < lower) | (dataco[col] > upper)).sum()
    outlier_summary.append({
        'Column': col,
        'Q1': round(Q1, 2),
        'Q3': round(Q3, 2),
        'IQR': round(IQR, 2),
        'Lower Bound': round(lower, 2),
        'Upper Bound': round(upper, 2),
        'Outliers': n_outliers,
        'Outlier %': round(n_outliers / len(dataco) * 100, 2)
    })

outlier_df = pd.DataFrame(outlier_summary)
print(outlier_df.to_string(index=False))

# 1.11 Correlation Analysis
sub_header("1.11 Correlation Analysis (Top Correlations)")
corr_cols = [c for c in ['Sales', 'Order Item Quantity', 'Benefit per order',
                          'Order Item Discount', 'Order Item Profit Ratio',
                          'Order Item Product Price', 'Order Item Total',
                          'Days for shipping (real)', 'Days for shipment (scheduled)',
                          'Late_delivery_risk', 'Sales per customer',
                          'Order Profit Per Order', 'Order Item Discount Rate']
             if c in dataco.columns]

if len(corr_cols) > 1:
    corr_matrix = dataco[corr_cols].corr()
    
    # Get top absolute correlations
    corr_pairs = []
    for i in range(len(corr_cols)):
        for j in range(i + 1, len(corr_cols)):
            corr_pairs.append({
                'Feature 1': corr_cols[i],
                'Feature 2': corr_cols[j],
                'Correlation': round(corr_matrix.iloc[i, j], 4)
            })
    corr_pairs_df = pd.DataFrame(corr_pairs).sort_values('Correlation', key=abs, ascending=False)
    print("  Top 15 Correlations:")
    print(corr_pairs_df.head(15).to_string(index=False))

# 1.12 Supply Chain Relationships
sub_header("1.12 Supply Chain Relationships")
if 'Delivery Status' in dataco.columns:
    print("  Delivery Status Distribution:")
    ds = dataco['Delivery Status'].value_counts()
    for val, cnt in ds.items():
        print(f"    {val:30s}: {cnt:>8,} ({cnt/len(dataco)*100:.1f}%)")

if 'Late_delivery_risk' in dataco.columns:
    print(f"\n  Late Delivery Risk Distribution:")
    ldr = dataco['Late_delivery_risk'].value_counts()
    for val, cnt in ldr.items():
        print(f"    {val}: {cnt:>8,} ({cnt/len(dataco)*100:.1f}%)")

if 'Shipping Mode' in dataco.columns:
    print(f"\n  Shipping Mode Distribution:")
    sm = dataco['Shipping Mode'].value_counts()
    for val, cnt in sm.items():
        print(f"    {val:30s}: {cnt:>8,} ({cnt/len(dataco)*100:.1f}%)")

if 'Order Status' in dataco.columns:
    print(f"\n  Order Status Distribution:")
    os_dist = dataco['Order Status'].value_counts()
    for val, cnt in os_dist.items():
        print(f"    {val:30s}: {cnt:>8,} ({cnt/len(dataco)*100:.1f}%)")

if 'Customer Segment' in dataco.columns:
    print(f"\n  Customer Segment Distribution:")
    cs = dataco['Customer Segment'].value_counts()
    for val, cnt in cs.items():
        print(f"    {val:30s}: {cnt:>8,} ({cnt/len(dataco)*100:.1f}%)")

# 1.13 Target Variable Analysis
sub_header("1.13 Potential Target Variables")
print("""
  EXISTING TARGET VARIABLES FOUND:
  
  1. Late_delivery_risk (Binary: 0/1)
     - This is an EXISTING label in the dataset
     - Indicates whether shipping is late (1) or not (0)
     - Can serve as a baseline binary classification target
  
  2. Delivery Status (Categorical)
     - Multi-class: Advance shipping, Late delivery, Shipping canceled, Shipping on time
     - Could be used for multi-class risk classification
  
  POTENTIAL ENGINEERED TARGETS:
  
  3. Risk Score (0-100, Engineered)
     - Can be constructed from: shipping delay, order profit, discount rate, etc.
  
  4. Risk Class (Low/Medium/High/Critical, Engineered)
     - Derived from risk score thresholds
""")

# Check relationship between target candidates
if all(c in dataco.columns for c in ['Late_delivery_risk', 'Delivery Status']):
    print("  Cross-tabulation: Late_delivery_risk vs Delivery Status:")
    ct = pd.crosstab(dataco['Late_delivery_risk'], dataco['Delivery Status'], margins=True)
    print(ct.to_string())

# 1.14 Data Leakage Analysis
sub_header("1.14 Potential Data Leakage Analysis")
print("""
  LEAKAGE RISK ASSESSMENT:
  
  HIGH RISK - Must NOT be used as features for Late_delivery_risk prediction:
  
  1. 'Delivery Status' - Directly encodes the delivery outcome
     - 'Late delivery' is essentially the same as Late_delivery_risk=1
     - MUST be excluded from feature set
  
  2. 'Days for shipping (real)' - Actual shipping days
     - Known ONLY after shipment is complete
     - Contains future information relative to prediction time
     - The DIFFERENCE (real - scheduled) IS the delay
     - MUST be excluded or used very carefully
  
  3. 'shipping date (DateOrders)' - Actual shipping date
     - Known only after shipping occurs
     - MUST be excluded from pre-shipment prediction
  
  MODERATE RISK:
  
  4. 'Order Status' - May contain post-event information
     - Values like 'COMPLETE', 'CANCELED' are known only after the fact
     - Consider using only pre-event statuses
  
  5. 'Sales per customer' - Aggregated metric
     - If computed from ALL orders including current one, it leaks
     - Must be computed from PRIOR orders only
  
  SAFE TO USE:
  
  6. Shipping Mode, Customer Segment, Product info, Order quantities,
     scheduled shipping days, geographic features, prices, discounts
""")

# 1.15 Feature Recommendations
sub_header("1.15 Feature Engineering Recommendations")
print("""
  RECOMMENDED FEATURES (from DataCoSupplyChain):
  
  A. ORDER FEATURES (Safe):
     - Order Item Quantity
     - Order Item Product Price  
     - Order Item Discount / Discount Rate
     - Sales
     - Benefit per order / Order Profit Per Order
     - Order Item Profit Ratio
  
  B. SHIPPING FEATURES (Safe):
     - Days for shipment (scheduled) -- planned, not actual
     - Shipping Mode (encoded)
  
  C. PRODUCT FEATURES (Safe):
     - Category Name / Category Id
     - Product Price
     - Department Name
  
  D. CUSTOMER FEATURES (Safe):
     - Customer Segment (encoded)
     - Customer City / Country / Market / Region (geographic risk)
  
  E. TEMPORAL FEATURES (Can Engineer):
     - Order month, day of week, quarter
     - Season indicator
     - Holiday proximity
  
  F. GEOGRAPHIC FEATURES (Can Engineer):
     - Origin-Destination distance (from lat/long)
     - Market risk indicator
     - Region risk indicator
  
  FEATURES TO EXCLUDE:
     - Late_delivery_risk (TARGET)
     - Delivery Status (LEAKAGE)
     - Days for shipping (real) (LEAKAGE)
     - shipping date (DateOrders) (LEAKAGE - actual ship date)
     - Customer Email, Password, Street (PII, irrelevant)
     - Product Image (irrelevant)
     - Product Description (text - needs NLP if used)
""")


# =============================================================================
# SECTION 2: SECONDARY DATASETS ANALYSIS
# =============================================================================
section_header("2. SECONDARY DATASET: supply_chain_data.csv")

scd = pd.read_csv(DATA_DIR / "supply_chain_data.csv")
basic = analyze_dataset_basic(scd, "supply_chain_data")
print(f"  Shape: {basic['rows']:,} rows x {basic['columns']} columns")
print(f"  Memory: {basic['memory_mb']:.2f} MB")
print(f"  Duplicates: {basic['duplicates']}")
print(f"  Missing: {basic['total_missing']} ({basic['missing_pct']:.2f}%)")
print(f"\n  Columns: {list(scd.columns)}")
print(f"\n  Numerical stats:")
print(scd.describe().T.to_string())
print(f"\n  Categorical distributions:")
for col in scd.select_dtypes(include='object').columns:
    print(f"\n  >> {col}: {scd[col].nunique()} unique")
    print(f"     Top 3: {dict(scd[col].value_counts().head(3))}")


# ── Grocery Inventory ──
section_header("3. SECONDARY DATASET: Grocery_Inventory new v1.csv")

gi = pd.read_csv(DATA_DIR / "Grocery_Inventory new v1.csv")
basic = analyze_dataset_basic(gi, "Grocery_Inventory")
print(f"  Shape: {basic['rows']:,} rows x {basic['columns']} columns")
print(f"  Duplicates: {basic['duplicates']}")
print(f"  Missing: {basic['total_missing']} ({basic['missing_pct']:.2f}%)")
print(f"\n  Columns: {list(gi.columns)}")
print(f"\n  Numerical stats:")
print(gi.describe().T.to_string())
print(f"\n  Key supply-chain columns:")
for col in ['Status', 'Supplier_Name', 'Warehouse_Location', 'Catagory']:
    if col in gi.columns:
        print(f"\n  >> {col}: {gi[col].nunique()} unique values")
        print(f"     Distribution: {dict(gi[col].value_counts().head(5))}")


# ── Retail Store Inventory ──
section_header("4. SECONDARY DATASET: retail_store_inventory.csv")

rsi = pd.read_csv(DATA_DIR / "retail_store_inventory.csv")
basic = analyze_dataset_basic(rsi, "retail_store_inventory")
print(f"  Shape: {basic['rows']:,} rows x {basic['columns']} columns")
print(f"  Duplicates: {basic['duplicates']}")
print(f"  Missing: {basic['total_missing']} ({basic['missing_pct']:.2f}%)")
print(f"\n  Columns: {list(rsi.columns)}")
print(f"\n  Numerical stats:")
print(rsi.describe().T.to_string())
print(f"\n  Key columns:")
for col in ['Category', 'Region', 'Weather Condition', 'Holiday/Promotion', 'Seasonality']:
    if col in rsi.columns:
        print(f"\n  >> {col}: {rsi[col].nunique()} unique values")
        print(f"     Distribution: {dict(rsi[col].value_counts().head(5))}")


# ── Logistics Cluster ──
section_header("5. LOGISTICS CLUSTER: loads + trips + delivery_events")

loads = pd.read_csv(DATA_DIR / "loads.csv")
trips = pd.read_csv(DATA_DIR / "trips.csv")

# Sample delivery_events (22MB)
de = pd.read_csv(DATA_DIR / "delivery_events.csv", nrows=100000)

print(f"  loads.csv:           {loads.shape[0]:>8,} rows x {loads.shape[1]} cols")
print(f"  trips.csv:           {trips.shape[0]:>8,} rows x {trips.shape[1]} cols")
print(f"  delivery_events.csv: sampled 100,000 rows (full file ~22MB)")

sub_header("5.1 Loads Analysis")
print(f"  Columns: {list(loads.columns)}")
if 'load_status' in loads.columns:
    print(f"\n  Load Status Distribution:")
    for val, cnt in loads['load_status'].value_counts().items():
        print(f"    {val:20s}: {cnt:>6,}")
if 'load_type' in loads.columns:
    print(f"\n  Load Type Distribution:")
    for val, cnt in loads['load_type'].value_counts().items():
        print(f"    {val:20s}: {cnt:>6,}")

sub_header("5.2 Trips Analysis")
print(f"  Columns: {list(trips.columns)}")
if 'trip_status' in trips.columns:
    print(f"\n  Trip Status Distribution:")
    for val, cnt in trips['trip_status'].value_counts().items():
        print(f"    {val:20s}: {cnt:>6,}")
print(f"\n  Trip stats:")
print(trips.describe().T.to_string())

sub_header("5.3 Delivery Events (Sample)")
print(f"  Columns: {list(de.columns)}")
if 'event_type' in de.columns:
    print(f"\n  Event Type Distribution:")
    for val, cnt in de['event_type'].value_counts().items():
        print(f"    {val:20s}: {cnt:>6,}")
if 'on_time_flag' in de.columns:
    print(f"\n  On-Time Flag Distribution:")
    for val, cnt in de['on_time_flag'].value_counts().items():
        print(f"    {val}: {cnt:>6,} ({cnt/len(de)*100:.1f}%)")


# =============================================================================
# SECTION 6: VISUALIZATIONS
# =============================================================================
section_header("6. GENERATING VISUALIZATIONS")

# 6.1 Delivery Status Distribution
fig, axes = plt.subplots(1, 2, figsize=(16, 6))
if 'Delivery Status' in dataco.columns:
    ds_counts = dataco['Delivery Status'].value_counts()
    colors = ['#2ecc71', '#e74c3c', '#f39c12', '#3498db']
    ds_counts.plot(kind='bar', ax=axes[0], color=colors[:len(ds_counts)])
    axes[0].set_title('Delivery Status Distribution', fontweight='bold')
    axes[0].set_xlabel('Status')
    axes[0].set_ylabel('Count')
    axes[0].tick_params(axis='x', rotation=30)
    for i, (v, c) in enumerate(zip(ds_counts.values, ds_counts.index)):
        axes[0].text(i, v + len(dataco)*0.005, f'{v:,}\n({v/len(dataco)*100:.1f}%)',
                     ha='center', fontsize=9)

if 'Late_delivery_risk' in dataco.columns:
    ldr_counts = dataco['Late_delivery_risk'].value_counts()
    ldr_counts.plot(kind='pie', ax=axes[1], autopct='%1.1f%%',
                    colors=['#2ecc71', '#e74c3c'], labels=['No Risk (0)', 'Late Risk (1)'])
    axes[1].set_title('Late Delivery Risk Distribution', fontweight='bold')
    axes[1].set_ylabel('')

fig.suptitle('SynChain EDA: Delivery Risk Analysis', fontsize=16, fontweight='bold')
plt.tight_layout()
safe_save_fig(fig, 'delivery_status_distribution')

# 6.2 Numerical Distributions
fig, axes = plt.subplots(2, 3, figsize=(18, 10))
plot_cols = ['Sales', 'Order Item Quantity', 'Benefit per order',
             'Order Item Product Price', 'Days for shipping (real)',
             'Days for shipment (scheduled)']
plot_cols = [c for c in plot_cols if c in dataco.columns]

for idx, col in enumerate(plot_cols[:6]):
    ax = axes[idx // 3, idx % 3]
    dataco[col].hist(bins=50, ax=ax, color='#3498db', alpha=0.7, edgecolor='white')
    ax.set_title(col, fontweight='bold')
    ax.set_xlabel(col)
    ax.set_ylabel('Frequency')
    # Add median line
    med = dataco[col].median()
    ax.axvline(med, color='red', linestyle='--', label=f'Median: {med:.1f}')
    ax.legend(fontsize=8)

fig.suptitle('SynChain EDA: Numerical Feature Distributions', fontsize=16, fontweight='bold')
plt.tight_layout()
safe_save_fig(fig, 'numerical_distributions')

# 6.3 Correlation Heatmap
if len(corr_cols) > 1:
    fig, ax = plt.subplots(figsize=(14, 10))
    corr_matrix = dataco[corr_cols].corr()
    mask = np.triu(np.ones_like(corr_matrix, dtype=bool))
    sns.heatmap(corr_matrix, mask=mask, annot=True, fmt='.2f', cmap='RdBu_r',
                center=0, square=True, ax=ax, linewidths=0.5,
                cbar_kws={'shrink': 0.8})
    ax.set_title('Feature Correlation Heatmap', fontsize=16, fontweight='bold')
    plt.tight_layout()
    safe_save_fig(fig, 'correlation_heatmap')

# 6.4 Shipping Mode vs Late Delivery Risk
if all(c in dataco.columns for c in ['Shipping Mode', 'Late_delivery_risk']):
    fig, ax = plt.subplots(figsize=(10, 6))
    ct = pd.crosstab(dataco['Shipping Mode'], dataco['Late_delivery_risk'], normalize='index') * 100
    ct.columns = ['On-Time', 'Late Risk']
    ct.plot(kind='bar', stacked=True, ax=ax, color=['#2ecc71', '#e74c3c'])
    ax.set_title('Late Delivery Risk by Shipping Mode', fontweight='bold', fontsize=14)
    ax.set_xlabel('Shipping Mode')
    ax.set_ylabel('Percentage (%)')
    ax.legend(title='Delivery')
    ax.tick_params(axis='x', rotation=30)
    plt.tight_layout()
    safe_save_fig(fig, 'shipping_mode_vs_risk')

# 6.5 Customer Segment vs Late Delivery Risk
if all(c in dataco.columns for c in ['Customer Segment', 'Late_delivery_risk']):
    fig, ax = plt.subplots(figsize=(10, 6))
    ct = pd.crosstab(dataco['Customer Segment'], dataco['Late_delivery_risk'], normalize='index') * 100
    ct.columns = ['On-Time', 'Late Risk']
    ct.plot(kind='bar', stacked=True, ax=ax, color=['#2ecc71', '#e74c3c'])
    ax.set_title('Late Delivery Risk by Customer Segment', fontweight='bold', fontsize=14)
    ax.set_xlabel('Customer Segment')
    ax.set_ylabel('Percentage (%)')
    ax.legend(title='Delivery')
    ax.tick_params(axis='x', rotation=0)
    plt.tight_layout()
    safe_save_fig(fig, 'segment_vs_risk')

# 6.6 Market Region Distribution
if 'Market' in dataco.columns:
    fig, axes = plt.subplots(1, 2, figsize=(16, 6))
    market_counts = dataco['Market'].value_counts()
    market_counts.plot(kind='bar', ax=axes[0], color=sns.color_palette("husl", len(market_counts)))
    axes[0].set_title('Orders by Market Region', fontweight='bold')
    axes[0].set_xlabel('Market')
    axes[0].set_ylabel('Number of Orders')
    axes[0].tick_params(axis='x', rotation=30)

    if 'Late_delivery_risk' in dataco.columns:
        ct = pd.crosstab(dataco['Market'], dataco['Late_delivery_risk'], normalize='index') * 100
        ct.columns = ['On-Time', 'Late Risk']
        ct['Late Risk'].plot(kind='bar', ax=axes[1], color='#e74c3c')
        axes[1].set_title('Late Delivery Risk % by Market', fontweight='bold')
        axes[1].set_xlabel('Market')
        axes[1].set_ylabel('Late Risk %')
        axes[1].tick_params(axis='x', rotation=30)
    
    plt.tight_layout()
    safe_save_fig(fig, 'market_distribution')

# 6.7 Order Status Distribution
if 'Order Status' in dataco.columns:
    fig, ax = plt.subplots(figsize=(12, 6))
    os_counts = dataco['Order Status'].value_counts()
    bars = os_counts.plot(kind='barh', ax=ax, color=sns.color_palette("viridis", len(os_counts)))
    ax.set_title('Order Status Distribution', fontweight='bold', fontsize=14)
    ax.set_xlabel('Count')
    ax.set_ylabel('Order Status')
    for i, v in enumerate(os_counts.values):
        ax.text(v + len(dataco)*0.005, i, f'{v:,}', va='center')
    plt.tight_layout()
    safe_save_fig(fig, 'order_status_distribution')

# 6.8 Sales Distribution by Category (Top 15)
if all(c in dataco.columns for c in ['Category Name', 'Sales']):
    fig, ax = plt.subplots(figsize=(14, 8))
    cat_sales = dataco.groupby('Category Name')['Sales'].agg(['sum', 'mean', 'count']).sort_values('sum', ascending=True)
    cat_sales.tail(15)['sum'].plot(kind='barh', ax=ax, color='#3498db')
    ax.set_title('Top 15 Product Categories by Total Sales', fontweight='bold', fontsize=14)
    ax.set_xlabel('Total Sales ($)')
    ax.set_ylabel('Category')
    plt.tight_layout()
    safe_save_fig(fig, 'category_sales')

# 6.9 Boxplots for key features
fig, axes = plt.subplots(1, 3, figsize=(18, 6))
box_cols = ['Sales', 'Order Item Quantity', 'Benefit per order']
box_cols = [c for c in box_cols if c in dataco.columns]
for idx, col in enumerate(box_cols[:3]):
    dataco[col].plot(kind='box', ax=axes[idx])
    axes[idx].set_title(f'{col} Distribution', fontweight='bold')
fig.suptitle('SynChain EDA: Feature Boxplots (Outlier Detection)', fontsize=16, fontweight='bold')
plt.tight_layout()
safe_save_fig(fig, 'boxplots')

# 6.10 Shipping Delay Analysis
if all(c in dataco.columns for c in ['Days for shipping (real)', 'Days for shipment (scheduled)']):
    dataco['shipping_delay'] = dataco['Days for shipping (real)'] - dataco['Days for shipment (scheduled)']
    
    fig, axes = plt.subplots(1, 2, figsize=(16, 6))
    
    dataco['shipping_delay'].hist(bins=50, ax=axes[0], color='#e74c3c', alpha=0.7, edgecolor='white')
    axes[0].set_title('Shipping Delay Distribution (Real - Scheduled)', fontweight='bold')
    axes[0].set_xlabel('Delay (days)')
    axes[0].set_ylabel('Frequency')
    axes[0].axvline(0, color='green', linewidth=2, linestyle='--', label='On-time')
    axes[0].legend()
    
    delay_by_mode = dataco.groupby('Shipping Mode')['shipping_delay'].mean().sort_values()
    delay_by_mode.plot(kind='barh', ax=axes[1], color=['#2ecc71' if x < 0 else '#e74c3c' for x in delay_by_mode])
    axes[1].set_title('Average Shipping Delay by Mode', fontweight='bold')
    axes[1].set_xlabel('Avg Delay (days)')
    axes[1].axvline(0, color='black', linewidth=1, linestyle='-')
    
    plt.tight_layout()
    safe_save_fig(fig, 'shipping_delay_analysis')
    
    # Clean up temp column
    dataco.drop(columns=['shipping_delay'], inplace=True)

# 6.11 Retail Store Inventory Visualization
fig, axes = plt.subplots(1, 2, figsize=(16, 6))
if 'Weather Condition' in rsi.columns:
    wc = rsi['Weather Condition'].value_counts()
    wc.plot(kind='bar', ax=axes[0], color=sns.color_palette("coolwarm", len(wc)))
    axes[0].set_title('Retail Inventory: Weather Conditions', fontweight='bold')
    axes[0].tick_params(axis='x', rotation=30)

if 'Category' in rsi.columns and 'Units Sold' in rsi.columns:
    cat_sales_rsi = rsi.groupby('Category')['Units Sold'].mean().sort_values(ascending=True)
    cat_sales_rsi.plot(kind='barh', ax=axes[1], color='#9b59b6')
    axes[1].set_title('Retail: Avg Units Sold by Category', fontweight='bold')

plt.tight_layout()
safe_save_fig(fig, 'retail_inventory_analysis')


# =============================================================================
# SECTION 7: DATASET SELECTION RECOMMENDATION
# =============================================================================
section_header("7. DATASET SELECTION & INTEGRATION STRATEGY")

print("""
  DATASET SELECTION FOR SYNCHAIN:
  
  PRIMARY DATASET (Core ML Pipeline):
  ====================================
  DataCoSupplyChainDataset.csv
    - Rows: ~180,000+
    - Has existing risk label: Late_delivery_risk
    - Has delivery status: Advance/Late/Canceled/On-time  
    - Rich features: orders, products, customers, shipping, geography
    - Date fields for temporal analysis
    - Suitable for: Risk Prediction, SHAP, Recommendations, Simulation
  
  SUPPLEMENTARY DATASETS:
  ====================================
  
  1. retail_store_inventory.csv (for Inventory Intelligence)
     - Has: Inventory Level, Units Sold, Demand Forecast, Weather
     - Use for: Demand forecasting, inventory risk, weather analysis
  
  2. supply_chain_data.csv (for Supplier Intelligence)
     - Has: Supplier name, Lead times, Defect rates, Costs
     - Use for: Supplier scoring, manufacturing risk
  
  3. Grocery_Inventory new v1.csv (for Inventory Features)
     - Has: Stock quantities, Reorder levels, Turnover rates
     - Use for: Inventory intelligence, reorder recommendations
  
  4. Logistics Cluster (loads + trips + delivery_events)
     - Has: Trip performance, delivery on-time status, fuel data
     - Use for: Transportation risk, route optimization
  
  NOT SUITABLE FOR CORE ML:
  ====================================
  - car_purchasing.csv - Not supply chain related
  - sales data file.csv - Advertising spend, not supply chain
  - Chocolate Sales.csv - Too small, limited features
  - tokenized_access_logs.csv - Web access logs, not supply chain
  - BigBasket Products.csv - Product catalog only
  - Amazon Sale Report.csv - Sales only, limited risk features
  - ML-Dataset.csv - Generic order data, limited features
""")


# =============================================================================
# SECTION 8: PHASE 1 CONCLUSION
# =============================================================================
section_header("8. PHASE 1 CONCLUSION & NEXT STEPS")

print("""
  PHASE 1 FINDINGS SUMMARY:
  ==========================
  
  1. DATA AVAILABILITY: 34 files covering orders, deliveries, suppliers,
     inventory, logistics, and retail operations.
  
  2. PRIMARY TARGET: Late_delivery_risk (binary 0/1) exists in DataCo dataset.
     We will ALSO engineer a multi-class risk score (Low/Medium/High/Critical).
  
  3. DATA QUALITY:
     - DataCo: Several columns with missing values (needs Phase 2 cleaning)
     - Some columns have PII that must be removed
     - Outliers present in Sales, Quantity, and financial columns
  
  4. LEAKAGE RISKS IDENTIFIED:
     - 'Delivery Status' MUST NOT be used as a feature
     - 'Days for shipping (real)' is post-event knowledge
     - 'Order Status' contains post-event information
  
  5. FEATURE POTENTIAL: Rich feature space with order, product, customer,
     geographic, and temporal dimensions.
  
  6. INTEGRATION OPPORTUNITY: Multiple datasets can be combined for a
     comprehensive supply-chain intelligence system.
  
  NEXT STEP: PHASE 2 - Data Cleaning
  ===================================
  - Handle missing values
  - Remove duplicates
  - Fix data types
  - Remove PII columns
  - Handle outliers
  - Prepare clean dataset for feature engineering
  
  STATUS: PHASE 1 COMPLETE - AWAITING REVIEW
""")

print(f"\nAll visualizations saved to: {OUTPUT_DIR}")
print(f"Total visualizations generated: {len(list(OUTPUT_DIR.glob('*.png')))}")
print("\n[PHASE 1 COMPLETE]")
