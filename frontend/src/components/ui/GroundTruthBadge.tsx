import { CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GroundTruthBadgeProps {
  isFraud: 0 | 1 | null | undefined;
  size?: "sm" | "md";
}

type StatusType = "legitimate" | "fraud" | "unverified";

const statusConfig: Record<StatusType, {
  label: string;
  className: string;
  Icon: typeof CheckCircle;
}> = {
  legitimate: {
    label: "Legitimate",
    className: "bg-success/10 text-success border-success/20",
    Icon: CheckCircle,
  },
  fraud: {
    label: "Confirmed Fraud",
    className: "bg-danger/10 text-danger border-danger/20",
    Icon: XCircle,
  },
  unverified: {
    label: "Unverified",
    className: "bg-muted text-muted-foreground border-border",
    Icon: HelpCircle,
  },
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-2.5 py-1 gap-1.5",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
};

function getStatus(isFraud: 0 | 1 | null | undefined): StatusType {
  if (isFraud === 1) return "fraud";
  if (isFraud === 0) return "legitimate";
  return "unverified";
}

export function GroundTruthBadge({ isFraud, size = "md" }: GroundTruthBadgeProps) {
  const status = getStatus(isFraud);
  const config = statusConfig[status];
  const Icon = config.Icon;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.className,
        sizeClasses[size]
      )}
      role="status"
      aria-label={`Ground truth: ${config.label}`}
    >
      <Icon className={iconSizes[size]} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}

export function getGroundTruthLabel(isFraud: 0 | 1 | null | undefined): string {
  const status = getStatus(isFraud);
  return statusConfig[status].label;
}
