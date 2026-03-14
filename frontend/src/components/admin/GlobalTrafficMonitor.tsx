import { useState, useMemo } from "react";
import { Transaction, TransactionType, Decision, TRANSACTION_TYPES } from "@/types/transaction";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DecisionBadge } from "@/components/ui/DecisionBadge";
import { RiskScore } from "@/components/ui/RiskScore";
import { GroundTruthBadge } from "@/components/ui/GroundTruthBadge";
import { TransactionDatasetView } from "@/components/result/TransactionDatasetView";
import { getEventTypeLabel, formatCurrency, EVENT_TYPE_LABELS } from "@/lib/eventTypes";
import { Filter, X, AlertCircle, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface GlobalTrafficMonitorProps {
  transactions: Transaction[];
}

export function GlobalTrafficMonitor({ transactions }: GlobalTrafficMonitorProps) {
  const [typeFilter, setTypeFilter] = useState<TransactionType | "ALL">("ALL");
  const [decisionFilter, setDecisionFilter] = useState<Decision | "ALL">("ALL");
  const [highRiskOnly, setHighRiskOnly] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
      if (decisionFilter !== "ALL" && t.decision !== decisionFilter) return false;
      if (highRiskOnly && t.riskScore < 0.7) return false;
      return true;
    });
  }, [transactions, typeFilter, decisionFilter, highRiskOnly]);

  const clearFilters = () => {
    setTypeFilter("ALL");
    setDecisionFilter("ALL");
    setHighRiskOnly(false);
  };

  const hasFilters = typeFilter !== "ALL" || decisionFilter !== "ALL" || highRiskOnly;

  return (
    <div className="space-y-6">
      {/* Access Level Badge */}
      <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
        <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
        <div>
          <span className="font-semibold text-primary">Access Level: </span>
          <span className="font-mono text-sm">SYSTEM_ADMIN</span>
          <span className="text-muted-foreground ml-2">(All Records)</span>
        </div>
      </div>

      {/* Filters */}
      <div className="section-card">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">Filters</span>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto gap-1">
              <X className="h-3 w-3" aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="global-type-filter">Event Type</Label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TransactionType | "ALL")}>
              <SelectTrigger id="global-type-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {TRANSACTION_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{EVENT_TYPE_LABELS[t.value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="global-decision-filter">Decision</Label>
            <Select value={decisionFilter} onValueChange={(v) => setDecisionFilter(v as Decision | "ALL")}>
              <SelectTrigger id="global-decision-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Decisions</SelectItem>
                <SelectItem value="APPROVE">Approved</SelectItem>
                <SelectItem value="STEP_UP">Step-Up</SelectItem>
                <SelectItem value="BLOCK">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="global-high-risk">High Risk Only</Label>
            <Button
              id="global-high-risk"
              variant={highRiskOnly ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => setHighRiskOnly(!highRiskOnly)}
              aria-pressed={highRiskOnly}
            >
              {highRiskOnly ? "✓ Risk ≥ 70%" : "Risk ≥ 70%"}
            </Button>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      {filteredTransactions.length === 0 ? (
        <div className="section-card text-center py-12">
          <p className="text-muted-foreground">
            {transactions.length === 0
              ? "No transactions in the system."
              : "No transactions match the selected filters."}
          </p>
        </div>
      ) : (
        <div className="section-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">User ID</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Time</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Event Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sender → Recipient</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Risk</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Decision</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Ground Truth</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.slice(0, 50).map(t => (
                  <tr 
                    key={t.id} 
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedTransaction(t)}
                  >
                    <td className="py-3 px-4 font-mono text-xs text-primary">Current_User</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      <div>Hour {t.step}</div>
                      <div>{new Date(t.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3 px-4 font-medium">{getEventTypeLabel(t.type)}</td>
                    <td className="py-3 px-4 font-mono">{formatCurrency(t.amount)}</td>
                    <td className="py-3 px-4 font-mono text-xs">
                      <span className="truncate max-w-[80px] inline-block align-middle">{t.nameOrig}</span>
                      <span className="mx-1 text-muted-foreground">→</span>
                      <span className="truncate max-w-[80px] inline-block align-middle">{t.nameDest}</span>
                    </td>
                    <td className="py-3 px-4">
                      <RiskScore score={t.riskScore} showBar={false} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <DecisionBadge decision={t.decision} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <GroundTruthBadge isFraud={t.isFraud} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredTransactions.length > 50 && (
            <div className="p-3 text-center text-sm text-muted-foreground bg-muted/30">
              Showing 50 of {filteredTransactions.length} transactions
            </div>
          )}
        </div>
      )}

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm bg-primary/10 px-2 py-1 rounded">
                  <span className="text-muted-foreground">User:</span>
                  <span className="font-mono">Current_User</span>
                </div>
                <DecisionBadge decision={selectedTransaction.decision} size="md" />
                <RiskScore score={selectedTransaction.riskScore} showBar={false} size="md" />
              </div>

              <div className="section-card">
                <h3 className="font-semibold mb-3">Summary</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Event Type</dt>
                    <dd className="font-medium">{getEventTypeLabel(selectedTransaction.type)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="font-mono font-medium">{formatCurrency(selectedTransaction.amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Sender</dt>
                    <dd className="font-mono text-xs">{selectedTransaction.nameOrig}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Recipient</dt>
                    <dd className="font-mono text-xs">{selectedTransaction.nameDest}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ground Truth Status</dt>
                    <dd><GroundTruthBadge isFraud={selectedTransaction.isFraud} size="sm" /></dd>
                  </div>
                </dl>
              </div>

              <div className="section-card">
                <h3 className="font-semibold mb-3">Risk Factors</h3>
                <ul className="space-y-2">
                  {selectedTransaction.reasons.map((reason, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>

              <TransactionDatasetView transaction={selectedTransaction} defaultOpen={false} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
