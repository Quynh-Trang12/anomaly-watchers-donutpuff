import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth, MOCK_USERS } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  Shield,
  User,
  Sun,
  Moon,
  LayoutDashboard,
  History,
  Activity,
  LogOut,
  Info,
} from "lucide-react";
import { Button } from "../ui/button";

export const Navbar: React.FC = () => {
  const { role, setRole, userId, setUserId, setHasActivelySelectedUser } =
    useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const currentUser = MOCK_USERS.find((u) => u.id === userId);
  const userDisplayName = currentUser ? currentUser.name : userId;

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 shadow-sm">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 group transition-all">
            <div className="bg-primary p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-black text-xl tracking-tight hidden sm:inline-block">
              Anomaly<span className="text-primary italic">Watchers</span>
            </span>
          </Link>

          {/* ─── Role-Based Navigation ──────────────────────────────────────── */}
          <div className="hidden md:flex items-center gap-1">
            {role === "USER" ? (
              <>
                <Button
                  variant={isActive("/simulate") ? "secondary" : "ghost"}
                  asChild
                  className="gap-2 font-bold rounded-xl"
                >
                  <Link to="/simulate">
                    <LayoutDashboard className="h-4 w-4" />
                    Wallet
                  </Link>
                </Button>
                <Button
                  variant={isActive("/history") ? "secondary" : "ghost"}
                  asChild
                  className="gap-2 font-bold rounded-xl"
                >
                  <Link to="/history">
                    <History className="h-4 w-4" />
                    History
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={isActive("/dashboard") ? "secondary" : "ghost"}
                  asChild
                  className="gap-2 font-bold rounded-xl"
                >
                  <Link to="/dashboard">
                    <Activity className="h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
                {/* <Button
                  variant={isActive("/admin") ? "secondary" : "ghost"}
                  asChild
                  className="gap-2 font-bold rounded-xl"
                >
                  <Link to="/admin">
                    <Shield className="h-4 w-4" />
                    Control
                  </Link>
                </Button> */}
                <Button
                  variant={isActive("/history") ? "secondary" : "ghost"}
                  asChild
                  className="gap-2 font-bold rounded-xl"
                >
                  <Link to="/history">
                    <History className="h-4 w-4" />
                    Transaction Logs
                  </Link>
                </Button>
              </>
            )}
            <Button
              variant={isActive("/about") ? "secondary" : "ghost"}
              asChild
              className="gap-2 font-bold rounded-xl"
            >
              <Link to="/about">
                <Info className="h-4 w-4" />
                About
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Role Switcher */}
          <div className="hidden sm:flex items-center bg-muted/50 border p-1 rounded-xl gap-1">
            <Button
              size="sm"
              variant={role === "USER" ? "default" : "ghost"}
              className="rounded-lg h-8 px-4 font-bold transition-all"
              onClick={() => {
                setRole("USER");
                setUserId("user_1");
                setHasActivelySelectedUser(false);
              }}
            >
              Customer
            </Button>
            <Button
              size="sm"
              variant={role === "ADMIN" ? "default" : "ghost"}
              className="rounded-lg h-8 px-4 font-bold transition-all"
              onClick={() => {
                setRole("ADMIN");
                setUserId("admin_1");
                setHasActivelySelectedUser(true);
              }}
            >
              Admin
            </Button>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="rounded-xl border-2 hover:bg-accent"
            onClick={toggleTheme}
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          <div className="flex items-center gap-2 ml-1 pl-3 border-l">
            <div className="flex flex-col items-end hidden xl:flex">
              <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none">
                {role === "ADMIN" ? "Security Operator" : "Active Account"}
              </span>
              <span className="text-xs font-bold truncate max-w-[100px] leading-tight">
                {role === "ADMIN" ? "System Admin" : userDisplayName}
              </span>
            </div>
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                role === "ADMIN"
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                  : "bg-primary/10 text-primary border-primary/20"
              }`}
            >
              {role === "ADMIN" ? (
                <Shield className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
