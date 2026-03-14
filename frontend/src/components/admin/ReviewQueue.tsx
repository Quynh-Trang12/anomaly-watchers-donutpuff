import { useMemo } from "react";
import { Transaction } from "@/types/transaction";
import { Button } from "@/components/ui/button";
import { GroundTruthBadge } from "@/components/ui/GroundTruthBadge";
import { RiskScore } from "@/components/ui/RiskScore";
import { getEventTypeLabel, formatCurrency } from "@/lib/eventTypes";
import { CheckCircle, XCircle, AlertTriangle, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateTransaction, getTransactions } from "@/lib/storage";

interface ReviewQueueProps {
  transactions: Transaction[];
  onUpdate: () => void;
}

export function ReviewQueue({ transactions, onUpdate }: ReviewQueueProps) {
  const { toast } = useToast();

  // Filter for grey zone (risk 40-80%) OR unverified status
  const reviewQueue = useMemo(() => {
    return transactions.filter(t => {
      const isGreyZone = t.riskScore >= 0.4 && t.riskScore <= 0.8;
      const isUnverified = t.isFraud !== 0 && t.isFraud !== 1;
      return isGreyZone || isUnverified;
    });
  }, [transactions]);

  const handleMarkSafe = (id: string) => {
    updateTransaction(id, { isFraud: 0 });
    onUpdate();
    toast({
      title: "Marked as Legitimate",
      description: "Transaction has been labeled as safe.",
    });
  };

  const handleMarkFraud = (id: string) => {
    updateTransaction(id, { isFraud: 1 });
    onUpdate();
    toast({
      title: "Marked as Fraud",
      description: "Transaction has been labeled as confirmed fraud.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium text-primary">Human-in-the-Loop Review</p>
          <p className="text-sm text-muted-foreground">
            Review suspicious transactions to improve the AI model's accuracy. 
            Your feedback creates the ground truth for future training.
          </p>
        </div>
      </div>

      {/* Queue Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
          <span>
            <strong>{reviewQueue.length}</strong> transaction{reviewQueue.length !== 1 ? "s" : ""} pending review
          </span>
        </div>
        <span className="text-muted-foreground">
          (Risk 40–80% or Unverified)
        </span>
      </div>

      {/* Queue List */}
      {reviewQueue.length === 0 ? (
        <div className="section-card text-center py-12">
          <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" aria-hidden="true" />
          <p className="font-medium">Review Queue Empty</p>
          <p className="text-sm text-muted-foreground mt-1">
            No transactions require manual review at this time.
          </p>
        </div>
      ) : (
        <div className="section-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Event</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Risk Score</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Ground Truth</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {reviewQueue.map(t => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <div className="font-medium">{getEventTypeLabel(t.type)}</div>
                      <div className="text-xs text-muted-foreground">Hour {t.step}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">{formatCurrency(t.amount)}</td>
                    <td className="py-3 px-4">
                      <RiskScore score={t.riskScore} showBar={false} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <GroundTruthBadge isFraud={t.isFraud} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-success hover:text-success hover:bg-success/10 hover:border-success/30"
                          onClick={() => handleMarkSafe(t.id)}
                          aria-label="Mark as safe"
                        >
                          <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Safe
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-danger hover:text-danger hover:bg-danger/10 hover:border-danger/30"
                          onClick={() => handleMarkFraud(t.id)}
                          aria-label="Mark as fraud"
                        >
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Fraud
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
