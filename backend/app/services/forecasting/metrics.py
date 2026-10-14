"""
Evaluation metrics for SynChain AI time-series forecasting.
Calculates MAE, RMSE, WAPE, and MAPE with rigorous handling of zero values.
"""

from typing import Dict, Any, List, Optional, Union
import numpy as np


def calculate_forecast_metrics(
    actual: Union[List[float], np.ndarray],
    predicted: Union[List[float], np.ndarray]
) -> Dict[str, Any]:
    """
    Computes out-of-sample forecast accuracy metrics.

    Parameters
    ----------
    actual : array-like of shape (n,)
        Ground-truth observed values.
    predicted : array-like of shape (n,)
        Model predictions for the corresponding time periods.

    Returns
    -------
    Dict[str, Any]
        Dictionary containing:
        - mae: Mean Absolute Error in original unit scale.
        - rmse: Root Mean Squared Error in original unit scale.
        - wape: Weighted Absolute Percentage Error (sum(|y - y_hat|) / sum(|y|) * 100).
        - mape: Mean Absolute Percentage Error (None if any y == 0).
        - mape_status: Explanation if MAPE is undefined.
        - sample_size: Number of evaluation points.
    """
    y_true = np.asarray(actual, dtype=float)
    y_pred = np.asarray(predicted, dtype=float)

    if len(y_true) == 0 or len(y_pred) == 0:
        raise ValueError("Cannot calculate metrics on empty input series.")

    if len(y_true) != len(y_pred):
        raise ValueError(
            f"Shape mismatch: actual has {len(y_true)} elements, predicted has {len(y_pred)} elements."
        )

    # Filter out NaNs if present
    valid_mask = (~np.isnan(y_true)) & (~np.isnan(y_pred))
    y_true = y_true[valid_mask]
    y_pred = y_pred[valid_mask]

    n = len(y_true)
    if n == 0:
        raise ValueError("No valid non-NaN observations available for metric calculation.")

    abs_errors = np.abs(y_true - y_pred)
    sq_errors = np.square(y_true - y_pred)

    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(sq_errors)))

    # WAPE (Weighted Absolute Percentage Error): robust across zero actuals
    sum_actual = float(np.sum(np.abs(y_true)))
    if sum_actual > 0:
        wape = float((np.sum(abs_errors) / sum_actual) * 100.0)
    else:
        wape = None

    # MAPE: undefined if any actual is 0
    zero_mask = (y_true == 0)
    has_zeros = bool(np.any(zero_mask))

    if has_zeros:
        mape = None
        mape_status = (
            f"Standard MAPE is mathematically undefined because {int(np.sum(zero_mask))} "
            f"actual observation(s) equal 0. Use WAPE (Weighted Absolute Percentage Error) instead."
        )
    else:
        mape = float(np.mean(abs_errors / np.abs(y_true)) * 100.0)
        mape_status = "Computed on non-zero observations."

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "wape": round(wape, 2) if wape is not None else None,
        "mape": round(mape, 2) if mape is not None else None,
        "mape_status": mape_status,
        "sample_size": n
    }
