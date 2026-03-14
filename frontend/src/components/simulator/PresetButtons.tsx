import { Button } from "@/components/ui/button";
import { TRANSACTION_PRESETS, TransactionPreset } from "@/lib/presets";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PresetButtonsProps {
  onSelect: (preset: TransactionPreset) => void;
  disabled?: boolean;
}

const outcomeIcons = {
  APPROVE: CheckCircle,
  STEP_UP: AlertTriangle,
  BLOCK: XCircle,
};

const outcomeColors = {
  APPROVE: "text-success",
  STEP_UP: "text-warning",
  BLOCK: "text-danger",
};

export function PresetButtons({ onSelect, disabled }: PresetButtonsProps) {
  return (
    <fieldset className="form-fieldset">
      <legend className="form-legend">Quick Presets</legend>
      <p className="text-sm text-muted-foreground mb-3">
        Click a preset to auto-fill the form with sample data:
      </p>
      <div className="grid gap-2">
        {TRANSACTION_PRESETS.map(preset => {
          const Icon = outcomeIcons[preset.expectedOutcome];
          return (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              className="h-auto py-2.5 px-3 justify-start text-left min-w-0"
              onClick={() => onSelect(preset)}
              disabled={disabled}
            >
              <Icon 
                className={cn("h-4 w-4 mr-2 flex-shrink-0", outcomeColors[preset.expectedOutcome])} 
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{preset.name}</div>
                <div className="text-xs text-muted-foreground break-words line-clamp-2">
                  {preset.description}
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}
