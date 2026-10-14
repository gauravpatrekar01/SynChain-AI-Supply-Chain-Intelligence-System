"""
Statistical baseline time-series forecaster for SynChain AI.
Implements an AutoRegressive (AR-Lags + Linear Trend) model with analytical 95% confidence bounds.
Requires only standard scientific Python libraries (numpy, scipy, scikit-learn).
"""

from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

from .data_loader import validate_and_clean_time_series
from .metrics import calculate_forecast_metrics


class BaselineForecaster:
    """
    AutoRegressive (AR) + Linear Trend statistical baseline model.
    Serves as a robust, low-latency benchmark and fallback for short time-series.
    """

    def __init__(self, lags: Tuple[int, ...] = (1, 2, 7), alpha: float = 1.0):
        self.lags = lags
        self.alpha = alpha
        self.model = Ridge(alpha=self.alpha)
        self.residual_std_ = 0.0
        self.last_dates_ = None
        self.freq_ = "D"

    def _build_features(self, series: np.ndarray) -> Tuple[np.ndarray, np.ndarray, List[int]]:
        """Constructs lagged and trend feature matrix."""
        max_lag = max(self.lags)
        n = len(series)
        if n <= max_lag:
            # Fall back to lag 1 only if series is too short
            effective_lags = [l for l in self.lags if l < n] or [1]
            max_lag = max(effective_lags)
        else:
            effective_lags = list(self.lags)

        X, y = [], []
        for t in range(max_lag, n):
            row = [t]  # linear trend feature
            for lag in effective_lags:
                row.append(series[t - lag])
            X.append(row)
            y.append(series[t])

        return np.array(X, dtype=float), np.array(y, dtype=float), effective_lags

    def fit_and_forecast(
        self,
        historical_data: Union[List[Dict[str, Any]], pd.DataFrame],
        horizon: int = 30,
        evaluate: bool = True
    ) -> Dict[str, Any]:
        """
        Fits the baseline model and generates future demand predictions.

        Parameters
        ----------
        historical_data : list of dicts or DataFrame
            Must contain 'date' and 'demand' (or supported aliases).
        horizon : int
            Number of steps/days to project.
        evaluate : bool
            Whether to run out-of-sample backtesting on 80/20 train/test split.

        Returns
        -------
        Dict[str, Any]
            Dictionary containing forecast points, historical observations, metrics, and algorithm metadata.
        """
        df, freq = validate_and_clean_time_series(historical_data, min_points=3)
        self.freq_ = freq
        series = df["demand"].to_numpy(dtype=float)
        dates = df["date"].tolist()
        n = len(series)

        # 1. Out-of-Sample Evaluation (if enough historical data)
        metrics = None
        if evaluate and n >= 10:
            split_idx = int(n * 0.8)
            train_series = series[:split_idx]
            test_series = series[split_idx:]
            eval_horizon = len(test_series)

            if len(train_series) >= 4 and eval_horizon >= 2:
                # Train model only on training split
                X_tr, y_tr, eff_lags = self._build_features(train_series)
                if len(X_tr) > 0:
                    eval_model = Ridge(alpha=self.alpha)
                    eval_model.fit(X_tr, y_tr)

                    # Multi-step recursive rollout
                    history_buffer = list(train_series)
                    eval_preds = []
                    for step in range(eval_horizon):
                        t_curr = len(history_buffer)
                        row = [t_curr] + [history_buffer[t_curr - lag] for lag in eff_lags]
                        y_next = float(eval_model.predict([row])[0])
                        y_next = max(0.0, y_next)
                        eval_preds.append(y_next)
                        history_buffer.append(y_next)

                    metrics = calculate_forecast_metrics(test_series, eval_preds)
                    metrics["evaluation_split"] = f"Train: {split_idx} points, Test: {eval_horizon} points"

        # 2. Fit on 100% of historical data for actual forward forecast
        X_full, y_full, eff_lags = self._build_features(series)
        if len(X_full) == 0:
            # Fallback for very small data: mean/naive projection
            mean_val = float(np.mean(series))
            self.residual_std_ = float(np.std(series)) or 1.0
            fitted = [mean_val] * n
            forecast_vals = [mean_val] * horizon
        else:
            self.model.fit(X_full, y_full)
            fitted_vals = self.model.predict(X_full)
            residuals = y_full - fitted_vals
            self.residual_std_ = float(np.std(residuals)) or 1.0

            # Pad fitted for leading lags
            pad_len = n - len(fitted_vals)
            fitted = [float(series[i]) for i in range(pad_len)] + [max(0.0, float(v)) for v in fitted_vals]

            # Multi-step recursive rollout into the future
            history_buffer = list(series)
            forecast_vals = []
            for step in range(horizon):
                t_curr = len(history_buffer)
                row = [t_curr] + [history_buffer[t_curr - lag] for lag in eff_lags]
                y_next = float(self.model.predict([row])[0])
                y_next = max(0.0, y_next)
                forecast_vals.append(y_next)
                history_buffer.append(y_next)

        # 3. Generate future dates matching frequency
        last_date = dates[-1]
        if self.freq_ == "W":
            future_dates = pd.date_range(start=last_date + pd.Timedelta(weeks=1), periods=horizon, freq="W")
        elif self.freq_ == "M":
            future_dates = pd.date_range(start=last_date + pd.DateOffset(months=1), periods=horizon, freq="MS")
        else:
            future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=horizon, freq="D")

        # 4. Construct response records with genuine 95% confidence intervals
        forecast_results = []
        for i, (f_date, f_val) in enumerate(zip(future_dates, forecast_vals)):
            step_idx = i + 1
            # Uncertainty expands with horizon sqrt(1 + h/n)
            margin = 1.96 * self.residual_std_ * np.sqrt(1.0 + (step_idx / float(max(1, n))))
            lower_bound = max(0.0, float(f_val - margin))
            upper_bound = max(float(f_val), float(f_val + margin))

            f_dict = {
                "date": f_date.strftime("%Y-%m-%d"),
                "predictedDemandUnits": round(f_val, 2),
                "confidenceLower": round(lower_bound, 2),
                "confidenceUpper": round(upper_bound, 2),
                "actualDemandUnits": None,
                "historicalBaseline": round(f_val, 2),
                # Backward-compatibility snake_case fields
                "predicted_demand": round(f_val, 2),
                "confidence_lower": round(lower_bound, 2),
                "confidence_upper": round(upper_bound, 2),
                "trend": round(f_val, 2)
            }
            forecast_results.append(f_dict)

        # 5. Historical results
        historical_results = []
        for d, act, fit in zip(dates, series, fitted):
            historical_results.append({
                "date": d.strftime("%Y-%m-%d"),
                "actualDemandUnits": round(float(act), 2),
                "predictedDemandUnits": round(float(fit), 2),
                "confidenceLower": round(max(0.0, float(fit - 1.96 * self.residual_std_)), 2),
                "confidenceUpper": round(float(fit + 1.96 * self.residual_std_), 2),
                "historicalBaseline": round(float(fit), 2),
                "predicted_demand": round(float(fit), 2),
                "confidence_lower": round(max(0.0, float(fit - 1.96 * self.residual_std_)), 2),
                "confidence_upper": round(float(fit + 1.96 * self.residual_std_), 2),
                "trend": round(float(fit), 2)
            })

        return {
            "forecast": forecast_results,
            "historical": historical_results,
            "all_points": historical_results + forecast_results,
            "metrics": metrics or {
                "mae": None, "rmse": None, "wape": None, "mape": None,
                "mape_status": "Insufficient historical points (< 10) for holdout backtest."
            },
            "horizon": horizon,
            "algorithm": "AutoRegressive Lags (AR-7) + Linear Trend (Statistical Baseline)",
            "model_version": "Baseline-AR-v1.0.0"
        }
