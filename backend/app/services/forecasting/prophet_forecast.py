import pandas as pd
from prophet import Prophet
from typing import Dict, Any, List

class ForecastingService:
    def __init__(self):
        pass

    def generate_demand_forecast(self, historical_data: List[Dict[str, Any]], horizon: int) -> Dict[str, Any]:
        """
        historical_data: list of dicts with {"date": "YYYY-MM-DD", "demand": float/int}
        horizon: number of days to forecast
        """
        # Convert to DataFrame
        df = pd.DataFrame(historical_data)
        if df.empty or "date" not in df.columns or "demand" not in df.columns:
            raise ValueError("Historical data must contain date and demand fields.")
            
        df = df.rename(columns={"date": "ds", "demand": "y"})
        df["ds"] = pd.to_datetime(df["ds"])

        # Initialize and fit model
        model = Prophet(yearly_seasonality=True, weekly_seasonality=True, daily_seasonality=False)
        model.fit(df)

        # Make future dataframe
        future = model.make_future_dataframe(periods=horizon)
        forecast = model.predict(future)

        # Structure results
        results = []
        for _, row in forecast.tail(horizon).iterrows():
            results.append({
                "date": row["ds"].strftime("%Y-%m-%d"),
                "predicted_demand": float(row["yhat"]),
                "confidence_lower": float(row["yhat_lower"]),
                "confidence_upper": float(row["yhat_upper"]),
                "trend": float(row["trend"])
            })

        return {
            "forecast": results,
            "model_version": "Prophet-v1.1.5",
            "horizon": horizon
        }
