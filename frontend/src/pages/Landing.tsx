import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { 
  Shield, 
  PlayCircle, 
  Zap,
  Users,
  FileText,
  Activity,
  ArrowRight,
  Radar,
  Brain,
  ClipboardCheck,
  Smartphone,
  CheckCircle2,
  Lock,
  Globe
} from "lucide-react";
import { motion } from "framer-motion";

const howItWorks = [
  {
    step: 1,
    icon: PlayCircle,
    title: "Simulate Intent",
    description: "Launch transaction payloads from any member profile to stress-test detection rules.",
    color: "bg-blue-500/10 text-blue-500"
  },
  {
    step: 2,
    icon: Brain,
    title: "Ensemble Scoring",
    description: "The Donutpuff model evaluates 12 behavioral dimensions with sub-50ms latency.",
    color: "bg-purple-500/10 text-purple-500"
  },
  {
    step: 3,
    icon: Lock,
    title: "Zero-Trust Logic",
    description: "Automated verification triggers out-of-band Step-Up protocols for suspicious actors.",
    color: "bg-amber-500/10 text-amber-500"
  },
];

const features = [
  {
    icon: Zap,
    title: "Predictive Heuristics",
    description: "Go beyond static rules with dynamic anomalous pattern recognition.",
  },
  {
    icon: Users,
    title: "Role-Based Access",
    description: "Enterprise workflows for Analysts, Admins, and Executive Oversight.",
  },
  {
    icon: FileText,
    title: "Immutable Ledger",
    description: "Complete audit traceability of every single security decision made.",
  },
  {
    icon: Activity,
    title: "Live Telemetry",
    description: "Monitor global risk distribution and system performance in real-time.",
  },
];

