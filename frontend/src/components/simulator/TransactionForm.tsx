import { useState } from "react";
import axios from "axios";
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
import { Send, Wallet, ArrowRightLeft, Landmark, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { formatCurrencyToUSD } from "@/lib/utils";
import { useEffect } from "react";
import { getUserBalance, predictPrimary, TransactionInput } from "@/api";
import { useAuth } from "@/context/AuthContext";

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
  const [targetAccount, setTargetAccount] = useState("");
  const [currentBalance, setCurrentBalance] = useState<number>(450000.00);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const balanceData = await getUserBalance(userId || "user_1");
        setCurrentBalance(balanceData.balance);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
      }
    };
    fetchBalance();
  }, [userId, refreshTrigger]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsed_amount = parseFloat(amountRawValue);
    if (isNaN(parsed_amount) || parsed_amount <= 0) {
      toast.error("Please enter a valid amount greater than $0.00.");
      return;
    }

    setIsSubmitting(true);
    try {
      const transaction_payload: TransactionInput = {
        type: type,
        amount: parsed_amount,
        oldbalanceOrg: currentBalance,
        newbalanceOrig: currentBalance - parsed_amount,
        oldbalanceDest: 0,
        newbalanceDest: parsed_amount,
        user_id: userId || "user_1",
        destination_account_id: targetAccount
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Transfer Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRANSFER">P2P Transfer</SelectItem>
                  <SelectItem value="CASH OUT">Cash Withdrawal</SelectItem>
                  <SelectItem value="PAYMENT">Merchant Payment</SelectItem>
                  <SelectItem value="DEBIT">Bank Debit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Recipient Account ID</Label>
              <Input 
                placeholder="C123456789" 
                className="h-12 rounded-xl font-mono"
                value={targetAccount}
                onChange={e => setTargetAccount(e.target.value)}
                required
              />
            </div>
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
                className="h-16 pl-10 text-2xl font-bold rounded-2xl bg-muted/30 w-full border border-input px-3 focus-visible:ring-2 focus-visible:ring-ring"
                required
                aria-label="Transaction amount in USD"
              />
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

      {/* Wallet Info */}
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
              <p className="text-primary-foreground/60">{userId}</p>
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
