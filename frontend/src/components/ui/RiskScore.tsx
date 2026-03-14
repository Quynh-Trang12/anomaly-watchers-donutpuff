import { cn } from "@/lib/utils";
import { getRiskLevel } from "@/lib/scoring";

interface RiskScoreProps {
  score: number;
  showBar?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RiskScore({
  score,
  showBar = true,
  size = "md",
}: RiskScoreProps) {
  const percentage = Math.round(score);
  const level = getRiskLevel(score / 100);

  const levelConfig = {
    low: {
      label: "Low Risk",
      className: "text-success",
      barClass: "bg-success",
    },
    medium: {
      label: "Medium Risk",
      className: "text-warning",
      barClass: "bg-warning",
    },
    high: {
      label: "High Risk",
      className: "text-danger",
      barClass: "bg-danger",
    },
  };

  const config = levelConfig[level];

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn("font-semibold", textSizes[size], config.className)}
        >
          {percentage}%
        </span>
        <span className={cn("text-xs", config.className)} role="status">
          {config.label}
        </span>
      </div>
      {showBar && (
        <div
          className="h-2 bg-muted rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Risk score: ${percentage}%`}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              config.barClass,
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
