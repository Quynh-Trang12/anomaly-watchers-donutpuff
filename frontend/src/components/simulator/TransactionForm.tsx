import { useState } from "react";
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
import { predictPrimary } from "@/api";
import { useAuth } from "@/context/AuthContext";
import { Send, Wallet, ArrowRightLeft, Landmark, CreditCard } from "lucide-react";
import { toast } from "sonner";

export function TransactionForm() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  
  const [type, setType] = useState<string>("TRANSFER");
  const [amount, setAmount] = useState("");
  const [targetAccount, setTargetAccount] = useState("");
  const [balance, setBalance] = useState("450000.00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await predictPrimary({
        type,
        amount: amountNum,
        oldbalanceOrg: parseFloat(balance),
        newbalanceOrig: parseFloat(balance) - amountNum,
        oldbalanceDest: 0,
        newbalanceDest: amountNum,
        user_id: userId
      });

      // Navigate to results with the prediction data
      navigate("/result", { state: { prediction: result, originalData: { type, amount: amountNum, targetAccount } } });
    } catch (error) {
      toast.error("Prediction engine error. Please check backend.");
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
                  <SelectItem value="CASH_OUT">Cash Withdrawal</SelectItem>
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
              <Input 
                type="number" 
                placeholder="0.00" 
                className="h-16 pl-10 text-2xl font-bold rounded-2xl bg-muted/30"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
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
            <h3 className="text-4xl font-black mb-6">${parseFloat(balance).toLocaleString()}</h3>
            
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
