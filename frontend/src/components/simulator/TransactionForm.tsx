import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PresetButtons } from "./PresetButtons";
import { AccountSelector } from "./AccountSelector";
import { WalletWidget } from "./WalletWidget";
import { ProcessingModal } from "./ProcessingModal";
import { SimulatorHelpCallout } from "./SimulatorHelpCallout";
import { OTPChallenge } from "@/components/result/OTPChallenge";
import { TimeStepBadge } from "@/components/ui/TimeStepBadge";
import { TransactionPreset } from "@/lib/presets";
import { EVENT_TYPE_LABELS, formatCurrency } from "@/lib/eventTypes";
import {
  TransactionType,
  Transaction,
  TRANSACTION_TYPES,
  DEFAULT_ORIGIN_ACCOUNTS,
} from "@/types/transaction";
import {
  getLastStep,
  setLastStep,
  getOriginAccounts,
  getDestinationBalances,
  updateDestinationBalance,
  updateOriginAccount,
  getAdminSettings,
  setPendingTransaction,
} from "@/lib/storage";
import {
  computeIsFlaggedFraud,
  getRiskLevel,
  scoreTransaction,
} from "@/lib/scoring";
import {
  createTransaction,
  predictPrimary,
  sendUserConfirmationEmail,
  sendUserOtpEmail,
} from "@/api";
import {
  RotateCcw,
  Send,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Clock,
} from "lucide-react";

interface FormErrors {
  [key: string]: string;
}

function formatBackendRiskLevel(
  level: "low" | "medium" | "high",
): "Low" | "Medium" | "High" {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}

