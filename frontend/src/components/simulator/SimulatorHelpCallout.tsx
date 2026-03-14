import { Info } from "lucide-react";

export function SimulatorHelpCallout() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/50 border border-accent-foreground/10">
      <Info
        className="h-5 w-5 text-primary shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          Fraud Detection Simulator
        </p>
        <p className="text-sm text-muted-foreground">
          You are simulating a transaction as a customer. Fill in the details
          below and our AI-powered fraud detection system will analyze the
          transaction in real-time using machine learning models.
        </p>
      </div>
    </div>
  );
}
