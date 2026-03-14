import { CheckCircle, AlertTriangle, XCircle, ShieldCheck, ShieldX } from "lucide-react";
import { Decision } from "@/types/transaction";
import { getDecisionLabel } from "@/lib/scoring";
import { cn } from "@/lib/utils";

interface DecisionBadgeProps {
  decision: Decision;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

const decisionConfig: Record<Decision, { 
  className: string; 
  Icon: typeof CheckCircle;
}> = {
  APPROVE: {
    className: "badge-approve",
    Icon: CheckCircle,
  },
  STEP_UP: {
    className: "badge-stepup",
    Icon: AlertTriangle,
  },
  BLOCK: {
    className: "badge-block",
    Icon: XCircle,
  },
  APPROVE_AFTER_STEPUP: {
    className: "badge-approve",
    Icon: ShieldCheck,
  },
  BLOCK_STEPUP_FAILED: {
    className: "badge-block",
    Icon: ShieldX,
  },
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
  lg: "text-base px-4 py-1.5",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export function DecisionBadge({ decision, size = "md", showIcon = true }: DecisionBadgeProps) {
  const config = decisionConfig[decision];
  const Icon = config.Icon;

  return (
    <span 
      className={cn(config.className, sizeClasses[size])}
      role="status"
      aria-label={`Decision: ${getDecisionLabel(decision)}`}
    >
      {showIcon && <Icon className={iconSizes[size]} aria-hidden="true" />}
      <span>{getDecisionLabel(decision)}</span>
    </span>
  );
}
