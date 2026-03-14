import { useMemo } from "react";
import { formatCurrency } from "@/lib/eventTypes";
import { cn } from "@/lib/utils";
import { Wallet, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

interface WalletWidgetProps {
  accountName: string;
  currentBalance: number;
  amount: number;
  transactionType: string;
}

export function WalletWidget({
  accountName,
  currentBalance,
  amount,
  transactionType,
}: WalletWidgetProps) {
  const previewBalance = useMemo(() => {
    if (transactionType === "CASH IN") {
      return currentBalance + amount;
    }
    return Math.max(currentBalance - amount, 0);
  }, [currentBalance, amount, transactionType]);

  const isIncrease = transactionType === "CASH IN";
  const hasChange = amount > 0;
  const isLowBalance = previewBalance < 1000 && hasChange;
  const isInsufficientFunds = !isIncrease && amount > currentBalance;

  return (
    <div className="section-card-elevated">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
          <Wallet className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Account Balance</h3>
          <p className="text-sm text-muted-foreground">{accountName}</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Current Balance */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Current Balance</span>
          <span className="text-xl font-bold font-mono text-foreground">
            {formatCurrency(currentBalance)}
          </span>
        </div>

        {/* Transaction Preview */}
        {hasChange && (
          <>
            <div className="flex items-center justify-between py-2 border-t border-dashed border-border">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                {isIncrease ? (
                  <TrendingUp
                    className="h-4 w-4 text-success"
                    aria-hidden="true"
                  />
                ) : (
                  <TrendingDown
                    className="h-4 w-4 text-danger"
                    aria-hidden="true"
                  />
                )}
                Transaction Amount
              </span>
              <span
                className={cn(
                  "font-semibold font-mono",
                  isIncrease ? "text-success" : "text-danger",
                )}
              >
                {isIncrease ? "+" : "-"}
                {formatCurrency(amount)}
              </span>
            </div>

            {/* Preview Balance */}
            <div
              className={cn(
                "flex items-center justify-between p-3 rounded-lg transition-all duration-300",
                isInsufficientFunds
                  ? "bg-danger-muted"
                  : isLowBalance
                    ? "bg-warning-muted"
                    : isIncrease
                      ? "bg-success-muted"
                      : "bg-muted/50",
              )}
            >
              <span className="text-sm font-medium">Balance After</span>
              <div className="text-right">
                <span
                  className={cn(
                    "text-xl font-bold font-mono transition-all duration-300",
                    isInsufficientFunds
                      ? "text-danger"
                      : isLowBalance
                        ? "text-warning"
                        : isIncrease
                          ? "text-success"
                          : "text-foreground",
                  )}
                >
                  {formatCurrency(previewBalance)}
                </span>
              </div>
            </div>

            {/* Warning Messages */}
            {isInsufficientFunds && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-danger-muted text-danger text-sm">
                <AlertTriangle
                  className="h-4 w-4 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  <strong>Insufficient funds.</strong> This transaction exceeds
                  your available balance.
                </span>
              </div>
            )}

            {isLowBalance && !isInsufficientFunds && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-muted text-warning text-sm">
                <AlertTriangle
                  className="h-4 w-4 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  <strong>Low balance warning.</strong> Your balance will be
                  under $1,000 after this transaction.
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
