import { useState, useEffect } from "react";
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
import { Send, Wallet, ArrowRightLeft, Clock, Info } from "lucide-react";
import { toast } from "sonner";
import { formatCurrencyToUSD } from "@/lib/utils";
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
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<number>(0);

  // Sync sender with auth context
  useEffect(() => {
    setSenderAccount(userId);
  }, [userId]);

  // Fetch balance for selected account
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const balanceData = await getUserBalance(senderAccount);
        setCurrentBalance(balanceData.balance);
      } catch (error) {
        console.error("Balance fetch error:", error);
      }
    };
    fetchBalance();
  }, [senderAccount, refreshTrigger]);

  const handleAmountInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/[^0-9.]/g, "");
    const parts = raw.split(".");
    if (parts.length > 2 || (parts[1] && parts[1].length > 2)) return;
    
    setAmountRawValue(raw);
    if (raw === "" || raw === ".") {
      setAmountDisplayValue(raw);
    } else {
      const integerPart = parts[0];
      const formattedInteger = integerPart ? parseInt(integerPart, 10).toLocaleString("en-US") : "0";
      const decimalSuffix = parts.length === 2 ? "." + parts[1] : "";
      setAmountDisplayValue(formattedInteger + decimalSuffix);
    }
  };

  const stepDay = Math.floor(step / 24) + 1;
  const stepHourOfDay = step % 24;
  const amPm = stepHourOfDay >= 12 ? "PM" : "AM";
  const displayHour = stepHourOfDay === 0 ? 12 : stepHourOfDay > 12 ? stepHourOfDay - 12 : stepHourOfDay;
  const timeLabel = `${String(displayHour).padStart(2, "0")}:00 ${amPm}`;

  const parsedAmount = parseFloat(amountRawValue) || 0;
  const projectedBalance = currentBalance - parsedAmount;
  const isInsufficient = parsedAmount > currentBalance;
  const isLowBalance = !isInsufficient && projectedBalance < 500 && projectedBalance > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) return toast.error("Enter a valid amount.");
    if (isInsufficient) return toast.error("Insufficient funds in sender account.");
    if (!targetAccount.trim()) return toast.error("Recipient required.");
    if (targetAccount === senderAccount) return toast.error("Self-transfers blocked.");

    setIsSubmitting(true);
    try {
      const payload: TransactionInput = {
        type,
        amount: parsedAmount,
        oldbalanceOrg: currentBalance,
        newbalanceOrig: currentBalance - parsedAmount,
        oldbalanceDest: 0,
        newbalanceDest: parsedAmount,
        user_id: senderAccount,
        destination_account_id: targetAccount,
        step: step,
      };

      const result = await predictPrimary(payload);
      if (result.status === "APPROVED") {
        onTransactionApproved?.();
      }

      navigate("/result", { 
        state: { 
          prediction: result, 
          originalData: { type, amount: parsedAmount, targetAccount, oldbalanceOrig: currentBalance } 
        } 
      });
    } catch (err: any) {
      const msg = err.response?.data?.detail || "System rejected transaction.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="lg:col-span-2 bg-card border rounded-3xl p-8 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <ArrowRightLeft className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black">Dynamic Simulator</h2>
            <p className="text-muted-foreground text-sm font-medium">Test system rules with custom transaction patterns.</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-black text-muted-foreground ml-1">Sender Profile</Label>
              <Select value={senderAccount} onValueChange={(v) => {
                setSenderAccount(v);
                setUserId(v);
                setHasActivelySelectedUser(true);
              }}>
                <SelectTrigger className="h-14 rounded-xl font-bold bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_USERS.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-black text-muted-foreground ml-1">Recipient account</Label>
              <Input 
                placeholder="Target ID (e.g. user_2)" 
                className="h-14 rounded-xl font-bold bg-muted/30 focus-visible:ring-2"
                value={targetAccount}
                onChange={e => setTargetAccount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase font-black text-muted-foreground ml-1">Payment Method Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-14 rounded-xl font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["TRANSFER", "CASH OUT", "CASH IN", "PAYMENT", "DEBIT"].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase font-black text-muted-foreground ml-1">Transaction Value (USD)</Label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-muted-foreground">$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amountDisplayValue}
                onChange={handleAmountInputChange}
                className={`h-20 pl-12 text-3xl font-black rounded-2xl bg-muted/20 w-full border-2 focus:outline-none focus:ring-4 transition-all ${isInsufficient ? 'border-danger/50 focus:ring-danger/20' : 'border-input focus:ring-primary/20'}`}
                required
              />
            </div>
            
            <div className="mt-4 p-5 rounded-2xl bg-muted/10 border border-dashed flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Post-Transaction Estimate</span>
                <span className={`text-xl font-black mt-1 ${isInsufficient ? 'text-danger' : 'text-foreground'}`}>
                  {formatCurrencyToUSD(projectedBalance)}
                </span>
                {isInsufficient && <p className="text-[10px] font-bold text-danger mt-1 uppercase">Warning: Balance will drop below zero</p>}
                {isLowBalance && <p className="text-[10px] font-bold text-warning mt-1 uppercase">Notification: Critical low balance threshold</p>}
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Current Available</span>
                <p className="font-bold">{formatCurrencyToUSD(currentBalance)}</p>
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting || isInsufficient}
            className={`w-full h-16 rounded-2xl text-lg font-black gap-3 shadow-xl transition-all hover:scale-[1.01] active:scale-[0.98] ${isSubmitting ? 'animate-pulse' : ''}`}
          >
            {isSubmitting ? "ML ENGINE ANALYZING..." : <><Send className="h-5 w-5" /> EXECUTE PAYMENT</>}
          </Button>
        </form>
      </motion.div>

      <div className="space-y-6">
        {/* Active Wallet Card */}
        <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-8 -top-8 opacity-20 transform rotate-12 scale-150">
            <Wallet className="h-40 w-40" />
          </div>
          <div className="relative z-10">
            <div className="bg-white/20 inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">Master Ledger Asset</div>
            <p className="text-primary-foreground/60 text-xs font-bold uppercase mb-1">Total Available Balance</p>
            <h3 className="text-4xl font-black mb-10">{formatCurrencyToUSD(currentBalance)}</h3>
            
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-sm font-bold truncate opacity-80">{senderAccount}</p>
            </div>
          </div>
        </div>

        {/* Hour of Day Control */}
        <div className="bg-card border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-primary" />
            <h4 className="font-bold text-sm uppercase tracking-wider">Temporal Simulation</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
            The detection engine performs time-of-day behavioral checks. Adjust the temporal step (0-743) to demonstrate different risk profiles.
          </p>
          <div className="space-y-4">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-black uppercase text-muted-foreground">Step Selection</span>
              <span className="font-mono text-xs font-bold text-primary">ID: {step}</span>
            </div>
            <input
              type="range"
              min={0}
              max={743}
              value={step}
              onChange={(e) => setStep(parseInt(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="p-3 bg-muted/30 rounded-xl border flex flex-col items-center">
              <span className="text-[10px] uppercase font-black text-muted-foreground mb-1">Clock Simulation</span>
              <span className="text-lg font-black text-primary">{timeLabel}</span>
              <span className="text-[10px] font-bold text-muted-foreground">Cycle Day {stepDay}</span>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex gap-4">
          <Info className="h-6 w-6 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every transaction is evaluated across 12 behavioral dimensions using the Donutpuff-RF ensemble model. 
            High-risk profiles may trigger Step-Up authentication.
          </p>
        </div>
      </div>
    </div>
  );
}
