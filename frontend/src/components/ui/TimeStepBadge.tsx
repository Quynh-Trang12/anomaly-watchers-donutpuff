import { getTimeContext } from "@/lib/eventTypes";
import { Clock, Moon, Sun } from "lucide-react";

interface TimeStepBadgeProps {
  step: number;
  className?: string;
}

export function TimeStepBadge({ step, className = "" }: TimeStepBadgeProps) {
  const context = getTimeContext(step);
  
  return (
    <div className={`inline-flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded-md ${className}`}>
      {context.period === 'Day' ? (
        <Sun className="h-3 w-3 text-warning" aria-hidden="true" />
      ) : (
        <Moon className="h-3 w-3 text-primary" aria-hidden="true" />
      )}
      <span className="text-muted-foreground">
        {step} Hours ≈ {context.formatted}
      </span>
    </div>
  );
}
