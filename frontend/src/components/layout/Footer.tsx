import { Shield } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30 mt-auto">
      <div className="container py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="font-semibold text-foreground">AnomalyWatchers</span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 text-sm text-muted-foreground" aria-label="Footer navigation">
            <Link to="/simulate" className="hover:text-foreground transition-colors">
              Simulator
            </Link>
            <Link to="/admin" className="hover:text-foreground transition-colors">
              Admin
            </Link>
            <a href="#" className="hover:text-foreground transition-colors">
              Docs
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy
            </a>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © 2026 AnomalyWatchers Inc.
          </p>
        </div>

        {/* Disclaimer */}
        <p className="mt-6 text-center text-xs text-muted-foreground/70 max-w-lg mx-auto">
          This is an educational demo application. No real transactions or financial operations occur.
        </p>
      </div>
    </footer>
  );
}
