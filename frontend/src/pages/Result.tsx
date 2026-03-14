import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { DecisionBadge } from "@/components/ui/DecisionBadge";
import { RiskScore } from "@/components/ui/RiskScore";
import { OTPChallenge } from "@/components/result/OTPChallenge";
import { TransactionDatasetView } from "@/components/result/TransactionDatasetView";
import {
  Transaction,
  Decision,
  DEFAULT_ORIGIN_ACCOUNTS,
} from "@/types/transaction";
import {
  getPendingTransaction,
  clearPendingTransaction,
  updateTransaction,
  getAdminSettings,
} from "@/lib/storage";
import { getEventTypeLabel, formatCurrency } from "@/lib/eventTypes";
import {
  PlayCircle,
  History,
  AlertCircle,
  Lightbulb,
  TrendingDown,
  DollarSign,
  Clock,
  ArrowRight,
} from "lucide-react";

// Generate human-readable explanations for risk factors
function generateExplainability(
  transaction: Transaction,
  displayDecision: Decision,
): {
  icon: React.ElementType;
  text: string;
  severity: "info" | "warning" | "danger";
}[] {
  const explanations: {
    icon: React.ElementType;
    text: string;
    severity: "info" | "warning" | "danger";
  }[] = [];
  const settings = getAdminSettings();

  // High amount explanation
  if (transaction.amount >= settings.highRiskAmount) {
    explanations.push({
      icon: DollarSign,
      text: `High amount detected: ${formatCurrency(transaction.amount)} exceeds the ${formatCurrency(settings.highRiskAmount)} threshold.`,
      severity: "warning",
    });
  }

  // Balance drain detection
  const drainPercentage =
    transaction.oldbalanceOrg > 0
      ? ((transaction.oldbalanceOrg - transaction.newbalanceOrig) /
          transaction.oldbalanceOrg) *
        100
      : 0;
  if (drainPercentage >= 80) {
    explanations.push({
      icon: TrendingDown,
      text: `Balance drain detected: Account went from ${formatCurrency(transaction.oldbalanceOrg)} to ${formatCurrency(transaction.newbalanceOrig)} (${drainPercentage.toFixed(0)}% reduction).`,
      severity: "danger",
    });
  } else if (drainPercentage >= 50) {
    explanations.push({
      icon: TrendingDown,
      text: `Significant withdrawal: ${drainPercentage.toFixed(0)}% of account balance used in this transaction.`,
      severity: "warning",
    });
  }

  // Zero-out pattern
  if (
    transaction.newbalanceOrig === 0 &&
    transaction.amount >= settings.zeroOutMinAmount
  ) {
    explanations.push({
      icon: AlertCircle,
      text: `Zero-out pattern: Account emptied with a ${formatCurrency(transaction.amount)} transaction.`,
      severity: "danger",
    });
  }

  // Transaction type specific explanations
  if (
    transaction.type === "TRANSFER" &&
    transaction.amount >= settings.newDestLargeAmount
  ) {
    explanations.push({
      icon: ArrowRight,
      text: `Large transfer: P2P transfers over ${formatCurrency(settings.newDestLargeAmount)} receive additional scrutiny.`,
      severity: "warning",
    });
  }

  if (transaction.type === "CASH OUT" && transaction.amount >= 100000) {
    explanations.push({
      icon: AlertCircle,
      text: `Large cash withdrawal: Cash-out transactions over $100,000 are flagged for review.`,
      severity: "warning",
    });
  }

  // Time-based explanation
  const hour = (transaction.step - 1) % 24;
  // Only flag timing if risk is elevated or explicitly high
  if (hour >= 0 && hour < 6 && transaction.riskScore > 20) {
    explanations.push({
      icon: Clock,
      text: `Unusual timing: Transaction occurred during off-hours (${hour}:00), contributing to risk.`,
      severity: "info",
    });
  }

  // --- Consistency Filter ---
  // If the AI says it's SAFE (Low Risk), we shouldn't show "Danger" flags driven by simple rules.
  // The AI likely sees other factors (e.g. valid history, device match) that override these rules.
  const isLowRisk = transaction.riskScore < 50;

  const filteredExplanations = explanations.map((exp) => {
    if (isLowRisk) {
      // Downgrade severities for low-risk transactions
      if (exp.severity === "danger") {
        return {
          ...exp,
          severity: "info" as const,
          text: exp.text + " (Cleared by AI analysis)",
        };
      }
      if (exp.severity === "warning") {
        return {
          ...exp,
          severity: "info" as const,
          text: exp.text + " (Within normal bounds for this profile)",
        };
      }
    }
    return exp;
  });

  // If approved, strictly limit negative explanations to avoid confusion
  if (
    displayDecision === "APPROVE" ||
    displayDecision === "APPROVE_AFTER_STEPUP"
  ) {
    const criticalFactors = filteredExplanations.filter(
      (e) => e.severity === "info",
    );
    if (criticalFactors.length === 0) {
      criticalFactors.push({
        icon: Lightbulb,
        text: "Transaction parameters are consistent with legitimate behavior patterns.",
        severity: "info",
      });
    }
    return criticalFactors;
  }

  // If no specific explanations, add a general one based on decision
  if (filteredExplanations.length === 0) {
    filteredExplanations.push({
      icon: AlertCircle,
      text: "AI model detected potential anomalies in the transaction pattern.",
      severity: "warning",
    });
  }

  return filteredExplanations;
}

