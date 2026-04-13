import { Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30 mt-auto">
      <div className="container py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="font-semibold text-foreground">
              AnomalyWatchers
            </span>
          </div>

          {/* Disclaimer */}
          <p className="mt-6 text-center text-xs text-muted-foreground/70 max-w-lg mx-auto">
            This is an educational demo application. No real transactions or
            financial operations occur.
          </p>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © 2026 AnomalyWatchers Inc.
          </p>
        </div>
      </div>
    </footer>
  );
}