function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as any).response === "object"
  ) {
    const detail = (error as any).response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function normalizeReasonText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function appendUniqueReason(reasons: string[], value: string): void {
  const normalized = normalizeReasonText(value);
  if (!normalized) return;

  const key = normalized
    .toLowerCase()
    .replace(/[.,:;!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const exists = reasons.some((item) => {
    const itemKey = normalizeReasonText(item)
      .toLowerCase()
      .replace(/[.,:;!?]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return itemKey === key;
  });

  if (!exists) {
    reasons.push(normalized);
  }
}

function simplifyModelExplanation(explanation?: string): string {
  const normalized = normalizeReasonText(explanation ?? "");
  if (!normalized) return "";

  const sentences = normalized.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 1) {
    return normalized;
  }

  const firstSentence = sentences[0] ?? "";
  const looksLikeModelSummary =
    /fraud probability/i.test(firstSentence) && /risk/i.test(firstSentence);

  if (looksLikeModelSummary) {
    return normalizeReasonText(sentences.slice(1).join(" "));
  }

  return normalized;
}

function parseAmountInput(value: string): string {
  const sanitized = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!sanitized) return "";

  const firstDotIndex = sanitized.indexOf(".");
  if (firstDotIndex === -1) return sanitized;

  const integerPart = sanitized.slice(0, firstDotIndex);
  const decimalPart = sanitized.slice(firstDotIndex + 1).replace(/\./g, "");
  return `${integerPart}.${decimalPart}`;
}

function formatAmountDisplay(value: string): string {
  if (!value) return "";

  const [integerPartRaw, decimalPart] = value.split(".");
  const integerPart = integerPartRaw || "0";
  const withCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decimalPart !== undefined) {
    return `${withCommas}.${decimalPart}`;
  }

  return withCommas;
}

type RiskBucket = "low" | "medium" | "high";
const APP_OTP_CODE = "123456";

function getRiskBucket(
  riskScore: number,
  backendRiskLevel?: "Low" | "Medium" | "High",
): RiskBucket {
  if (backendRiskLevel === "High" || riskScore >= 70) return "high";
  if (backendRiskLevel === "Medium" || riskScore >= 35) return "medium";
  return "low";
}

export function TransactionForm() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  // Form state - step is now auto-managed
  const [step, setStep] = useState(getLastStep() + 1);
  const [type, setType] = useState<TransactionType | "">("");
  const [nameOrig, setNameOrig] = useState("");
  const [amount, setAmount] = useState("");
  const [nameDest, setNameDest] = useState("");
  const [advancedMode, setAdvancedMode] = useState(false);
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(false);
  const [manualOldBalanceDest, setManualOldBalanceDest] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [showStepUpOTP, setShowStepUpOTP] = useState(false);
  const [showUserConfirmation, setShowUserConfirmation] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(
    null,
  );
  const [pendingTransactionData, setPendingTransactionData] =
    useState<Transaction | null>(null);
  const [pendingMediumTransactionData, setPendingMediumTransactionData] =
    useState<Transaction | null>(null);

  const originAccounts = useMemo(() => getOriginAccounts(), []);
  const destBalances = useMemo(() => getDestinationBalances(), []);
  const adminSettings = useMemo(() => getAdminSettings(), []);

  // Get selected origin account
  const selectedOrigin = originAccounts.find((a) => a.id === nameOrig);
  const oldbalanceOrg = selectedOrigin?.balance ?? 0;

  // Compute destination name based on type
  const computedNameDest = useMemo(() => {
    if (advancedMode && nameDest) return nameDest;
    if (!type) return "";

    switch (type) {
      case "CASH OUT":
      case "CASH IN":
        return "CASH AGENT";
      case "DEBIT":
        return "BANK FEE ACCOUNT";
      case "PAYMENT":
        return `M${Math.random().toString().slice(2, 12)}`;
      case "TRANSFER":
        return `C${Math.random().toString().slice(2, 12)}`;
      default:
        return "";
    }
  }, [type, advancedMode, nameDest]);

  // Compute balances
  const amountNum = parseFloat(amount) || 0;
  const formattedAmount = useMemo(() => formatAmountDisplay(amount), [amount]);

  const oldbalanceDest =
    advancedMode && manualOldBalanceDest !== ""
      ? parseFloat(manualOldBalanceDest) || 0
      : (destBalances[computedNameDest] ?? 0);

  const newbalanceOrig = useMemo(() => {
    if (type === "CASH IN") {
      return oldbalanceOrg + amountNum;
    }
    return Math.max(oldbalanceOrg - amountNum, 0);
  }, [type, oldbalanceOrg, amountNum]);

  const newbalanceDest = useMemo(() => {
    // For simplicity, CASH OUT doesn't reduce agent balance
    if (type === "CASH OUT") {
      return oldbalanceDest;
    }
    return oldbalanceDest + amountNum;
  }, [type, oldbalanceDest, amountNum]);

  // Validation
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (step < 1) {
      newErrors.step = "Time step must be at least 1";
    }
    if (!type) {
      newErrors.type = "Please select an event type";
    }
    if (!nameOrig) {
      newErrors.nameOrig = "Please select a sender account";
    }
    if (!amount || amountNum <= 0) {
      newErrors.amount = "Amount must be greater than $0";
    }
    if (
      !allowNegativeBalance &&
      adminSettings.blockInsufficientBalance &&
      type !== "CASH IN" &&
      amountNum > oldbalanceOrg
    ) {
      newErrors.amount = `Insufficient balance. Available: ${formatCurrency(oldbalanceOrg)}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Focus first error field
  useEffect(() => {
    if (Object.keys(errors).length > 0 && errorSummaryRef.current) {
      errorSummaryRef.current.focus();
    }
  }, [errors]);

  const handlePresetSelect = (preset: TransactionPreset) => {
    const account = DEFAULT_ORIGIN_ACCOUNTS[preset.originAccountIndex];
    setType(preset.type);
    setNameOrig(account.id);
    setAmount(preset.amount.toString());
    if (preset.customNameDest) {
      setAdvancedMode(true);
      setNameDest(preset.customNameDest);
    }
    setErrors({});
  };

  const handleAmountChange = useCallback(
    (value: string) => {
      setAmount(parseAmountInput(value));
    },
    [setAmount],
  );

  const handleReset = () => {
    setStep(getLastStep() + 1);
    setType("");
    setNameOrig("");
    setAmount("");
    setNameDest("");
    setAdvancedMode(false);
    setAllowNegativeBalance(false);
    setManualOldBalanceDest("");
    setErrors({});
    setShowUserConfirmation(false);
    setShowStepUpOTP(false);
    setNotificationStatus(null);
    setPendingMediumTransactionData(null);
    setPendingTransactionData(null);
  };

  const finalizeTransaction = useCallback(
    async (transaction: Transaction) => {
      const persistedTransaction = await createTransaction(transaction);

      const shouldApplyBalances =
        persistedTransaction.decision === "APPROVE" ||
        persistedTransaction.decision === "APPROVE_AFTER_STEPUP";

      if (shouldApplyBalances) {
        updateOriginAccount(
          persistedTransaction.nameOrig,
          persistedTransaction.newbalanceOrig,
        );
        updateDestinationBalance(
          persistedTransaction.nameDest,
          persistedTransaction.newbalanceDest,
        );
      }

      setLastStep(persistedTransaction.step);
      setPendingTransaction(persistedTransaction);
      navigate("/result");
    },
    [navigate],
  );

  const handleProcessingComplete = useCallback(() => {
    const persistAndNavigate = async () => {
      try {
        if (pendingTransactionData) {
          await finalizeTransaction(pendingTransactionData);
        }
      } catch (error) {
        setErrors({
          submit: `Could not save transaction: ${extractApiErrorMessage(
            error,
            "Unknown error",
          )}`,
        });
      } finally {
        setShowProcessingModal(false);
        setIsSubmitting(false);
      }
    };

    void persistAndNavigate();
  }, [finalizeTransaction, pendingTransactionData]);

  const buildTransactionCandidate = useCallback(async (): Promise<Transaction> => {
    const finalNameDest = computedNameDest;
    const isFlaggedFraud = computeIsFlaggedFraud(
      type as TransactionType,
      amountNum,
      adminSettings,
    );

    try {
      const apiResponse = await predictPrimary({
        step: step,
        type: type as string,
        amount: amountNum,
        oldbalanceOrg: oldbalanceOrg,
        newbalanceOrig: newbalanceOrig,
        oldbalanceDest: oldbalanceDest,
        newbalanceDest: newbalanceDest,
      });

      const riskScore = Math.round(apiResponse.probability * 100);
      const modelReasons: string[] = [];
      appendUniqueReason(modelReasons, `Risk Level: ${apiResponse.risk_level}`);

      if (apiResponse.risk_factors && apiResponse.risk_factors.length > 0) {
        for (const rf of apiResponse.risk_factors.slice(0, 3)) {
          appendUniqueReason(modelReasons, rf.factor);
        }
      } else {
        appendUniqueReason(modelReasons, simplifyModelExplanation(apiResponse.explanation));
      }

      if (isFlaggedFraud) {
        appendUniqueReason(modelReasons, "Matches legacy fraud patterns.");
      }

      return {
        id: crypto.randomUUID(),
        step,
        type: type as TransactionType,
        amount: amountNum,
        nameOrig,
        oldbalanceOrg,
        newbalanceOrig,
        nameDest: finalNameDest,
        oldbalanceDest,
        newbalanceDest,
        isFraud: apiResponse.is_fraud ? 1 : 0,
        isFlaggedFraud,
        riskScore,
        decision: 'APPROVE',
        status: 'approved',
        reasons: modelReasons,
        backendRiskLevel: apiResponse.risk_level,
        backendExplanation: apiResponse.explanation,
        modelScores: apiResponse.model_scores,
        modelsUsed: apiResponse.models_used,
        createdAt: new Date().toISOString(),
      };
    } catch (error: any) {
      if (error?.request && !error?.response) {
        const fallbackResult = scoreTransaction(
          {
            type: type as TransactionType,
            amount: amountNum,
            oldbalanceOrg,
            newbalanceOrig,
            oldbalanceDest,
            newbalanceDest,
            isFlaggedFraud,
          },
          adminSettings,
        );

        const fallbackRiskLevel = formatBackendRiskLevel(
          getRiskLevel(fallbackResult.riskScore),
        );

        return {
          id: crypto.randomUUID(),
          step,
          type: type as TransactionType,
          amount: amountNum,
          nameOrig,
          oldbalanceOrg,
          newbalanceOrig,
          nameDest: finalNameDest,
          oldbalanceDest,
          newbalanceDest,
          isFraud: fallbackResult.decision === 'BLOCK' ? 1 : 0,
          isFlaggedFraud,
          riskScore: Math.round(fallbackResult.riskScore * 100),
          decision: 'APPROVE',
          status: 'approved',
          reasons: [
            'AI backend unavailable - using local demo risk rules.',
            ...fallbackResult.reasons,
          ],
          backendRiskLevel: fallbackRiskLevel,
          backendExplanation:
            'The live backend was unavailable, so local rules were used for routing.',
          createdAt: new Date().toISOString(),
        };
      }

      const responseDetail =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        'Could not connect to the AI backend.';
      throw new Error(String(responseDetail));
    }
  }, [
    adminSettings,
    amountNum,
    computedNameDest,
    nameOrig,
    newbalanceDest,
    newbalanceOrig,
    oldbalanceDest,
    oldbalanceOrg,
    step,
    type,
  ]);

  const queueTransactionForPersistence = useCallback((transaction: Transaction) => {
    setPendingTransactionData(transaction);
    setShowProcessingModal(true);
    setIsSubmitting(true);
  }, []);

  const handleStepUpOTPSuccess = useCallback(() => {
    if (!pendingMediumTransactionData) return;

    const reasons = pendingMediumTransactionData.reasons.includes(
      'User confirmed transaction and OTP verification passed.',
    )
      ? pendingMediumTransactionData.reasons
      : [
          ...pendingMediumTransactionData.reasons,
          'User confirmed transaction and OTP verification passed.',
        ];

    const approvedAfterOtp: Transaction = {
      ...pendingMediumTransactionData,
      decision: 'APPROVE_AFTER_STEPUP',
      status: 'approved',
      reviewState: undefined,
      reasons,
    };

    setShowStepUpOTP(false);
    setPendingMediumTransactionData(null);
    setErrors({});
    queueTransactionForPersistence(approvedAfterOtp);
  }, [pendingMediumTransactionData, queueTransactionForPersistence]);

  const handleStepUpOTPFail = useCallback(() => {
    if (!pendingMediumTransactionData) return;

    const blockedAfterOtp: Transaction = {
      ...pendingMediumTransactionData,
      decision: 'BLOCK_STEPUP_FAILED',
      status: 'blocked',
      reviewState: undefined,
      isFraud: 1,
      reasons: [
        ...pendingMediumTransactionData.reasons,
        'OTP verification failed after user confirmation.',
      ],
    };

    setShowStepUpOTP(false);
    setPendingMediumTransactionData(null);
    setErrors({});
    queueTransactionForPersistence(blockedAfterOtp);
  }, [pendingMediumTransactionData, queueTransactionForPersistence]);

  const handleStepUpOTPCancel = useCallback(() => {
    if (!pendingMediumTransactionData) return;

    const blockedTransaction: Transaction = {
      ...pendingMediumTransactionData,
      decision: 'BLOCK',
      status: 'blocked',
      reviewState: undefined,
      isFraud: 1,
      riskScore: 100,
      reasons: [
        ...pendingMediumTransactionData.reasons,
        'OTP verification was cancelled',
      ],
      backendRiskLevel: 'High',
      backendExplanation:
        'Transaction blocked because OTP verification was cancelled.',
    };

    setShowStepUpOTP(false);
    setPendingMediumTransactionData(null);
    setErrors({});
    queueTransactionForPersistence(blockedTransaction);
  }, [pendingMediumTransactionData, queueTransactionForPersistence]);

  const handleMediumConfirmationYes = useCallback(async () => {
    if (!pendingMediumTransactionData) return;

    setShowUserConfirmation(false);
    setErrors({});

    try {
      await sendUserOtpEmail({
        otp_code: APP_OTP_CODE,
        amount: pendingMediumTransactionData.amount,
        transaction_type: pendingMediumTransactionData.type,
      });
      setNotificationStatus('OTP email sent via mail service. Please check inbox.');
    } catch (error) {
      setErrors({
        submit: extractApiErrorMessage(
          error,
          'OTP email could not be sent via mail service.',
        ),
      });
      setShowUserConfirmation(true);
      return;
    }

    setShowStepUpOTP(true);
  }, [pendingMediumTransactionData]);

  const handleMediumConfirmationNo = useCallback(() => {
    if (!pendingMediumTransactionData) return;

    const blockedTransaction: Transaction = {
      ...pendingMediumTransactionData,
      decision: 'BLOCK',
      status: 'blocked',
      reviewState: undefined,
      isFraud: 1,
      reasons: [
        ...pendingMediumTransactionData.reasons,
        'User denied transaction during confirmation step.',
      ],
      backendExplanation:
        'Transaction blocked because the user denied ownership.',
    };

    setShowUserConfirmation(false);
    setPendingMediumTransactionData(null);
    setErrors({});
    queueTransactionForPersistence(blockedTransaction);
  }, [pendingMediumTransactionData, queueTransactionForPersistence]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setErrors({});
    setNotificationStatus(null);
    setIsSubmitting(true);

    try {
      const candidate = await buildTransactionCandidate();
      const riskBucket = getRiskBucket(
        candidate.riskScore,
        candidate.backendRiskLevel,
      );
      const requiresAdminReview = riskBucket === 'high';

      if (requiresAdminReview) {
        const reasons = [...candidate.reasons];

        if (riskBucket === 'high') {
          reasons.push('High-risk transaction routed to Admin Review Queue.');
        }

        queueTransactionForPersistence({
          ...candidate,
          decision: 'PENDING_ADMIN_REVIEW',
          status: 'pending_review',
          reviewState: 'PENDING_ADMIN_REVIEW',
          isFraud: 0,
          reasons,
        });
        return;
      }

      if (riskBucket === 'medium') {
        try {
          await sendUserConfirmationEmail({
            amount: candidate.amount,
            transaction_type: candidate.type,
            recipient_account: candidate.nameDest,
          });
          setNotificationStatus(
            'User confirmation email sent via mail service. Please confirm in the flow below.',
          );
        } catch (error) {
          setErrors({
            submit: extractApiErrorMessage(
              error,
              'Could not send user confirmation email via mail service.',
            ),
          });
          setIsSubmitting(false);
          return;
        }

        setPendingMediumTransactionData({
          ...candidate,
          decision: 'STEP_UP',
          status: undefined,
          reviewState: undefined,
        });
        setShowUserConfirmation(true);
        setIsSubmitting(false);
        return;
      }

      queueTransactionForPersistence({
        ...candidate,
        decision: 'APPROVE',
        status: 'approved',
        reviewState: undefined,
      });
    } catch (error) {
      setErrors({
        submit: extractApiErrorMessage(
          error,
          'Could not process transaction decision flow.',
        ),
      });
      setIsSubmitting(false);
    }
  };

  const isValid = type && nameOrig && amountNum > 0 && step >= 1;

  return (
    <>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="space-y-4 sm:space-y-6"
        noValidate
      >
        {/* Help Callout */}
        <SimulatorHelpCallout />

        {/* Error Summary */}
        {Object.keys(errors).length > 0 && (
          <div
            ref={errorSummaryRef}
            className="bg-danger-muted border border-danger/20 rounded-lg p-4"
            role="alert"
            aria-live="polite"
            tabIndex={-1}
          >
            <p className="font-medium text-danger mb-2">
              Please fix the following errors:
            </p>
            <ul className="list-disc list-inside text-sm text-danger space-y-1">
              {Object.entries(errors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        {notificationStatus && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
            {notificationStatus}
          </div>
        )}

        <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 sm:gap-6">
          {/* Left Column - Form */}
          <div className="min-w-0 space-y-4 sm:space-y-6">
            {/* Section 1: WHO - Account Selection with Wallet Preview */}
            <fieldset className="form-fieldset">
              <legend className="form-legend">1. Sender</legend>

              <div className="space-y-4">
                <AccountSelector
                  accounts={originAccounts}
                  selectedId={nameOrig}
                  onSelect={setNameOrig}
                  disabled={isSubmitting}
                />

                {/* Wallet Widget - shows when account is selected */}
                {selectedOrigin && (
                  <WalletWidget
                    accountName={selectedOrigin.displayName}
                    currentBalance={oldbalanceOrg}
                    amount={amountNum}
                    transactionType={type}
                  />
                )}
              </div>
            </fieldset>

            {/* Section 2: WHAT - Transaction Type & Amount */}
            <fieldset className="form-fieldset">
                <legend className="form-legend">2. Type of Transaction</legend>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Event Type</Label>
                  <Select
                    value={type}
                    onValueChange={(v) => setType(v as TransactionType)}
                  >
                    <SelectTrigger
                      id="type"
                      aria-describedby={errors.type ? "type-error" : undefined}
                      aria-invalid={!!errors.type}
                    >
                      <SelectValue placeholder="Select event type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSACTION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="font-medium">
                            {EVENT_TYPE_LABELS[t.value]}
                          </span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            ({t.value})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.type && (
                    <p id="type-error" className="text-sm text-danger">
                      {errors.type}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="amount"
                      type="text"
                      inputMode="decimal"
                      value={formattedAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="0.00"
                      className="pl-9"
                      aria-describedby={
                        errors.amount ? "amount-error" : "amount-hint"
                      }
                      aria-invalid={!!errors.amount}
                    />
                  </div>
                  {errors.amount ? (
                    <p id="amount-error" className="text-sm text-danger">
                      {errors.amount}
                    </p>
                  ) : (
                    <p
                      id="amount-hint"
                      className="text-xs text-muted-foreground"
                    >
                      Enter the transaction amount in USD
                    </p>
                  )}
                </div>
              </div>
            </fieldset>

            {/* Section 3: WHERE - Destination (mostly auto-generated) */}
            <fieldset className="form-fieldset">
              <legend className="form-legend">3. To</legend>

              <div className="space-y-2">
                <Label htmlFor="nameDest">Recipient / Merchant</Label>
                {advancedMode ? (
                  <Input
                    id="nameDest"
                    value={nameDest}
                    onChange={(e) => setNameDest(e.target.value)}
                    placeholder={computedNameDest || "Enter recipient..."}
                  />
                ) : (
                  <Input
                    id="nameDest"
                    value={computedNameDest}
                    readOnly
                    className="bg-muted font-mono"
                    aria-describedby="nameDest-hint"
                  />
                )}
                <p id="nameDest-hint" className="text-xs text-muted-foreground">
                  {advancedMode
                    ? "Enter custom recipient"
                    : "Auto-generated based on event type"}
                </p>
              </div>
            </fieldset>

            {/* Advanced Mode */}
            <div className="section-card">
              <button
                type="button"
                className="flex items-center justify-between w-full text-left"
                onClick={() => setAdvancedMode(!advancedMode)}
                aria-expanded={advancedMode}
                aria-controls="advanced-options"
              >
                <span className="font-medium">Advanced Options</span>
                {advancedMode ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {advancedMode && (
                <div
                  id="advanced-options"
                  className="mt-4 space-y-4 pt-4 border-t border-border"
                >
                  {/* Time Step Override */}
                  <div className="space-y-2">
                    <Label htmlFor="step" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      Time Step (Hours since start)
                    </Label>
                    <Input
                      id="step"
                      type="number"
                      min={1}
                      value={step}
                      onChange={(e) => setStep(parseInt(e.target.value) || 1)}
                      aria-describedby={
                        errors.step ? "step-error" : "step-hint"
                      }
                      aria-invalid={!!errors.step}
                    />
                    {errors.step ? (
                      <p id="step-error" className="text-sm text-danger">
                        {errors.step}
                      </p>
                    ) : (
                      <TimeStepBadge step={step} className="mt-1" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manualOldBalanceDest">
                      Override Recipient Starting Balance
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="manualOldBalanceDest"
                        type="number"
                        min={0}
                        value={manualOldBalanceDest}
                        onChange={(e) =>
                          setManualOldBalanceDest(e.target.value)
                        }
                        placeholder={oldbalanceDest.toString()}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="allowNegative">
                        Allow insufficient balance
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Bypass balance check for testing edge cases
                      </p>
                    </div>
                    <Switch
                      id="allowNegative"
                      checked={allowNegativeBalance}
                      onCheckedChange={setAllowNegativeBalance}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Presets */}
          <div className="min-w-0">
            <PresetButtons
              onSelect={handlePresetSelect}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Sticky Bottom Bar */}
        <div className="sticky-bottom-bar">
          <div className="max-w-6xl mx-auto px-4 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
              Reset
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="w-full sm:w-auto sm:min-w-[160px]"
            >
              {isSubmitting ? (
                "Processing..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" aria-hidden="true" />
                  Submit Transaction
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Spacer for sticky bar */}
        <div className="h-20" aria-hidden="true" />
      </form>

      {/* Processing Modal */}
      <ProcessingModal
        isOpen={showProcessingModal}
        onComplete={handleProcessingComplete}
      />

      {showUserConfirmation && pendingMediumTransactionData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-confirmation-title"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg mx-4 bg-card rounded-xl shadow-xl border border-border p-6 sm:p-8 animate-fade-in space-y-4">
            <h2
              id="user-confirmation-title"
              className="text-xl sm:text-2xl font-bold text-foreground"
            >
              User Confirmation Required
            </h2>
            <p className="text-sm text-muted-foreground">
              Medium-risk transaction detected. A confirmation email was sent to
              the user with the question:
            </p>
            <p className="text-sm font-medium rounded-md border border-border bg-muted/30 p-3">
              Is this transaction being performed by you?
            </p>
            <p className="text-xs text-muted-foreground">
              If the user confirms yes, OTP verification is required. If
              no, the transaction is blocked immediately.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                type="button"
                variant="destructive"
                onClick={handleMediumConfirmationNo}
              >
                No, this is not me
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void handleMediumConfirmationYes();
                }}
              >
                Yes, this is me
              </Button>
            </div>
          </div>
        </div>
      )}

      {showStepUpOTP && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="otp-precheck-title"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-md mx-4 bg-card rounded-xl shadow-xl border border-border p-6 sm:p-8 animate-fade-in">
            <div className="text-center mb-4">
              <h2
                id="otp-precheck-title"
                className="text-xl sm:text-2xl font-bold text-foreground"
              >
                OTP Verification
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Medium-risk transaction was user-confirmed. OTP verification is now required to proceed.
              </p>
            </div>

            <OTPChallenge
              onSuccess={handleStepUpOTPSuccess}
              onFail={handleStepUpOTPFail}
              onCancel={handleStepUpOTPCancel}
            />
          </div>
        </div>
      )}
    </>
  );
}

