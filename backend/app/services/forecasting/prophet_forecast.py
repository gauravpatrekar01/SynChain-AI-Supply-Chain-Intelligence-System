"""Prophet-based daily demand forecasting with evaluation metrics."""

from __future__ import annotations

import math
from typing import Any

import pandas as pd
from prophet import Prophet


MODEL_VERSION = "prophet-daily-v1"


class ForecastingService:
    """Generate daily demand forecasts using Prophet."""

    def generate_demand_forecast(
        self,
        historical_data: list[dict[str, Any]],
        horizon: int = 30,
        evaluate: bool = True,
        interval_width: float = 0.95,
    ) -> dict[str, Any]:

        # Validate the forecast horizon.
        if not isinstance(horizon, int) or not 1 <= horizon <= 365:
            raise ValueError(
                "horizon must be an integer between 1 and 365 days."
            )

        if not 0.5 < float(interval_width) < 1.0:
            raise ValueError(
                "interval_width must be between 0.5 and 1.0."
            )

        if not historical_data:
            raise ValueError(
                "At least five historical observations are required."
            )

        # Prepare historical data.
        df = pd.DataFrame(historical_data)

        if not {"date", "demand"}.issubset(df.columns):
            raise ValueError(
                "Every historical observation must contain date and demand."
            )

        df = df[["date", "demand"]].copy()

        df["ds"] = pd.to_datetime(
            df["date"],
            errors="coerce",
        )

        df["y"] = pd.to_numeric(
            df["demand"],
            errors="coerce",
        )

        df = df.dropna(subset=["ds", "y"])

        # Demand cannot be negative.
        df = df[df["y"] >= 0]

        # Combine duplicate dates.
        df = (
            df.groupby("ds", as_index=False)["y"]
            .sum()
            .sort_values("ds")
        )

        if len(df) < 5:
            raise ValueError(
                "At least five valid, non-negative historical observations "
                "are required."
            )

        if not df["y"].map(math.isfinite).all():
            raise ValueError("Demand values must be finite.")

        # Default metrics when evaluation is unavailable.
        metrics = {
            "mae": None,
            "rmse": None,
            "wape": None,
            "mape": None,
            "mape_status": "not_evaluated",
            "sample_size": 0,
            "evaluation_split": "chronological_holdout",
        }

        # Evaluate on the most recent observations.
        if evaluate and len(df) >= 10:

            holdout = max(
                2,
                min(max(2, horizon), len(df) // 5),
            )

            holdout = min(
                holdout,
                len(df) - 5,
            )

            train_df = df.iloc[:-holdout][["ds", "y"]]
            test_df = df.iloc[-holdout:].copy()

            evaluation_model = Prophet(
                interval_width=interval_width,
                daily_seasonality=False,
                weekly_seasonality=True,
                yearly_seasonality=len(train_df) >= 60,
            )

            evaluation_model.fit(train_df)

            evaluation_dates = pd.DataFrame(
                {"ds": test_df["ds"].values}
            )

            predictions = (
                evaluation_model.predict(evaluation_dates)["yhat"]
                .clip(lower=0)
                .to_numpy()
            )

            actual = test_df["y"].to_numpy()

            errors = actual - predictions

            mae = float(abs(errors).mean())

            rmse = float(
                (errors**2).mean() ** 0.5
            )

            actual_total = float(abs(actual).sum())

            wape = (
                float(abs(errors).sum() / actual_total * 100)
                if actual_total > 0
                else None
            )

            # MAPE is undefined for zero actual demand.
            nonzero_actual = actual != 0

            mape = (
                float(
                    (
                        abs(
                            errors[nonzero_actual]
                            / actual[nonzero_actual]
                        )
                    ).mean()
                    * 100
                )
                if nonzero_actual.any()
                else None
            )

            metrics = {
                "mae": mae,
                "rmse": rmse,
                "wape": wape,
                "mape": mape,
                "mape_status": (
                    "calculated_excluding_zero_actuals"
                    if nonzero_actual.any()
                    else "undefined_zero_actuals"
                ),
                "sample_size": int(len(actual)),
                "evaluation_split": "chronological_holdout",
            }

        # Train the final model using all available historical data.
        model = Prophet(
            interval_width=interval_width,
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=len(df) >= 60,
        )

        model.fit(df[["ds", "y"]])

        # Generate future forecasts.
        future = model.make_future_dataframe(
            periods=horizon,
            freq="D",
            include_history=False,
        )

        predictions = model.predict(future)

        forecast = []

        for _, row in predictions.iterrows():

            forecast.append(
                {
                    "date": row["ds"].strftime("%Y-%m-%d"),
                    "predictedDemandUnits": max(
                        0.0,
                        float(row["yhat"]),
                    ),
                    "confidenceLower": max(
                        0.0,
                        float(row["yhat_lower"]),
                    ),
                    "confidenceUpper": max(
                        0.0,
                        float(row["yhat_upper"]),
                    ),
                    "trend": max(
                        0.0,
                        float(row["trend"]),
                    ),
                }
            )

        historical = [
            {
                "date": row["ds"].strftime("%Y-%m-%d"),
                "actualDemandUnits": float(row["y"]),
            }
            for _, row in df.iterrows()
        ]

        return {
            "status": "success",
            "algorithm": "Prophet",
            "modelVersion": MODEL_VERSION,
            "horizon": horizon,
            "metrics": metrics,
            "forecast": forecast,
            "historical": historical,
        }