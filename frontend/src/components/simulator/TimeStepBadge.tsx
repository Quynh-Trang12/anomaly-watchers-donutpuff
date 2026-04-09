import React from "react";
import { Sun, Moon, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TimeStepBadgeProps {
  step: number;
}

/**
 * TimeStepBadge
 * Interpretive component for simulation steps.
 * Aligned with current backend model: Step 1 = 01:00, Step 24 = 00:00.
 */
export const TimeStepBadge: React.FC<TimeStepBadgeProps> = ({ step }) => {
  // Logic aligned with user request:
  // Step 1 -> Day 1, 01:00
  // Step 24 -> Day 1, 00:00
  // Step 25 -> Day 2, 01:00
  const hour = step % 24;
  const day = Math.floor((step - 1) / 24) + 1;
  const isDaytime = hour >= 6 && hour <= 18;
  
  const displayHour = hour === 0 ? "00:00" : `${hour.toString().padStart(2, "0")}:00`;

  return (
    <div className="flex items-center gap-3">
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative group shrink-0"
      >
        <div className={`p-2.5 rounded-2xl border flex items-center justify-center transition-all duration-500 shadow-sm
          ${isDaytime 
            ? "bg-amber-500/10 border-amber-500/20 text-amber-600 shadow-amber-500/5 group-hover:bg-amber-500/20" 
            : "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 shadow-indigo-500/5 group-hover:bg-indigo-500/20"
          }`}
        >
          <AnimatePresence mode="wait">
            {isDaytime ? (
              <motion.div
                key="sun"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Sun className="h-5 w-5 fill-current opacity-80" />
              </motion.div>
            ) : (
              <motion.div
                key="moon"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Moon className="h-5 w-5 fill-current opacity-80" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Subtle glow effect */}
        <div className={`absolute inset-0 blur-xl opacity-20 -z-10 transition-colors duration-1000 ${isDaytime ? "bg-amber-500" : "bg-indigo-500"}`} />
      </motion.div>

      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
            Temporal Context
          </span>
          <div className="h-px flex-1 bg-border/40" />
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-sm font-bold tracking-tight">
            Step <span className="text-primary font-black">{step}</span>
            <span className="mx-2 text-muted-foreground font-normal">≈</span>
            <span className="text-foreground font-black">Day {day}</span>
            <span className="text-muted-foreground font-normal">, </span>
            <span className="font-mono text-primary">{displayHour}</span>
          </h4>
        </div>
      </div>
    </div>
  );
};
