import { TransactionType, Decision, AdminSettings } from "@/types/transaction";

export interface ScoringInput {
  type: TransactionType;
  amount: number;
  oldbalanceOrg: number;
  newbalanceOrig: number;
  oldbalanceDest: number;
  newbalanceDest: number;
  isFlaggedFraud: 0 | 1;
}

export interface ScoringResult {
  riskScore: number;
  decision: Decision;
  reasons: string[];
}

export function computeIsFlaggedFraud(
  type: TransactionType, 
  amount: number, 
  settings: AdminSettings
): 0 | 1 {
  // Legacy rule: flag if TRANSFER and amount >= threshold
  if (type === "TRANSFER" && amount >= settings.flagThresholdAmount) {
    return 1;
  }
  return 0;
}

export function scoreTransaction(
  input: ScoringInput,
  settings: AdminSettings
): ScoringResult {
  const reasons: string[] = [];
  let score = 0;

  const { type, amount, oldbalanceOrg, newbalanceOrig, oldbalanceDest, isFlaggedFraud } = input;

  // Amount ratio feature
  const amountRatio = amount / Math.max(oldbalanceOrg, 1);
  
  if (amountRatio > 0.9) {
    score += 0.30;
    reasons.push("Amount is high compared to origin balance");
  }

  // Balance becomes zero after transaction
  if (newbalanceOrig === 0 && amount > settings.zeroOutMinAmount) {
    score += 0.20;
    reasons.push("Balance becomes zero after transaction");
  }

  // Origin balance is zero but amount is non-zero
  if (oldbalanceOrg === 0 && amount > 0) {
    score += 0.15;
    reasons.push("Origin balance is zero but amount is non-zero");
  }

  // High-risk amount for TRANSFER or CASH OUT
  if ((type === "TRANSFER" || type === "CASH OUT") && amount > settings.highRiskAmount) {
    score += 0.15;
    reasons.push("High-risk transaction type with large amount");
  }

  // Legacy flagged fraud
  if (isFlaggedFraud === 1) {
    score += 0.10;
    reasons.push("Flagged by legacy rule");
  }

  // Large transfer to new/empty destination
  if (oldbalanceDest === 0 && amount > settings.newDestLargeAmount) {
    score += 0.10;
    reasons.push("Large transfer to new/empty destination");
  }

  // Type baselines
  const typeBaselines: Record<TransactionType, number> = {
    TRANSFER: 0.05,
    "CASH OUT": 0.08,
    PAYMENT: 0.02,
    "CASH IN": 0.03,
    DEBIT: 0.01,
  };
  score += typeBaselines[type];

  // Cap score between 0 and 1
  const finalScore = Math.min(Math.max(score, 0), 1);

  // Determine decision based on thresholds
  let decision: Decision;
  if (finalScore < settings.approveThreshold) {
    decision = "APPROVE";
  } else if (finalScore >= settings.blockThreshold) {
    decision = "BLOCK";
  } else {
    decision = "STEP_UP";
  }

  // Keep top 3 reasons
  const topReasons = reasons.slice(0, 3);
  
  // Add a default reason if none
  if (topReasons.length === 0) {
    topReasons.push("Transaction appears normal");
  }

  return {
    riskScore: finalScore,
    decision,
    reasons: topReasons,
  };
}

export function getRiskLevel(score: number): "low" | "medium" | "high" {
  if (score < 0.35) return "low";
  if (score < 0.70) return "medium";
  return "high";
}

export function getDecisionLabel(decision: Decision): string {
  const labels: Record<Decision, string> = {
    APPROVE: "Approved",
    STEP_UP: "Requires Verification",
    BLOCK: "Blocked",
    APPROVE_AFTER_STEPUP: "Approved (After Verification)",
    BLOCK_STEPUP_FAILED: "Blocked (Verification Failed)",
  };
  return labels[decision];
}