export default function Landing() {
  return (
    <Layout>
      {/* ─── Hero Section ─────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="container relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-18 md:gap-22">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="flex-1 text-left"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest mb-8">
                <Radar className="h-3 w-3 animate-pulse" /> Platform Enterprise
              </div>
              
              <h1 className="text-6xl font-black tracking-tighter leading-[0.9] mb-8">
                See the <span className="text-primary italic">Invisible</span><br/>
                Block the <span className="underline decoration-primary/30 decoration-8 underline-offset-8">Impossible</span>
              </h1>
              
              <p className="text-xl text-muted-foreground font-medium mb-10 max-w-xl leading-relaxed">
                Experience the world's most advanced transaction monitoring workbench. 
                Simulate high-velocity payment flows and witness autonomous AI in action.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="h-16 px-10 rounded-2xl text-lg font-black shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                  <Link to="/simulate">
                    Launch Simulator <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-16 px-10 rounded-2xl text-lg font-black border-2 hover:bg-muted transition-all">
                  <Link to="/about">
                    The Architecture
                  </Link>
                </Button>
              </div>

              <div className="mt-12 flex items-center gap-8 opacity-40">
                <div className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> SECURE MOBILE</div>
                <div className="flex items-center gap-2"><Globe className="h-4 w-4" /> GLOBAL SCALE</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> PCI COMPLIANT</div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              className="flex-1 relative hidden md:flex items-center justify-center"
            >
              {/* Animated Real-Time Monitoring Hub */}
              <div className="relative w-full h-96 flex items-center justify-center">
                {/* Outer Glow Ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border border-primary/20 shadow-lg shadow-primary/10"
                />
                
                {/* Middle Pulse Ring */}
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.3, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-12 rounded-full border-2 border-primary/40 shadow-lg shadow-primary/20"
                />

                {/* Central Radar Core */}
                <div className="relative z-10 flex flex-col items-center">
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="mb-6 p-4 bg-gradient-to-br from-primary/30 to-transparent rounded-full border border-primary/40"
                  >
                    <Radar className="h-16 w-16 text-primary animate-pulse" />
                  </motion.div>
                  
                  <h3 className="text-2xl font-black text-center mb-2">Live Threat Detection</h3>
                  <p className="text-xs font-bold text-muted-foreground text-center max-w-xs mb-6">
                    Real-time monitoring of 50K+ transactions/sec
                  </p>

                  {/* Transaction Flow Indicators */}
                  <div className="flex gap-6 items-center justify-center">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className="h-2 w-2 rounded-full bg-primary/60" />
                        <div className="h-6 w-0.5 bg-gradient-to-b from-primary/60 to-transparent" />
                      </motion.div>
                    ))}
                  </div>

                  {/* Stats Footer */}
                  <div className="mt-8 grid grid-cols-3 gap-8 text-center">
                    <div>
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-lg font-black text-primary"
                      >
                        98.7%
                      </motion.div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Accuracy</span>
                    </div>
                    <div>
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                        className="text-lg font-black text-primary"
                      >
                        &lt;50ms
                      </motion.div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Latency</span>
                    </div>
                    <div>
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                        className="text-lg font-black text-primary"
                      >
                        24/7
                      </motion.div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Uptime</span>
                    </div>
                  </div>
                </div>

                {/* Floating Anomaly Badges */}
                {[
                  { label: "ML INFERENCE", delay: 0, top: "10%", right: "5%" },
                  { label: "PATTERN MATCH", delay: 0.5, top: "75%", left: "8%" },
                  { label: "RULES ENGINE", delay: 1, top: "50%", right: "2%" },
                ].map((badge, i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -12, 0], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2.5, repeat: Infinity, delay: badge.delay }}
                    className={`absolute px-3 py-1 rounded-full border border-primary/30 bg-background/50 backdrop-blur-sm text-[10px] font-black uppercase tracking-widest text-primary/80`}
                    style={{ top: badge.top, right: badge.right, left: badge.left }}
                  >
                    {badge.label}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Visionary Step Section ───────────────────────────────────── */}
      <section className="py-24 bg-muted/30 relative">
        <div className="container">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-black tracking-tighter mb-6">Autonomous Orchestration.</h2>
            <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto italic">A seamless loop from simulation to real-time decisioning.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-6xl mx-auto">
            {howItWorks.map((item) => (
              <div key={item.step} className="group flex flex-col items-center text-center p-8 rounded-3xl hover:bg-background hover:shadow-xl transition-all border border-transparent hover:border-border">
                <div className={`h-20 w-20 rounded-3xl flex items-center justify-center mb-8 transform group-hover:rotate-12 transition-transform duration-500 shadow-xl ${item.color}`}>
                  <item.icon className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-black mb-4 tracking-tight">{item.title}</h3>
                <p className="text-sm text-muted-foreground font-bold leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Feature Showcase ─────────────────────────────────────────── */}
      <section className="py-24 border-t relative">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
             <div>
                <h2 className="text-5xl font-black tracking-tighter mb-10 leading-tight">Built for Enterprise <br/>Behavioral Analysis.</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  {features.map((f) => (
                    <div key={f.title} className="p-6 bg-card border rounded-2xl shadow-sm hover:shadow-lg transition-all border-l-4 border-l-primary">
                      <h4 className="font-bold mb-2 flex items-center gap-2">
                         <f.icon className="h-4 w-4 text-primary" /> {f.title}
                      </h4>
                      <p className="text-xs text-muted-foreground font-medium leading-relaxed">{f.description}</p>
                    </div>
                  ))}
                </div>
             </div>
             <div className="bg-primary p-12 rounded-[3.5rem] text-primary-foreground shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
                <div className="absolute top-0 left-0 p-8 opacity-10">
                   <Zap className="h-48 w-48" />
                </div>
                <h3 className="text-3xl font-black tracking-tighter mb-4 relative z-10">Ready to secure your future?</h3>
                <p className="text-primary-foreground/70 font-bold mb-8 relative z-10">Join 200+ enterprise teams using AnomalyWatchers to eliminate transactional risk today.</p>
                <Button asChild size="lg" variant="secondary" className="h-16 px-12 rounded-2xl text-lg font-black relative z-10 hover:scale-105 transition-transform">
                   <Link to="/simulate">Get Started Now</Link>
                </Button>
             </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
