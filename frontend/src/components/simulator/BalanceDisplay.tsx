import { ArrowRight } from "lucide-react";

interface BalanceDisplayProps {
  label: string;
  oldBalance: number;
  newBalance: number;
  highlight?: "increase" | "decrease" | "none";
}

export function BalanceDisplay({ label, oldBalance, newBalance, highlight = "none" }: BalanceDisplayProps) {
  const formatAmount = (amount: number) => {
    return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const highlightClass = {
    increase: "text-success",
    decrease: "text-danger",
    none: "text-foreground",
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 px-3 bg-muted/50 rounded-md">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 text-sm font-mono">
        <span className="text-muted-foreground">{formatAmount(oldBalance)}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        <span className={highlightClass[highlight]} aria-label={`New balance: ${formatAmount(newBalance)}`}>
          {formatAmount(newBalance)}
        </span>
      </div>
    </div>
  );
}
