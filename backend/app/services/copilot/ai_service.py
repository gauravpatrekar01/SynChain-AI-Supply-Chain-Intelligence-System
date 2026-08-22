from typing import Dict, Any, List

class AICopilotService:
    def __init__(self):
        # In a real scenario, initialize LLM client here
        pass

    def generate_response(self, user_message: str, context: Dict[str, Any]) -> str:
        """
        Simulates an LLM generating a response based on the supply chain context
        and user query.
        """
        message_lower = user_message.lower()
        
        entity_name = context.get("entityName", "the selected entity")
        risk_score = context.get("currentRiskScore", "unknown")
        
        if "risk" in message_lower or "why" in message_lower:
            return (f"Based on our analysis, {entity_name} has a risk score of {risk_score}. "
                    f"This is primarily driven by recent disruptions upstream and capacity constraints. "
                    f"I recommend reviewing the simulated 'what-if' scenarios to evaluate potential mitigation strategies.")
        elif "mitigate" in message_lower or "fix" in message_lower or "recommend" in message_lower:
             return (f"To mitigate risks for {entity_name}, our recommendation engine suggests dual-sourcing "
                     f"from pre-approved Tier-2 suppliers or expediting freight for critical components. "
                     f"Would you like me to simulate the financial impact of dual-sourcing?")
        elif "forecast" in message_lower or "demand" in message_lower:
            return (f"Demand forecasts for {entity_name} indicate a potential 15% surge in the next quarter. "
                    f"Given the current risk score of {risk_score}, I advise increasing safety stock levels by at least 10% "
                    f"to prevent stockouts.")
        else:
            return (f"I understand you are asking about {entity_name}. As your SynChain AI Copilot, "
                    f"I can analyze risk factors, run simulations, or provide mitigation recommendations based on the current context. "
                    f"How would you like to proceed?")
