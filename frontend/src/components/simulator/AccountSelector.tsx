import { OriginAccount } from "@/types/transaction";
import { formatCurrency } from "@/lib/eventTypes";
import { cn } from "@/lib/utils";
import { Wallet, CheckCircle2 } from "lucide-react";

interface AccountSelectorProps {
  accounts: OriginAccount[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function AccountSelector({
  accounts,
  selectedId,
  onSelect,
  disabled = false,
}: AccountSelectorProps) {
  return (
    <div className="grid gap-2 sm:gap-3">
      {accounts.map((account) => {
        const isSelected = account.id === selectedId;
        const isLowBalance = account.balance < 1000;

        return (
          <button
            key={account.id}
            type="button"
            onClick={() => onSelect(account.id)}
            disabled={disabled}
            className={cn(
              "relative flex items-center gap-3 p-3 sm:p-4 rounded-lg border-2 text-left transition-all duration-200",
              "hover:border-primary/50 hover:bg-accent/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected
                ? "border-primary bg-accent/70 shadow-sm"
                : "border-border bg-card",
              disabled && "opacity-50 cursor-not-allowed",
            )}
            aria-pressed={isSelected}
            aria-label={`${account.displayName}: ${formatCurrency(account.balance)} available`}
          >
            {/* Account Icon */}
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </div>

            {/* Account Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground truncate">
                  {account.displayName}
                </span>
                {isSelected && (
                  <CheckCircle2
                    className="h-4 w-4 text-primary shrink-0"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">
                  {account.name}
                </span>
              </div>
            </div>

            {/* Balance */}
            <div className="text-right shrink-0">
              <div
                className={cn(
                  "text-lg font-semibold font-mono",
                  isLowBalance ? "text-danger" : "text-foreground",
                )}
              >
                {formatCurrency(account.balance)}
              </div>
              <div className="text-xs text-muted-foreground">Available</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
