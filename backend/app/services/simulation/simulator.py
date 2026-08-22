from typing import Dict, Any, List
import uuid

class SimulationService:
    def __init__(self):
        pass

    def run_monte_carlo_simulation(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs a stochastic scenario simulation based on disruption configuration parameters.
        Calculates production loss, delay impact, financial loss, and affected entity arrays.
        """
        scenario_name = input_data.get("scenarioName", "Custom Disruption Scenario")
        disruption_type = input_data.get("disruptionType", "custom")
        target_entity_id = input_data.get("targetEntityId", "unknown")
        target_entity_name = input_data.get("targetEntityName", "Selected Entity")
        duration_days = int(input_data.get("durationDays", 14))
        severity_pct = float(input_data.get("severityPct", 50)) / 100.0
        include_cascade = bool(input_data.get("includeSecondTierCascade", True))
        auto_mitigate = bool(input_data.get("autoMitigate", True))

        # Core heuristics calculating simulation results
        factor = severity_pct * (duration_days / 14.0)
        revenue_loss = int(18450000 * factor)
        units_loss = int(14200 * factor)
        delay_days = round(8.4 * factor * (1.4 if include_cascade else 1.0), 1)
        sla_penalty = int(2800000 * factor)
        expedited_cost = int(1450000 * factor)
        exposure = revenue_loss + sla_penalty + expedited_cost

        # post-simulation risk scoring
        post_risk = min(98, int(34 + (severity_pct * 50)))

        # Define cascading timeline logs
        cascading_timeline = [
            {
                "day": 1,
                "affectedEntity": target_entity_name,
                "description": f"Disruption activated at {target_entity_name} with {int(severity_pct * 100)}% severity constraint.",
                "impactLevel": "critical" if severity_pct > 0.7 else "medium"
            }
        ]

        if duration_days > 3:
            cascading_timeline.append({
                "day": 4,
                "affectedEntity": "Foxconn Precision Park",
                "description": "Component buffer depleted by 50%; assembly line operations constrained.",
                "impactLevel": "high"
            })
        if duration_days > 7:
            cascading_timeline.append({
                "day": 8,
                "affectedEntity": "Giga Plant Austin",
                "description": "ECU allocation starvation triggers production shift constraints.",
                "impactLevel": "critical"
            })

        # Define mitigation options
        mitigation_strategies = []
        if auto_mitigate:
            mitigation_strategies = [
                {
                    "id": "mit-1",
                    "title": "Authorize SK Hynix Dual-Sourcing Allocation",
                    "description": "Activate secondary supplier agreement to bypass constrained routes.",
                    "category": "dual_sourcing",
                    "costEstimateUsd": 420000,
                    "savingsEstimateUsd": 2800000,
                    "timeSavedDays": 12,
                    "implementationTimeframe": "24-48 Hours",
                    "status": "pending"
                },
                {
                    "id": "mit-2",
                    "title": "Charter Boeing 777F Air Cargo for Microcontroller Batch",
                    "description": "Bypass maritime delay corridors by shifting priority silicon chips to air freight.",
                    "category": "expedited_freight",
                    "costEstimateUsd": 260000,
                    "savingsEstimateUsd": 1950000,
                    "timeSavedDays": 9,
                    "implementationTimeframe": "12 Hours",
                    "status": "pending"
                }
            ]

        # Trend timelines
        daily_trend = []
        for d in range(1, duration_days + 1):
            if d % 2 == 1 or d == duration_days:
                daily_trend.append({
                    "day": d,
                    "lossWithoutMitigation": int(revenue_loss * (d / duration_days)),
                    "lossWithMitigation": int((revenue_loss * 0.2) * (d / duration_days))
                })

        return {
            "scenarioId": f"sim-res-{uuid.uuid4().hex[:8]}",
            "scenarioName": scenario_name,
            "createdAt": "2026-08-22 19:30:00 UTC",
            "financialLossEstimateUsd": revenue_loss,
            "lostProductionUnits": units_loss,
            "estimatedDelayDays": delay_days,
            "riskScorePostSimulation": post_risk,
            "productionLossUnits": units_loss,
            "productionLossPct": round(factor * 20.0, 1),
            "estimatedRevenueLossUsd": revenue_loss,
            "slaPenaltyCostUsd": sla_penalty,
            "expeditedRecoveryCostUsd": expedited_cost,
            "netFinancialExposureUsd": exposure,
            "days_to_stockout": max(2, int(15 - (severity_pct * 10))),
            "averageShipmentDelayDays": delay_days,
            "preRiskScore": 34,
            "postRiskScore": post_risk,
            "mitigatedRiskScore": max(15, post_risk - 45),
            "affectedProductLines": ["Autonomous AI Edge Server Pro", "Giga Compute Cluster X"],
            "affectedCustomerOrdersCount": int(150 * factor),
            "dailyImpactTrend": daily_trend,
            "cascadingTimeline": cascading_timeline,
            "mitigationStrategies": mitigation_strategies
        }
