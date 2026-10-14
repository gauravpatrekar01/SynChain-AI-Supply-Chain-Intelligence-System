"""
Data loading and validation utilities for time-series forecasting.
Handles deduplication, missing timestamps, frequency detection, and dataset extraction.
"""

from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import pandas as pd
import numpy as np


def validate_and_clean_time_series(
    data: Union[List[Dict[str, Any]], pd.DataFrame],
    date_col: str = "date",
    value_col: str = "demand",
    min_points: int = 3,
    aggregation: str = "sum"
) -> Tuple[pd.DataFrame, str]:
    """
    Validates, deduplicates, and cleans input time series data.

    Parameters
    ----------
    data : List[Dict[str, Any]] or pd.DataFrame
        Historical time-series observations.
    date_col : str
        Name of date column or accepted alias ('date', 'ds', 'timestamp').
    value_col : str
        Name of target column or accepted alias ('demand', 'y', 'units_sold', 'actualDemandUnits').
    min_points : int
        Minimum required points for meaningful forecasting.
    aggregation : str
        How to aggregate duplicate timestamps: 'sum' or 'mean'.

    Returns
    -------
    Tuple[pd.DataFrame, str]
        Cleaned DataFrame with columns ['date', 'demand'] sorted ascending,
        and inferred frequency string ('D', 'W', 'M', or 'irregular').
    """
    if isinstance(data, list):
        if len(data) == 0:
            raise ValueError("Input data cannot be empty.")
        df = pd.DataFrame(data)
    elif isinstance(data, pd.DataFrame):
        if data.empty:
            raise ValueError("Input data cannot be empty.")
        df = data.copy()
    else:
        raise TypeError(f"Expected list of dicts or DataFrame, got {type(data)}.")

    # Locate date column using aliases
    date_candidates = [date_col, "date", "ds", "timestamp", "Date"]
    resolved_date = next((col for col in date_candidates if col in df.columns), None)
    if not resolved_date:
        raise ValueError(
            f"Missing date column. Looked for {date_candidates}, found columns: {list(df.columns)}"
        )

    # Locate value column using aliases
    value_candidates = [
        value_col, "demand", "y", "units_sold", "units_ordered",
        "actualDemandUnits", "predictedDemandUnits", "value", "price"
    ]
    resolved_value = next((col for col in value_candidates if col in df.columns), None)
    if not resolved_value:
        raise ValueError(
            f"Missing target value column. Looked for {value_candidates}, found columns: {list(df.columns)}"
        )

    # Standardize column names
    df = df[[resolved_date, resolved_value]].rename(
        columns={resolved_date: "date", resolved_value: "demand"}
    )

    # Convert and validate dates
    try:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
    except Exception as e:
        raise ValueError(f"Failed to parse dates in time series: {e}")

    # Remove rows with invalid dates
    invalid_dates_count = int(df["date"].isna().sum())
    if invalid_dates_count > 0:
        df = df.dropna(subset=["date"])

    # Convert and validate demand values
    df["demand"] = pd.to_numeric(df["demand"], errors="coerce")
    invalid_demands_count = int(df["demand"].isna().sum())
    if invalid_demands_count > 0:
        df = df.dropna(subset=["demand"])

    if len(df) == 0:
        raise ValueError("No valid date/demand records remain after cleaning.")

    # Deduplicate timestamps
    if df["date"].duplicated().any():
        if aggregation == "mean":
            df = df.groupby("date", as_index=False)["demand"].mean()
        else:
            df = df.groupby("date", as_index=False)["demand"].sum()

    # Sort chronologically
    df = df.sort_values("date").reset_index(drop=True)

    if len(df) < min_points:
        raise ValueError(
            f"Insufficient historical data: found {len(df)} point(s), minimum required is {min_points}."
        )

    # Infer frequency from deltas
    deltas = df["date"].diff().dropna()
    if len(deltas) > 0:
        median_delta_days = deltas.dt.total_seconds().median() / 86400.0
        if 0.8 <= median_delta_days <= 1.2:
            inferred_freq = "D"
        elif 6.0 <= median_delta_days <= 8.0:
            inferred_freq = "W"
        elif 27.0 <= median_delta_days <= 32.0:
            inferred_freq = "M"
        else:
            inferred_freq = "irregular"
    else:
        inferred_freq = "D"

    return df, inferred_freq


def load_retail_inventory_series(
    csv_path: Union[str, Path] = "data/processed/retail_inventory_cleaned.csv",
    store_id: str = "S001",
    product_id: str = "P0001",
    target_col: str = "units_sold"
) -> pd.DataFrame:
    """
    Loads an isolated store-product time series from the retail inventory dataset.

    Parameters
    ----------
    csv_path : str or Path
        Path to the retail inventory CSV file.
    store_id : str
        Store identifier (e.g., 'S001').
    product_id : str
        Product identifier (e.g., 'P0001').
    target_col : str
        Column to extract ('units_sold', 'units_ordered', 'inventory_level').

    Returns
    -------
    pd.DataFrame
        Cleaned time series DataFrame with columns ['date', 'demand'].
    """
    path = Path(csv_path)
    if not path.is_file():
        raise FileNotFoundError(f"Retail dataset not found at {csv_path}")

    # Read necessary columns
    df = pd.read_csv(
        path,
        usecols=["date", "store_id", "product_id", target_col]
    )

    filtered = df[(df["store_id"] == store_id) & (df["product_id"] == product_id)]
    if filtered.empty:
        raise ValueError(f"No records found for store '{store_id}' and product '{product_id}'.")

    cleaned_df, _ = validate_and_clean_time_series(
        filtered,
        date_col="date",
        value_col=target_col
    )
    return cleaned_df
