import React from "react";
import { Link } from "react-router-dom";
import { useAuth, MOCK_USERS } from "../../context/AuthContext";
import { Shield, User, Power, LayoutDashboard, History, Settings, Users } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";

export const Navbar: React.FC = () => {
  const { role, setRole, isAdmin, userId, setUserId } = useAuth();

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
            <Button variant="ghost" asChild className="gap-2 font-medium">
              <Link to="/simulate">
                <LayoutDashboard className="h-4 w-4" />
                Wallet
              </Link>
            </Button>
            <Button variant="ghost" asChild className="gap-2 font-medium">
              <Link to="/history">
                <History className="h-4 w-4" />
                History
              </Link>
            </Button>
            {isAdmin && (
              <Button variant="ghost" asChild className="gap-2 font-medium">
                <Link to="/admin">
                  <Shield className="h-4 w-4" />
                  Admin Console
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-muted p-1 rounded-full gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="sm" 
                  variant={role === "USER" ? "default" : "ghost"}
                  className="rounded-full h-8 px-4 gap-2"
                >
                  <User className="h-4 w-4" />
                  {role === "USER" ? userId : "User View"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl p-2">
                {MOCK_USERS.map((user) => (
                  <DropdownMenuItem 
                    key={user.id} 
                    className="rounded-lg gap-2 cursor-pointer"
                    onClick={() => {
                      setRole("USER");
                      setUserId(user.id);
                    }}
                  >
                    <User className="h-4 w-4" />
                    {user.name} ({user.id})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              size="sm" 
              variant={role === "ADMIN" ? "default" : "ghost"}
              className="rounded-full h-8 px-4"
              onClick={() => setRole("ADMIN")}
            >
              <Shield className="h-4 w-4 mr-2" />
              Admin
            </Button>
          </div>
          
          <Button variant="outline" size="icon" className="rounded-full">
            <Power className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
};
