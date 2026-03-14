import { Transaction } from "@/types/transaction";
import { useState } from "react";
import { ChevronDown, ChevronUp, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TransactionDatasetViewProps {
  transaction: Transaction;
  defaultOpen?: boolean;
}

export function TransactionDatasetView({ transaction, defaultOpen = false }: TransactionDatasetViewProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const datasetFields = [
    { name: "step", value: transaction.step, type: "number" },
    { name: "type", value: transaction.type, type: "string" },
    { name: "amount", value: transaction.amount.toFixed(2), type: "number" },
    { name: "nameOrig", value: transaction.nameOrig, type: "string" },
    { name: "oldbalanceOrg", value: transaction.oldbalanceOrg.toFixed(2), type: "number" },
    { name: "newbalanceOrig", value: transaction.newbalanceOrig.toFixed(2), type: "number" },
    { name: "nameDest", value: transaction.nameDest, type: "string" },
    { name: "oldbalanceDest", value: transaction.oldbalanceDest.toFixed(2), type: "number" },
    { name: "newbalanceDest", value: transaction.newbalanceDest.toFixed(2), type: "number" },
    { name: "isFraud", value: transaction.isFraud, type: "label" },
    { name: "isFlaggedFraud", value: transaction.isFlaggedFraud, type: "flag" },
  ];

  return (
    <div className="section-card">
      <Button
        type="button"
        variant="ghost"
        className="w-full flex items-center justify-between p-0 h-auto font-normal hover:bg-transparent"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="dataset-view"
      >
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">Inspect Technical Details</span>
          <span className="text-xs text-muted-foreground">(Raw Dataset Fields)</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {isOpen && (
        <div id="dataset-view" className="mt-4 pt-4 border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Column</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Value</th>
                </tr>
              </thead>
              <tbody>
                {datasetFields.map(field => (
                  <tr key={field.name} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-mono text-primary">{field.name}</td>
                    <td className="py-2 font-mono">
                      {field.type === "label" ? (
                        <span className={field.value === 1 ? "text-danger" : "text-muted-foreground"}>
                          {field.value} {field.value === 1 ? "(labeled fraud)" : "(not labeled)"}
                        </span>
                      ) : field.type === "flag" ? (
                        <span className={field.value === 1 ? "text-warning" : "text-muted-foreground"}>
                          {field.value} {field.value === 1 ? "(flagged)" : "(not flagged)"}
                        </span>
                      ) : (
                        field.value
                      )}
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
