import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
import { Send, Wallet, ArrowRightLeft, Landmark, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { formatCurrencyToUSD } from "@/lib/utils";
import { useEffect } from "react";
import { getUserBalance, predictPrimary, TransactionInput, getUserOwnTransactions } from "@/api";
import { useAuth, MOCK_USERS } from "@/context/AuthContext";
import { calculateLocalRiskScore } from "@/lib/scoring";
import { TimeStepBadge } from "./TimeStepBadge";
import { Activity } from "lucide-react";

interface TransactionFormProps {
  onTransactionApproved?: () => void;
  refreshTrigger?: number;
}

export function TransactionForm({ onTransactionApproved, refreshTrigger }: TransactionFormProps) {
  const navigate = useNavigate();
  const { userId } = useAuth();

  const [type, setType] = useState<string>("TRANSFER");
  const [amountRawValue, setAmountRawValue] = useState<string>("");
  const [amountDisplayValue, setAmountDisplayValue] = useState<string>("");
  const [senderAccount, setSenderAccount] = useState<string>(userId || MOCK_USERS[0].id);
  const [receiverAccount, setReceiverAccount] = useState<string>("");
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<number>(1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [balanceData, history] = await Promise.all([
          getUserBalance(senderAccount),
          getUserOwnTransactions(senderAccount, senderAccount)
        ]);
        setCurrentBalance(balanceData.balance);

        if (history && history.length > 0) {
          const maxStep = Math.max(0, ...history.map((t: any) => Number(t.step) || 0));
          setStep(maxStep + 1);
        }
      } catch (error) {
        console.error("Failed to fetch initialization data:", error);
      }
    };
    fetchData();
  }, [senderAccount, refreshTrigger]);

  const handleAmountInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Strip everything except digits and one decimal point
    const raw_input = event.target.value.replace(/[^0-9.]/g, "");

    // Enforce maximum two decimal places
    const decimal_parts = raw_input.split(".");
    if (decimal_parts.length > 2) return; // Reject multiple decimal points
    if (decimal_parts[1]?.length > 2) return; // Reject more than 2 decimal places

    setAmountRawValue(raw_input);

    // Format integer part with commas, preserve decimal portion as-is during typing
    if (raw_input === "" || raw_input === ".") {
      setAmountDisplayValue(raw_input);
      return;
    }

    const integer_part = decimal_parts[0];
    const formatted_integer = integer_part ? parseInt(integer_part, 10).toLocaleString("en-US") : "0";
    const decimal_suffix = decimal_parts.length === 2 ? "." + decimal_parts[1] : "";
    setAmountDisplayValue(formatted_integer + decimal_suffix);
  };

  const parsed_amount_for_preview = parseFloat(amountRawValue) || 0;
  const projected_balance = currentBalance - parsed_amount_for_preview;
  const is_insufficient_funds = parsed_amount_for_preview > currentBalance;
  const is_low_balance_warning = projected_balance < 1000 && projected_balance >= 0;

  const validate_transaction_form = (): string | null => {
    const parsed_amount = parseFloat(amountRawValue);

    // Rule 1: Amount must be a positive number
    if (isNaN(parsed_amount) || parsed_amount <= 0) {
      return "Please enter a valid transfer amount greater than $0.00.";
    }

    // Rule 2: Amount must not exceed current balance
    if (parsed_amount > currentBalance) {
      return `This amount exceeds your available balance of ${formatCurrencyToUSD(currentBalance)}.`;
    }

    // Rule 3: Destination account must not be the same as the sender
    if (receiverAccount === senderAccount) {
      return "You cannot transfer money to your own account. Please select a different recipient.";
    }

    // Rule 4: Destination account must be provided
    if (!receiverAccount) {
      return "Please select a receiver account.";
    }

    // Rule 5: Amount must be greater than $0.01 (minimum transaction)
    if (parsed_amount < 0.01) {
      return "The minimum transfer amount is $0.01.";
    }

    // New Rule: Step must be a positive integer
    if (!step || !Number.isInteger(step) || step < 1) {
      return "Simulation step must be a positive integer (>= 1).";
    }

    return null; // All validations passed
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation_error_message = validate_transaction_form();
    if (validation_error_message) {
      toast.error(validation_error_message);
      return;
    }

    const parsed_amount = parseFloat(amountRawValue);
    setIsSubmitting(true);
    try {
      const transaction_payload: TransactionInput = {
        type: type,
        amount: parsed_amount,
        oldbalanceOrg: currentBalance,
        newbalanceOrig: currentBalance - parsed_amount,
        oldbalanceDest: 0,
        newbalanceDest: parsed_amount,
        user_id: senderAccount,
        destination_account_id: receiverAccount,
        step: step
      };
      const prediction_result = await predictPrimary(transaction_payload);

      if (prediction_result.status === "APPROVED") {
        onTransactionApproved?.();
        // Optimistically increment step if refresh is delayed
        setStep(prev => prev + 1);
      }

      // Navigate to results with the prediction data
      navigate("/result", {
        state: {
          prediction: prediction_result,
          originalData: {
            type,
            amount: parsed_amount,
            sender: senderAccount, // Explicitly pass the selected sender for finalization consistency
            targetAccount: receiverAccount,
            oldbalanceOrig: currentBalance
          }
        }
      });
    } catch (submission_error: unknown) {
      if (axios.isAxiosError(submission_error)) {
        // Handle network errors or server downtime with Local Fallback
        if (!submission_error.response) {
          const local_prediction = calculateLocalRiskScore({
            type,
            amount: parsed_amount,
            oldbalanceOrg: currentBalance,
            newbalanceOrig: currentBalance - parsed_amount,
            oldbalanceDest: 0,
            newbalanceDest: parsed_amount,
            user_id: senderAccount,
            destination_account_id: receiverAccount,
            step
          });
          toast.warning("AI backend unavailable - using local demo risk rules.");

          navigate("/result", {
            state: {
              prediction: local_prediction,
              isFallback: true,
              originalData: {
                type,
                amount: parsed_amount,
                targetAccount: receiverAccount,
                oldbalanceOrig: currentBalance
              }
            }
          });
          return;
        }

        const error_detail = submission_error.response?.data?.detail;
        if (error_detail?.includes("not found in internal network")) {
          toast.error("Recipient account does not exist in our network. Please verify the account ID.");
        } else if (submission_error.response?.status === 422) {
          toast.error("Transaction data is invalid. Please check your input values.");
        } else if (submission_error.response?.status === 503) {
          toast.error("Fraud detection service is temporarily unavailable. Please try again.");
        } else {
          toast.error(`Transaction failed: ${error_detail || "An unexpected error occurred."}`);
        }
      } else {
        toast.error("Cannot connect to the AnomalyWatchers server. Is the backend running?");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Transaction Setup */}
      <div className="lg:col-span-2 bg-card border rounded-3xl p-8 shadow-sm">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6 text-primary" />
          Seamless Money Transfer
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Row 1: Account Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Sender Account</Label>
              <Select value={senderAccount} onValueChange={setSenderAccount}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select sender..." />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_USERS.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Receiver Account</Label>
              <Select value={receiverAccount} onValueChange={setReceiverAccount}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select receiver..." />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_USERS.map((user) => (
                    <SelectItem
                      key={user.id}
                      value={user.id}
                      disabled={user.id === senderAccount}
                      className={user.id === senderAccount ? "opacity-50" : ""}
                    >
                      {user.name} ({user.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Transaction Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRANSFER">P2P Transfer (TRANSFER)</SelectItem>
                  <SelectItem value="CASH_OUT">Cash Withdrawal (CASH_OUT)</SelectItem>
                  <SelectItem value="CASH_IN">Cash Deposit (CASH_IN)</SelectItem>
                  <SelectItem value="PAYMENT">Merchant Payment (PAYMENT)</SelectItem>
                  <SelectItem value="DEBIT">Bank Debit (DEBIT)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountDisplayValue}
                  onChange={handleAmountInputChange}
                  className={`h-12 pl-10 text-xl font-bold rounded-xl bg-muted/30 w-full border px-3 focus-visible:ring-2 focus-visible:ring-ring ${is_insufficient_funds ? 'border-danger focus-visible:ring-danger' : 'border-input'}`}
                  required
                  aria-label="Transaction amount in USD"
                />
              </div>
            </div>
          </div>

          {/* Live Balance Preview */}
          <div className="mt-4 p-4 rounded-xl bg-muted/20 border border-dashed text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-muted-foreground">Original Balance:</span>
              <span className="font-mono">{formatCurrencyToUSD(currentBalance)}</span>
            </div>
            <div className="flex justify-between items-center font-bold">
              <span className={is_insufficient_funds ? "text-danger" : is_low_balance_warning ? "text-warning" : "text-success"}>
                Projected Balance:
              </span>
              <span className={`font-mono ${is_insufficient_funds ? "text-danger" : is_low_balance_warning ? "text-warning" : "text-success"}`}>
                {formatCurrencyToUSD(projected_balance)}
              </span>
            </div>

            <AnimatePresence>
              {is_insufficient_funds && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-bold text-danger mt-2"
                >
                  This amount exceeds your available balance of {formatCurrencyToUSD(currentBalance)}.
                </motion.p>
              )}
              {!is_insufficient_funds && is_low_balance_warning && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-bold text-warning mt-2"
                >
                  Warning: This will leave you with a low balance (under $1,000.00).
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Simulation Context Section */}
          <div className="bg-muted/30 border border-dashed rounded-3xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
                <Activity className="h-4 w-4" />
                Simulation Context
              </h3>
              <TimeStepBadge step={step} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="step-input" className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">
                Step Input
              </Label>
              <Input
                id="step-input"
                type="number"
                min="1"
                step="1"
                value={step || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setStep(1); // Default to 1 if empty
                    return;
                  }
                  setStep(parseInt(val, 10));
                }}
                className="h-12 rounded-xl font-mono text-lg font-bold bg-background/50 border-muted"
                placeholder="Enter simulation step..."
              />
              <p className="text-[10px] text-muted-foreground italic">
                The step drives cyclical time encoding in the ML model. Next default: max(step) + 1.
              </p>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-16 rounded-2xl text-lg font-bold gap-3 shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {isSubmitting ? "Securing Transaction..." : <><Send className="h-5 w-5" /> Execute Transfer</>}
          </Button>
        </form>
      </div>

      {/* Wallet Info Column */}
      <div className="space-y-6">
        <div className="bg-primary text-primary-foreground rounded-3xl p-8 shadow-xl relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Wallet className="h-40 w-40" />
          </div>
          <div className="relative">
            <p className="text-primary-foreground/70 text-sm font-medium mb-1 uppercase tracking-wider">Current Balance</p>
            <h3 className="text-4xl font-black mb-6">{formatCurrencyToUSD(currentBalance)}</h3>

            <div className="flex items-center gap-4 text-sm font-medium">
              <div className="bg-white/20 px-3 py-1 rounded-full flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" /> Active
              </div>
              <p className="text-primary-foreground/60 font-mono">
                {MOCK_USERS.find(u => u.id === senderAccount)?.name || senderAccount} ({senderAccount})
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-3xl p-6">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <Landmark className="h-4 w-4" /> Security Status
          </h4>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 text-success rounded-lg">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold">2FA Enabled</p>
                <p className="text-xs text-muted-foreground">Biometric primary authentication</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
