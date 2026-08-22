import os
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any

DATASETS_DIR = Path(r"d:\SynChain-AI-Supply-Chain-Intelligence-System\datasets")
PROCESSED_DIR = Path(r"d:\SynChain-AI-Supply-Chain-Intelligence-System\data\processed")
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

def standardize_col_name(col: str) -> str:
    new_name = col.lower().strip()
    new_name = new_name.replace(' ', '_')
    new_name = new_name.replace('(', '').replace(')', '')
    new_name = new_name.replace('/', '_')
    new_name = new_name.replace('-', '_')
    new_name = new_name.replace('.', '_')
    while '__' in new_name:
        new_name = new_name.replace('__', '_')
    return new_name.strip('_')

def run_ingestion_pipeline() -> Dict[str, Any]:
    report = {"status": "success", "details": {}}
    
    # 1. Ingest DataCo Dataset
    dataco_path = DATASETS_DIR / "DataCoSupplyChainDataset.csv"
    if dataco_path.exists():
        df = pd.read_csv(dataco_path, encoding='latin-1')
        initial_shape = df.shape
        
        # Drops: PII and sparse
        pii = ['Customer Email', 'Customer Password', 'Customer Street', 'Customer Fname', 'Customer Lname']
        sparse = ['Product Description', 'Order Zipcode']
        drops = [c for c in pii + sparse if c in df.columns]
        df.drop(columns=drops, inplace=True)
        
        # Impute Zipcode
        if 'Customer Zipcode' in df.columns:
            df['Customer Zipcode'] = df['Customer Zipcode'].fillna(df['Customer Zipcode'].mode().iloc[0])
            df['Customer Zipcode'] = df['Customer Zipcode'].astype(int).astype(str)
            
        # Standardize
        df.rename(columns={c: standardize_col_name(c) for c in df.columns}, inplace=True)
        
        # Save cleaned dataco
        df.to_csv(PROCESSED_DIR / "dataco_cleaned.csv", index=False)
        report["details"]["dataco"] = {"initial_shape": initial_shape, "cleaned_shape": df.shape}

    # 2. Ingest supply chain data
    sc_path = DATASETS_DIR / "supply_chain_data.csv"
    if sc_path.exists():
        df_sc = pd.read_csv(sc_path)
        df_sc.rename(columns={c: standardize_col_name(c) for c in df_sc.columns}, inplace=True)
        df_sc.to_csv(PROCESSED_DIR / "supply_chain_cleaned.csv", index=False)
        report["details"]["supply_chain"] = {"shape": df_sc.shape}

    # 3. Ingest retail inventory
    retail_path = DATASETS_DIR / "retail_store_inventory.csv"
    if retail_path.exists():
        df_rt = pd.read_csv(retail_path)
        df_rt.rename(columns={c: standardize_col_name(c) for c in df_rt.columns}, inplace=True)
        df_rt.to_csv(PROCESSED_DIR / "retail_inventory_cleaned.csv", index=False)
        report["details"]["retail_inventory"] = {"shape": df_rt.shape}

    return report
