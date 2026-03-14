import { Transaction } from "@/types/transaction";
import { DecisionBadge } from "@/components/ui/DecisionBadge";
import { RiskScore } from "@/components/ui/RiskScore";
import { getEventTypeLabel, formatCurrency } from "@/lib/eventTypes";

interface TransactionListItemProps {
  transaction: Transaction;
  onClick: () => void;
  showUserId?: boolean;
}

export function TransactionListItem({ transaction, onClick, showUserId = false }: TransactionListItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left section-card hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      aria-label={`View details for ${getEventTypeLabel(transaction.type)} transaction of ${formatCurrency(transaction.amount)}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold">{getEventTypeLabel(transaction.type)}</span>
            <span className="text-muted-foreground">•</span>
            <span className="font-mono text-sm">{formatCurrency(transaction.amount)}</span>
            {transaction.isFlaggedFraud === 1 && (
              <span className="text-xs bg-warning-muted text-warning px-2 py-0.5 rounded">
                Flagged
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground truncate">
            <span className="font-mono">{transaction.nameOrig}</span>
            <span className="mx-2">→</span>
            <span className="font-mono">{transaction.nameDest}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span>Hour {transaction.step}</span>
            <span>•</span>
            <span>{new Date(transaction.createdAt).toLocaleString()}</span>
            {showUserId && (
              <>
                <span>•</span>
                <span className="text-primary font-medium">Current_User</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-24">
            <RiskScore score={transaction.riskScore} showBar={false} size="sm" />
          </div>
          <DecisionBadge decision={transaction.decision} size="sm" />
        </div>
      </div>
    </button>
  );
}
