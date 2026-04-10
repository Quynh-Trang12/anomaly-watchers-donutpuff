import React from "react";
import { Link } from "react-router-dom";
import { Shield, Github, Mail, Info, ExternalLink } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="bg-card border-t py-12">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-1 rounded-md">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">AnomalyWatchers</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Premium fraud detection and transaction monitoring for the digital age. 
              Powered by Advanced Behavioral Analysis.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-sm uppercase tracking-widest mb-6 text-primary">System</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/simulate" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Transaction Simulator</Link>
              </li>
              <li>
                <Link to="/history" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Global Activity Log</Link>
              </li>
              <li>
                <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About the Project</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm uppercase tracking-widest mb-6 text-primary">Resources</h4>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  API Documentation <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  System Status <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="font-bold text-sm uppercase tracking-widest text-primary">Platform Security</h4>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer">
                <Github className="h-5 w-5" />
              </div>
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer">
                <Mail className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
              Encrypted & Secured by Donutpuff FinTech Engineering
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © 2026 AnomalyWatchers Donutpuff Enterprise. Part of the Advanced Agentic Coding Workspace.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground">Privacy Policy</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
