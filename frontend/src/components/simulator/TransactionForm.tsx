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
import { Send, Wallet, ArrowRightLeft, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatCurrencyToUSD } from "@/lib/utils";
import { useEffect } from "react";
import { getUserBalance, predictPrimary, TransactionInput } from "@/api";
import { useAuth, MOCK_USERS } from "@/context/AuthContext";

interface TransactionFormProps {
  onTransactionApproved?: () => void;
  refreshTrigger?: number;
}

export function TransactionForm({ onTransactionApproved, refreshTrigger }: TransactionFormProps) {
  const navigate = useNavigate();
  const { userId, setUserId, setHasActivelySelectedUser } = useAuth();
  
  const [type, setType] = useState<string>("TRANSFER");
  const [amountRawValue, setAmountRawValue] = useState<string>("");
  const [amountDisplayValue, setAmountDisplayValue] = useState<string>("");
  const [targetAccount, setTargetAccount] = useState("");
  const [senderAccount, setSenderAccount] = useState(userId);
  const [currentBalance, setCurrentBalance] = useState<number>(450000.00);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<number>(0);

  // ─── Sync sender with auth context when user switches ─────────────────────
  useEffect(() => {
    setSenderAccount(userId);
  }, [userId]);

  // ─── Fetch balance for the selected sender account ────────────────────────
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const balanceData = await getUserBalance(senderAccount || "user_1");
        setCurrentBalance(balanceData.balance);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
      }
    };
    fetchBalance();
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

  // ─── Hour of Day Badge Formatting ─────────────────────────────────────────
  const stepDay = Math.floor(step / 24) + 1;
  const stepHourOfDay = step % 24;
  const stepAmPm = stepHourOfDay >= 12 ? "PM" : "AM";
  const stepHour12 = stepHourOfDay === 0 ? 12 : stepHourOfDay > 12 ? stepHourOfDay - 12 : stepHourOfDay;
  const stepBadgeText = `Time Step ${step} = ${String(stepHour12).padStart(2, "0")}:00 ${stepAmPm}, Day ${stepDay}`;

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
    if (targetAccount.trim() === senderAccount) {
      return "You cannot transfer money to your own account. Please enter a different recipient.";
    }

    // Rule 4: Destination account must be provided
    if (!targetAccount.trim()) {
      return "Please enter a recipient account ID.";
    }

    // Rule 5: Amount must be greater than $0.01 (minimum transaction)
    if (parsed_amount < 0.01) {
      return "The minimum transfer amount is $0.01.";
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
        destination_account_id: targetAccount,
        step: step,
      };
      const prediction_result = await predictPrimary(transaction_payload);

      if (prediction_result.status === "APPROVED") {
        onTransactionApproved?.();
      }

      // Navigate to results with the prediction data
      navigate("/result", { 
        state: { 
          prediction: prediction_result, 
          originalData: { 
            type, 
            amount: parsed_amount, 
            targetAccount, 
            oldbalanceOrig: currentBalance 
          } 
        } 
      });
    } catch (submission_error: unknown) {
      if (axios.isAxiosError(submission_error)) {
        const error_detail = submission_error.response?.data?.detail;
        if (error_detail?.includes("not found in internal network")) {
          toast.error("Recipient account does not exist in our network. Please verify the account ID.");
        } else if (submission_error.response?.status === 422) {
          toast.error("Transaction data is invalid. Please check your input values.");
        } else if (submission_error.response?.status === 503) {
          toast.error("Fraud detection service is temporarily unavailable. Please try again.");
        } else if (submission_error.response?.status === 403) {
          toast.error(error_detail || "Account is temporarily frozen. Contact support.");
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
          {/* ─── Row 1: Sender Account | Recipient Account ──────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Sender Account ID</Label>
              <Select value={senderAccount} onValueChange={(newAccount) => {
                setSenderAccount(newAccount);
                setUserId(newAccount);
                setHasActivelySelectedUser(true);
              }}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
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
              <Label>Recipient Account ID</Label>
              <Input 
                placeholder="e.g. user_2" 
                className={`h-12 rounded-xl font-mono ${targetAccount.trim() === senderAccount ? 'border-danger ring-danger' : ''}`}
                value={targetAccount}
                onChange={e => setTargetAccount(e.target.value)}
                required
              />
              {targetAccount.trim() === senderAccount && (
                 <p className="text-xs font-medium text-danger">You cannot transfer money to your own account.</p>
              )}
            </div>
          </div>

          {/* ─── Row 2: Transfer Type ────────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Transfer Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-12 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TRANSFER">P2P Transfer</SelectItem>
                <SelectItem value="CASH OUT">Cash Withdrawal</SelectItem>
                <SelectItem value="CASH IN">Cash Deposit</SelectItem>
                <SelectItem value="PAYMENT">Merchant Payment</SelectItem>
                <SelectItem value="DEBIT">Bank Debit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ─── Row 3: Amount ───────────────────────────────────────────── */}
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
                className={`h-16 pl-10 text-2xl font-bold rounded-2xl bg-muted/30 w-full border px-3 focus-visible:ring-2 focus-visible:ring-ring ${is_insufficient_funds ? 'border-danger focus-visible:ring-danger' : 'border-input'}`}
                required
                aria-label="Transaction amount in USD"
              />
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

      {/* ─── Sidebar: Wallet + Hour of Day ────────────────────────────────── */}
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
              <p className="text-primary-foreground/60">{senderAccount}</p>
            </div>
          </div>
        </div>

        {/* ─── Hour of Day Card (replaces Security Status) ──────────────── */}
        <div className="bg-card border rounded-3xl p-6">
          <h4 className="font-bold mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Hour of Day
          </h4>
          <p className="text-xs text-muted-foreground mb-4">
            Simulates the time of day for this transaction. The fraud detection model uses time patterns — adjust this value for demonstration purposes.
          </p>
          <Input
            type="number"
            min={0}
            max={743}
            step={1}
            value={step}
            onChange={(e) => setStep(Math.max(0, Math.min(743, parseInt(e.target.value) || 0)))}
            className="h-12 rounded-xl font-mono mb-3"
            aria-label="Hour of day simulation step"
          />
          <span className="bg-accent/50 text-accent-foreground font-mono text-sm px-3 py-1 rounded-full inline-block">
            {stepBadgeText}
          </span>
        </div>
      </div>
    </div>
  );
}
