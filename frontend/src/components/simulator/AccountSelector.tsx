import { useCallback, useEffect, useRef } from "react";
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pickNearestAccount = useCallback(() => {
    if (disabled) return;
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const viewportCenter = scrollArea.scrollLeft + scrollArea.clientWidth / 2;
    const accountButtons = scrollArea.querySelectorAll<HTMLButtonElement>(
      "button[data-account-id]",
    );

    let closestId = selectedId;
    let closestDistance = Number.POSITIVE_INFINITY;

    accountButtons.forEach((button) => {
      const id = button.dataset.accountId;
      if (!id) return;

      const cardCenter = button.offsetLeft + button.offsetWidth / 2;
      const distance = Math.abs(cardCenter - viewportCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = id;
      }
    });

    if (closestId && closestId !== selectedId) {
      onSelect(closestId);
    }
  }, [disabled, onSelect, selectedId]);

  const handleHorizontalWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    scrollArea.scrollLeft += event.deltaY;
  };

  const handleScroll = () => {
    if (scrollStopTimerRef.current) clearTimeout(scrollStopTimerRef.current);
    scrollStopTimerRef.current = setTimeout(() => {
      pickNearestAccount();
    }, 120);
  };

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea || !selectedId) return;

    const selectedButton = scrollArea.querySelector<HTMLButtonElement>(
      `button[data-account-id="${selectedId}"]`,
    );
    if (!selectedButton) return;

    selectedButton.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (scrollStopTimerRef.current) clearTimeout(scrollStopTimerRef.current);
    };
  }, []);

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2 sm:p-3 overflow-hidden">
      <div
        ref={scrollAreaRef}
        onWheel={handleHorizontalWheel}
        onScroll={handleScroll}
        className="grid w-full grid-flow-col auto-cols-[100%] gap-2 sm:gap-3 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Origin account carousel"
      >
        {accounts.map((account) => {
          const isSelected = account.id === selectedId;
          const isLowBalance = account.balance < 1000;

          return (
            <button
              key={account.id}
              data-account-id={account.id}
              type="button"
              onClick={() => onSelect(account.id)}
              disabled={disabled}
              className={cn(
                "relative flex w-full min-w-0 snap-start items-center gap-3 p-3 sm:p-4 rounded-lg border-2 text-left transition-all duration-200",
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
      <p className="pt-2 px-1 text-xs text-muted-foreground">
        Click an account or place the cursor here and scroll to slide between accounts.
      </p>
    </div>
  );
}
