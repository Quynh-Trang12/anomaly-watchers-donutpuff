import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Shield, User, LayoutDashboard, History, Activity } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

export const Navbar: React.FC = () => {
  const { role, setRole, isAdmin } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ to, icon: Icon, label, show }: { to: string, icon: any, label: string, show: boolean }) => {
    if (!show) return null;
    
    const active = isActive(to);
    
    return (
      <Button 
        variant="ghost" 
        asChild 
        className={cn(
          "gap-2 font-medium transition-colors hover:bg-transparent cursor-pointer",
          active ? "bg-primary text-primary-foreground hover:bg-primary" : "text-foreground"
        )}
      >
        <Link to={to}>
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      </Button>
    );
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:inline-block">
              Anomaly<span className="text-primary">Watchers</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <NavItem 
              to="/dashboard" 
              icon={Activity} 
              label="Monitor" 
              show={isAdmin} 
            />
            <NavItem 
              to="/simulate" 
              icon={LayoutDashboard} 
              label="Wallet" 
              show={!isAdmin} 
            />
            <NavItem 
              to="/history" 
              icon={History} 
              label="History" 
              show={true} 
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* DEMO-ONLY ROLE SWITCHER: Preserved for presentation convenience */}
          <div className="flex items-center bg-muted p-1 rounded-full border shadow-sm" title="Demo Role Toggle">
            <Button
              size="sm"
              variant={role === "USER" ? "default" : "ghost"}
              className={cn(
                "rounded-full h-8 px-4 gap-2 transition-all hover:bg-transparent",
                role === "USER" && "bg-primary text-primary-foreground hover:bg-primary"
              )}
              onClick={() => setRole("USER")}
            >
              <User className="h-4 w-4" />
              User
            </Button>

            <Button
              size="sm"
              variant={role === "ADMIN" ? "default" : "ghost"}
              className={cn(
                "rounded-full h-8 px-4 gap-2 transition-all hover:bg-transparent",
                role === "ADMIN" && "bg-primary text-primary-foreground hover:bg-primary"
              )}
              onClick={() => setRole("ADMIN")}
            >
              <Shield className="h-4 w-4" />
              Admin
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};
