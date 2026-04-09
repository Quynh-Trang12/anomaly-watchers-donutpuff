import { PredictionOutput, TransactionInput, RiskFactor } from "../api";

/**
 * Local Heuristic Fallback Engine
 * Used when the ML backend is unreachable to ensure simulation continuity.
 */
export function calculateLocalRiskScore(data: TransactionInput): PredictionOutput {
  const risk_factors: RiskFactor[] = [];
  let probability = 0.05; // Base probability

  // Rule 1: Amount Thresholds
  if (data.amount > 200000) {
    probability += 0.45;
    risk_factors.push({
      factor: "High Volume: Transaction amount exceeds $200,000 safety threshold.",
      severity: "danger"
    });
  }

  // Rule 2: Account Drain Logic
  const balance_ratio = data.amount / data.oldbalanceOrg;
  if (balance_ratio > 0.9) {
    probability += 0.5;
    risk_factors.push({
      factor: "Account Drain: Attempting to transfer over 90% of total account balance.",
      severity: "danger"
    });
  }

  // Rule 3: Identity Checks (Non-numeric Destination IDs)
  // Standard IDs in this system usually start with C or T followed by numbers (e.g. C123456789)
  // We flag anything that doesn't follow the ^[CT]\d+$ pattern as suspicious for this demo
  const id_pattern = /^[CT]\d+$/;
  if (!id_pattern.test(data.destination_account_id)) {
    probability += 0.3;
    risk_factors.push({
      factor: "Identity Flags: Destination account ID format is non-standard.",
      severity: "warning"
    });
  }

  // Clamp probability
  probability = Math.min(Math.max(probability, 0.01), 0.99);

  // Determine Risk Level
  let risk_level: "High" | "Medium" | "Low" = "Low";
  if (probability > 0.7) risk_level = "High";
  else if (probability > 0.3) risk_level = "Medium";

  // Determine Status based on thresholds symmetric to backend
  let status: PredictionOutput["status"] = "APPROVED";
  if (probability > 0.8) {
    status = "BLOCKED";
  } else if (probability > 0.4) {
    status = "PENDING_USER_OTP";
  }

  return {
    probability,
    is_fraud: probability > 0.8,
    risk_level,
    status,
    explanation: "Transaction analyzed via Local Heuristic Fallback engine. Backend AI services are currently unavailable.",
    risk_factors,
    transaction_id: `LOCAL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  };
}
