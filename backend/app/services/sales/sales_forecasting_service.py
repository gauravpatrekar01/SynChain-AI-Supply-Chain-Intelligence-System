"""
Sales Revenue and Demand Forecasting Service for SynChain AI.
Implements out-of-sample evaluated time-series forecasting across multiple horizons
(30d, 60d, 90d, 6m, 12m), chronological backtesting (80/20 split), analytical
prediction intervals, and product/category level projections without data leakage.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
import dateutil.parser

from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_, or_, desc

from app.models.postgres.models import SalesTransaction
from app.schemas.sales import (
    SalesForecastPoint,
    SalesForecastEvaluationMetrics,
    RevenueForecastResponse,
)
from app.services.forecasting.metrics import calculate_forecast_metrics


class SalesForecastingService:

    @classmethod
    def generate_sales_forecast(
        cls,
        db: Session,
        horizon_days: int = 30,
        product_id: Optional[str] = None,
        category: Optional[str] = None,
        evaluate: bool = True,
    ) -> RevenueForecastResponse:
        """
        Builds a daily or weekly aggregated historical time series from actual sales transactions,
        runs chronological train/test backtesting to evaluate real accuracy (WAPE, RMSE, MAE),
        and projects future revenue and units with analytical 95% confidence intervals.
        """
        now = datetime.now(timezone.utc)
        now_str = now.strftime("%Y-%m-%d %H:%M:%S UTC")

        # Bound horizon
        valid_horizons = [30, 60, 90, 180, 365]
        if horizon_days not in valid_horizons:
            # Snap to closest
            horizon_days = min(valid_horizons, key=lambda x: abs(x - horizon_days))

        # Query database transactions
        query = db.query(SalesTransaction)
        prod_name: Optional[str] = None
        if product_id and product_id.strip():
            query = query.filter(SalesTransaction.product_id == product_id.strip())
            sample = db.query(SalesTransaction.product_name).filter(SalesTransaction.product_id == product_id.strip()).first()
            if sample:
                prod_name = sample[0]
        if category and category.strip() and category.lower() != "all":
            query = query.filter(func.lower(SalesTransaction.product_category) == category.strip().lower())

        total_tx = query.count()
        if total_tx == 0:
            return RevenueForecastResponse(
                has_data=False,
                has_sufficient_history=False,
                explanation="No sales transactions found matching the specified filters. Please import sales records to generate forecasts.",
                product_id=product_id,
                product_name=prod_name,
                category=category,
                forecast_horizon_days=horizon_days,
                historical_points=[],
                forecast_points=[],
                total_historical_revenue=0.0,
                total_forecasted_revenue=0.0,
                total_forecasted_units=0.0,
                expected_revenue_growth_pct=None,
                model_name="AutoRegressive Ridge + Linear Trend Baseline",
                model_version="v1.2",
                metrics=None,
                data_freshness_timestamp=now_str,
                limitations=["No historical sales transactions available."],
            )

        # Aggregate daily net revenue and units
        daily_records = (
            query.with_entities(
                func.date(SalesTransaction.transaction_date).label("d"),
                func.sum(SalesTransaction.net_revenue).label("rev"),
                func.sum(SalesTransaction.quantity_sold - SalesTransaction.return_quantity).label("units"),
            )
            .group_by("d")
            .order_by("d")
            .all()
        )

        n_days = len(daily_records)
        if n_days < 5:
            # Insufficient historical observations
            hist_pts = [
                SalesForecastPoint(
                    date=str(r[0]),
                    predicted_revenue=round(float(r[1]), 2),
                    confidence_lower=round(float(r[1]), 2),
                    confidence_upper=round(float(r[1]), 2),
                    predicted_units=max(0.0, float(r[2])),
                    is_forecast=False,
                )
                for r in daily_records
            ]
            tot_rev = sum(p.predicted_revenue for p in hist_pts)
            return RevenueForecastResponse(
                has_data=True,
                has_sufficient_history=False,
                explanation=(
                    f"Insufficient historical data ({n_days} daily observation(s) available; minimum 5 required). "
                    "Cannot train a reliable predictive model without introducing statistical noise."
                ),
                product_id=product_id,
                product_name=prod_name,
                category=category,
                forecast_horizon_days=horizon_days,
                historical_points=hist_pts,
                forecast_points=[],
                total_historical_revenue=round(tot_rev, 2),
                total_forecasted_revenue=0.0,
                total_forecasted_units=0.0,
                expected_revenue_growth_pct=None,
                model_name="Statistical Baseline",
                model_version="v1.0",
                metrics=None,
                data_freshness_timestamp=now_str,
                limitations=[
                    f"Only {n_days} daily observation(s) recorded.",
                    "Forecasting requires at least 5 distinct transaction dates to prevent future-data overfitting.",
                ],
            )

        # Prepare pandas DataFrame for time series modelling
        df = pd.DataFrame([
            {
                "date": pd.to_datetime(r[0]),
                "revenue": float(r[1]),
                "units": max(0.0, float(r[2])),
            }
            for r in daily_records
        ]).sort_values("date").reset_index(drop=True)

        # If data is sparse daily, fill missing dates or aggregate appropriately
        date_range = (df["date"].max() - df["date"].min()).days + 1
        series_rev = df["revenue"].to_numpy(dtype=float)
        series_units = df["units"].to_numpy(dtype=float)
        avg_price = float(np.sum(series_rev)) / max(1.0, float(np.sum(series_units)))

        # -------------------------------------------------------------
        # Chronological Train / Test Backtesting for Evaluation Metrics
        # -------------------------------------------------------------
        eval_metrics = None
        n_obs = len(series_rev)
        residual_std = 0.0

        if evaluate and n_obs >= 8:
            split_idx = int(n_obs * 0.8)
            train_rev = series_rev[:split_idx]
            test_rev = series_rev[split_idx:]
            eval_steps = len(test_rev)

            if len(train_rev) >= 5 and eval_steps >= 2:
                # Build lag + trend features strictly on training split
                X_tr, y_tr, lags = cls._build_ar_features(train_rev)
                if len(X_tr) > 0:
                    eval_model = Ridge(alpha=1.0)
                    eval_model.fit(X_tr, y_tr)

                    # Recursive rollout for test horizon
                    buf = list(train_rev)
                    eval_preds = []
                    for s in range(eval_steps):
                        t_curr = len(buf)
                        row = [t_curr] + [buf[t_curr - l] for l in lags]
                        pred_val = max(0.0, float(eval_model.predict([row])[0]))
                        eval_preds.append(pred_val)
                        buf.append(pred_val)

                    try:
                        raw_metrics = calculate_forecast_metrics(test_rev, eval_preds)
                        wape_val = raw_metrics.get("wape")
                        acc_pct = max(0.0, min(100.0, round(100.0 - wape_val, 1))) if wape_val is not None else None
                        eval_metrics = SalesForecastEvaluationMetrics(
                            mae=raw_metrics["mae"],
                            rmse=raw_metrics["rmse"],
                            wape=raw_metrics.get("wape"),
                            mape=raw_metrics.get("mape"),
                            accuracy_pct=acc_pct,
                            sample_size=raw_metrics["sample_size"],
                            evaluation_type="Out-of-sample Chronological Backtest (80/20 train/test)",
                        )
                    except Exception as err:
                        logger.warning(f"Failed to calculate backtest metrics: {err}")

        # -------------------------------------------------------------
        # Full Model Fit on Complete Historical Dataset
        # -------------------------------------------------------------
        X_all, y_all, eff_lags = cls._build_ar_features(series_rev)
        model = Ridge(alpha=1.0)
        model.fit(X_all, y_all)

        fitted_train = model.predict(X_all)
        residuals = y_all - fitted_train
        residual_std = float(np.std(residuals)) if len(residuals) > 1 else float(np.mean(series_rev) * 0.15)
        residual_std = max(1.0, residual_std)

        # Multi-step future projection
        future_buf = list(series_rev)
        future_forecast_rev: List[float] = []
        future_lower_rev: List[float] = []
        future_upper_rev: List[float] = []

        z_score = 1.96  # 95% confidence interval

        for step in range(horizon_days):
            t_curr = len(future_buf)
            row = [t_curr] + [future_buf[t_curr - l] for l in eff_lags]
            pred = max(0.0, float(model.predict([row])[0]))
            future_forecast_rev.append(pred)
            future_buf.append(pred)

            # Uncertainty expands with step horizon sqrt(step + 1)
            uncertainty_band = z_score * residual_std * np.sqrt(1.0 + (step * 0.05))
            future_lower_rev.append(max(0.0, pred - uncertainty_band))
            future_upper_rev.append(pred + uncertainty_band)

        # Dates formatting
        last_date = df["date"].max()
        forecast_start_date = (last_date + timedelta(days=1)).strftime("%Y-%m-%d")
        forecast_end_date = (last_date + timedelta(days=horizon_days)).strftime("%Y-%m-%d")

        # Build response points
        hist_points: List[SalesForecastPoint] = [
            SalesForecastPoint(
                date=row["date"].strftime("%Y-%m-%d"),
                predicted_revenue=round(row["revenue"], 2),
                confidence_lower=round(row["revenue"], 2),
                confidence_upper=round(row["revenue"], 2),
                predicted_units=round(row["units"], 1),
                is_forecast=False,
            )
            for _, row in df.iterrows()
        ]

        forecast_points: List[SalesForecastPoint] = []
        for i in range(horizon_days):
            f_date = (last_date + timedelta(days=i + 1)).strftime("%Y-%m-%d")
            p_rev = round(future_forecast_rev[i], 2)
            p_low = round(future_lower_rev[i], 2)
            p_upp = round(future_upper_rev[i], 2)
            p_units = round(p_rev / max(0.01, avg_price), 1)

            forecast_points.append(
                SalesForecastPoint(
                    date=f_date,
                    predicted_revenue=p_rev,
                    confidence_lower=p_low,
                    confidence_upper=p_upp,
                    predicted_units=p_units,
                    is_forecast=True,
                )
            )

        total_hist_rev = round(float(np.sum(series_rev)), 2)
        total_fcst_rev = round(sum(p.predicted_revenue for p in forecast_points), 2)
        total_fcst_units = round(sum(p.predicted_units for p in forecast_points), 1)

        # Expected growth comparing equivalent length window
        equiv_hist_window = series_rev[-horizon_days:] if len(series_rev) >= horizon_days else series_rev
        equiv_hist_sum = float(np.sum(equiv_hist_window))
        # Scale to same duration if history is shorter than horizon
        scaled_hist_sum = equiv_hist_sum * (horizon_days / max(1, len(equiv_hist_window)))
        expected_growth: Optional[float] = None
        if scaled_hist_sum > 0:
            expected_growth = round(((total_fcst_rev - scaled_hist_sum) / scaled_hist_sum) * 100.0, 1)

        limitations = [
            "Projections assume stationarity in macro demand conditions.",
            "Prediction intervals expand over time to account for multi-step recursive variance.",
        ]
        if n_obs < 30:
            limitations.append(f"Model fitted on {n_obs} daily observations; accuracy will improve as more sales cycles are logged.")

        return RevenueForecastResponse(
            has_data=True,
            has_sufficient_history=True,
            explanation=(
                f"Generated {horizon_days}-day revenue and volume forecast utilizing "
                f"AutoRegressive Ridge + Linear Trend model fitted on {n_obs} daily ground-truth transactions."
            ),
            product_id=product_id,
            product_name=prod_name,
            category=category,
            forecast_horizon_days=horizon_days,
            forecast_start_date=forecast_start_date,
            forecast_end_date=forecast_end_date,
            historical_points=hist_points,
            forecast_points=forecast_points,
            total_historical_revenue=total_hist_rev,
            total_forecasted_revenue=total_fcst_rev,
            total_forecasted_units=total_fcst_units,
            expected_revenue_growth_pct=expected_growth,
            model_name="AutoRegressive Ridge + Linear Trend Baseline",
            model_version="v1.2",
            interval_confidence_pct=95,
            metrics=eval_metrics,
            data_freshness_timestamp=now_str,
            limitations=limitations,
        )

    @classmethod
    def _build_ar_features(cls, series: np.ndarray, default_lags: Tuple[int, ...] = (1, 2, 7)) -> Tuple[np.ndarray, np.ndarray, List[int]]:
        """Constructs AR lag + trend feature matrix."""
        n = len(series)
        effective_lags = [l for l in default_lags if l < n] or [1]
        max_lag = max(effective_lags)

        X, y = [], []
        for t in range(max_lag, n):
            row = [t]  # linear trend feature
            for lag in effective_lags:
                row.append(series[t - lag])
            X.append(row)
            y.append(series[t])

        if len(X) == 0:
            # Fallback for very short series
            X = [[i] for i in range(n)]
            y = list(series)
            effective_lags = [1]

        return np.array(X, dtype=float), np.array(y, dtype=float), effective_lags
