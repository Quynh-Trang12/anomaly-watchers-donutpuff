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
  saveTransaction,
  getAdminSettings,
  setPendingTransaction,
} from "@/lib/storage";
import { computeIsFlaggedFraud } from "@/lib/scoring";
import { predictPrimary } from "@/api";
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
  const [pendingTransactionData, setPendingTransactionData] =
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
  };

  const handleProcessingComplete = useCallback(() => {
    if (pendingTransactionData) {
      // Save transaction
      saveTransaction(pendingTransactionData);

      // Update balances
      updateOriginAccount(
        pendingTransactionData.nameOrig,
        pendingTransactionData.newbalanceOrig,
      );
      updateDestinationBalance(
        pendingTransactionData.nameDest,
        pendingTransactionData.newbalanceDest,
      );

      // Update last step
      setLastStep(pendingTransactionData.step);

      // Store pending transaction for result page
      setPendingTransaction(pendingTransactionData);

      // Navigate to result
      navigate("/result");
    }
    setShowProcessingModal(false);
    setIsSubmitting(false);
  }, [pendingTransactionData, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const finalNameDest = computedNameDest;
      const isFlaggedFraud = computeIsFlaggedFraud(
        type as TransactionType,
        amountNum,
        adminSettings,
      );

      // --- AI INTEGRATION ---
      // Call the Python Backend (FastAPI + XGBoost)
      console.log("Calling Backend API...");
      const apiResponse = await predictPrimary({
        step: step,
        type: type as string,
        amount: amountNum,
        oldbalanceOrg: oldbalanceOrg,
        newbalanceOrig: newbalanceOrig,
        oldbalanceDest: oldbalanceDest,
        newbalanceDest: newbalanceDest,
      });

      // Map Backend Response to Frontend Types
      // API returns probability as 0-1, we convert to percentage
      const riskScore = Math.round(apiResponse.probability * 100);
      const isFraud = apiResponse.is_fraud;
      const riskLevel = apiResponse.risk_level;

      let decision: "APPROVE" | "STEP_UP" | "BLOCK" = "APPROVE";
      if (riskScore > 80) decision = "BLOCK";
      else if (riskScore > 40) decision = "STEP_UP";

      // Create Reasons List — use structured XAI factors from the backend
      const modelReasons = [
        `AI Risk Probability: ${riskScore}%`,
        `Risk Level: ${riskLevel}`,
      ];

      // Append structured risk factors from the backend XAI engine
      if (apiResponse.risk_factors && apiResponse.risk_factors.length > 0) {
        for (const rf of apiResponse.risk_factors) {
          modelReasons.push(rf.factor);
        }
      }

      if (isFlaggedFraud)
        modelReasons.push("Matches Legacy Fraud Patterns (Rule-based)");

      const transaction: Transaction = {
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
        isFraud: isFraud ? 1 : 0,
        isFlaggedFraud,
        riskScore: riskScore,
        decision: decision,
        reasons: modelReasons,
        createdAt: new Date().toISOString(),
      };

      // Store transaction data and show processing modal
      setPendingTransactionData(transaction);
      setShowProcessingModal(true);
    } catch (error: any) {
      console.error("API Error:", error);

      let errorMessage = "Could not connect to the AI backend.";

      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage = `Server Error (${error.response.status}): ${
          error.response.data?.detail || error.response.statusText
        }`;
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage =
          "No response from AI backend. Check if the server is running.";
      } else {
        errorMessage = `Request Error: ${error.message}`;
      }

      setErrors({
        submit: errorMessage,
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

        <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 sm:gap-6">
          {/* Left Column - Form */}
          <div className="min-w-0 space-y-4 sm:space-y-6">
            {/* Section 1: WHO - Account Selection with Wallet Preview */}
            <fieldset className="form-fieldset">
              <legend className="form-legend">1. Who is Sending?</legend>

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
              <legend className="form-legend">
                2. What Type of Transaction?
              </legend>

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
                      type="number"
                      min={0}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
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
                      Enter the transaction amount in USD (simulated)
                    </p>
                  )}
                </div>
              </div>
            </fieldset>

            {/* Section 3: WHERE - Destination (mostly auto-generated) */}
            <fieldset className="form-fieldset">
              <legend className="form-legend">3. Where is it Going?</legend>

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
    </>
  );
}
