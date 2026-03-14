import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, Shield, Cpu, Scale } from "lucide-react";

interface ProcessingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

interface PipelineStep {
  id: string;
  label: string;
  icon: React.ElementType;
  duration: number;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "analyze",
    label: "Analyzing Transaction Data...",
    icon: Shield,
    duration: 800,
  },
  {
    id: "xgboost",
    label: "Running XGBoost Model...",
    icon: Cpu,
    duration: 800,
  },
  {
    id: "rules",
    label: "Verifying Risk Rules...",
    icon: Scale,
    duration: 800,
  },
];

export function ProcessingModal({ isOpen, onComplete }: ProcessingModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const onCompleteRef = useRef(onComplete);
  const hasCompletedRef = useRef(false);

  // Keep the ref updated with the latest callback
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0);
      setCompletedSteps([]);
      hasCompletedRef.current = false;
      return;
    }

    // Prevent double execution
    if (hasCompletedRef.current) return;

    let isCancelled = false;

    const runPipeline = async () => {
      for (let i = 0; i < PIPELINE_STEPS.length; i++) {
        if (isCancelled) return;
        setCurrentStepIndex(i);

        await new Promise((resolve) =>
          setTimeout(resolve, PIPELINE_STEPS[i].duration),
        );

        if (isCancelled) return;
        setCompletedSteps((prev) => [...prev, PIPELINE_STEPS[i].id]);
      }

      // Brief pause before completing
      await new Promise((resolve) => setTimeout(resolve, 400));

      if (!isCancelled && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onCompleteRef.current();
      }
    };

    runPipeline();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="processing-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Modal Content */}
      <div className="relative w-full max-w-md mx-4 bg-card rounded-xl shadow-xl border border-border p-6 sm:p-8 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Loader2
              className="h-8 w-8 text-primary animate-spin"
              aria-hidden="true"
            />
          </div>
          <h2
            id="processing-title"
            className="text-xl sm:text-2xl font-bold text-foreground"
          >
            Processing Transaction
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Running AI fraud detection pipeline...
          </p>
        </div>

        {/* Pipeline Steps */}
        <div className="space-y-3">
          {PIPELINE_STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = index === currentStepIndex && !isCompleted;
            const isPending = index > currentStepIndex;
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-all duration-300",
                  isCompleted && "bg-success-muted",
                  isCurrent && "bg-primary/10",
                  isPending && "bg-muted/30 opacity-50",
                )}
              >
                {/* Status Icon */}
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-all duration-300",
                    isCompleted && "bg-success text-success-foreground",
                    isCurrent && "bg-primary text-primary-foreground",
                    isPending && "bg-muted text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  ) : isCurrent ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "text-sm font-medium transition-colors duration-300",
                    isCompleted && "text-success",
                    isCurrent && "text-foreground",
                    isPending && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="mt-6 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
            style={{
              width: `${(completedSteps.length / PIPELINE_STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
