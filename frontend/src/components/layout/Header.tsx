import { Link, useLocation, useNavigate } from "react-router-dom";
import { Shield, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  clearAuthSession,
  getCurrentRole,
  getCurrentUser,
  isAuthenticated,
} from "@/lib/auth";
import { clearPendingTransaction } from "@/lib/storage";

const BASE_NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/simulate", label: "Simulator" },
  { to: "/history", label: "History" },
];

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const role = getCurrentRole();
  const user = getCurrentUser();
  const authed = isAuthenticated();

  const navLinks = authed
    ? role === "admin"
      ? [...BASE_NAV_LINKS, { to: "/admin", label: "Admin" }]
      : BASE_NAV_LINKS
    : [{ to: "/", label: "Home" }];

  const handleLogout = () => {
    clearAuthSession();
    clearPendingTransaction();
    navigate("/login", { replace: true });
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="disclaimer-banner" role="alert">
        <span className="sr-only">Important notice: </span>
        Simulation only. No real transfers occur.
      </div>

      <nav className="container flex items-center justify-between h-14 sm:h-16">
        <Link
          to="/"
          className="flex items-center gap-2 text-primary font-semibold"
          aria-label="AnomalyWatchers - Home"
        >
          <Shield className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          <span className="hidden sm:inline text-sm sm:text-base">
            AnomalyWatchers
          </span>
          <span className="sm:hidden text-sm">AW</span>
        </Link>

        <ul className="hidden md:flex items-center gap-1" role="list">
          {navLinks.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                aria-current={
                  location.pathname === link.to ? "page" : undefined
                }
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-2">
          {authed && user ? (
            <>
              <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                {user.username} ({role.toUpperCase()})
              </span>
              <Button asChild size="sm" variant="outline">
                <Link to="/login">Switch User</Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link to="/login">Login</Link>
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </Button>
      </nav>

      {mobileMenuOpen && (
        <nav
          id="mobile-menu"
          className="md:hidden border-t border-border bg-card"
          aria-label="Mobile navigation"
        >
          <ul className="container py-2 space-y-1" role="list">
            <li className="px-3 pt-2 pb-1 text-xs text-muted-foreground uppercase">
              {authed && user ? `User: ${user.username} (${role})` : "Not signed in"}
            </li>
            {navLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === link.to
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={
                    location.pathname === link.to ? "page" : undefined
                  }
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {authed ? (
              <>
                <li>
                  <Link
                    to="/login"
                    className="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Switch User
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link
                  to="/login"
                  className="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