export default function Result() {
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [showOTP, setShowOTP] = useState(false);
  const [finalDecision, setFinalDecision] = useState<Decision | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const pending = getPendingTransaction();
    if (!pending) {
      navigate("/simulate");
      return;
    }
    setTransaction(pending);
    setFinalDecision(pending.decision);

    if (pending.decision === "STEP_UP") {
      setShowOTP(true);
    }

    clearPendingTransaction();

    // Focus heading for accessibility
    setTimeout(() => {
      headingRef.current?.focus();
    }, 100);
  }, [navigate]);

  const handleOTPSuccess = () => {
    if (!transaction) return;
    const newDecision: Decision = "APPROVE_AFTER_STEPUP";
    setFinalDecision(newDecision);
    setShowOTP(false);
    updateTransaction(transaction.id, { decision: newDecision });
  };

  const handleOTPFail = () => {
    if (!transaction) return;
    const newDecision: Decision = "BLOCK_STEPUP_FAILED";
    setFinalDecision(newDecision);
    setShowOTP(false);
    updateTransaction(transaction.id, { decision: newDecision });
  };

  if (!transaction) {
    return (
      <Layout>
        <div className="container py-12 text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Layout>
    );
  }

  const displayDecision = finalDecision || transaction.decision;
  const explanations = generateExplainability(transaction, displayDecision);

  // Get friendly account name
  const originAccount = DEFAULT_ORIGIN_ACCOUNTS.find(
    (a) => a.id === transaction.nameOrig,
  );
  const accountDisplayName = originAccount?.displayName || transaction.nameOrig;

  const decisionColors = {
    APPROVE: "bg-success-muted border-success/20",
    STEP_UP: "bg-warning-muted border-warning/20",
    BLOCK: "bg-danger-muted border-danger/20",
    APPROVE_AFTER_STEPUP: "bg-success-muted border-success/20",
    BLOCK_STEPUP_FAILED: "bg-danger-muted border-danger/20",
  };

  const severityStyles = {
    info: "bg-muted/50 text-muted-foreground",
    warning: "bg-warning-muted text-warning",
    danger: "bg-danger-muted text-danger",
  };

  return (
    <Layout>
      <div className="container py-6 sm:py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Decision Banner */}
          <div
            className={`rounded-lg border p-6 text-center ${decisionColors[displayDecision]}`}
          >
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl sm:text-3xl font-bold mb-4 outline-none"
            >
              Risk Assessment Result
            </h1>
            <DecisionBadge decision={displayDecision} size="lg" />
          </div>

          {/* OTP Challenge */}
          {showOTP && (
            <div className="section-card-elevated">
              <OTPChallenge
                onSuccess={handleOTPSuccess}
                onFail={handleOTPFail}
              />
            </div>
          )}

          {/* Risk Score */}
          {!showOTP && (
            <div className="section-card">
              <h2 className="font-semibold mb-4">Risk Analysis</h2>
              <RiskScore score={transaction.riskScore} size="lg" />

              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Risk Factors
                </h3>
                <ul className="space-y-2">
                  {transaction.reasons.map((reason, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertCircle
                        className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Explainability Section */}
          {!showOTP && explanations.length > 0 && (
            <div className="section-card">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb
                  className="h-5 w-5 text-primary"
                  aria-hidden="true"
                />
                <h2 className="font-semibold">Why This Decision?</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Here's what our AI detected based on your transaction inputs:
              </p>
              <ul className="space-y-3">
                {explanations.map((explanation, index) => {
                  const Icon = explanation.icon;
                  return (
                    <li
                      key={index}
                      className={`flex items-start gap-3 p-3 rounded-lg ${severityStyles[explanation.severity]}`}
                    >
                      <Icon
                        className="h-5 w-5 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span className="text-sm">{explanation.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Transaction Summary */}
          {!showOTP && (
            <div className="section-card">
              <h2 className="font-semibold mb-4">Transaction Summary</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Event Type</dt>
                  <dd className="font-medium">
                    {getEventTypeLabel(transaction.type)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="font-mono font-medium">
                    {formatCurrency(transaction.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Sender</dt>
                  <dd>
                    <span className="font-medium">{accountDisplayName}</span>
                    <span className="text-xs text-muted-foreground block font-mono">
                      {transaction.nameOrig}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Recipient</dt>
                  <dd className="font-mono text-xs">{transaction.nameDest}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Legacy Flagged</dt>
                  <dd>{transaction.isFlaggedFraud === 1 ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="text-xs">
                    {new Date(transaction.createdAt).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Dataset View - Collapsed by default */}
          {!showOTP && (
            <TransactionDatasetView
              transaction={transaction}
              defaultOpen={false}
            />
          )}

          {/* Actions */}
          {!showOTP && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="flex-1 gap-2">
                <Link to="/simulate">
                  <PlayCircle className="h-4 w-4" aria-hidden="true" />
                  Run Another Simulation
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1 gap-2">
                <Link to="/history">
                  <History className="h-4 w-4" aria-hidden="true" />
                  View Activity Log
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
