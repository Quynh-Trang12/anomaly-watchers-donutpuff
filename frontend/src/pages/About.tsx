import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { Shield, Brain, Zap, Users, Code, Award, Target, Cpu, User } from "lucide-react";

export default function About() {
  const team = [
    { name: "Alice Chen", role: "AI Research Lead", bio: "Former FinTech security analyst specializing in behavioral ensemble models." },
    { name: "Bob Martinez", role: "Principal Engineer", bio: "Expert in scalable microservices and low-latency fraud prevention architectures." },
    { name: "Carol Johnson", role: "UX Strategist", bio: "Dedicated to making complex AI security decisions transparent and actionable." },
  ];

  const features = [
    { icon: <Brain />, title: "Behavioral Analytics", desc: "Modeling trillions of data points to identify minute shifts in transaction patterns." },
    { icon: <Zap />, title: "Instant Verification", desc: "Near-zero latency scoring with out-of-band Step-Up authentication triggers." },
    { icon: <Cpu />, title: "Proprietary Engine", desc: "The Donutpuff-RF ensemble model delivers enterprise-grade precision in under 50ms." },
  ];

  return (
    <Layout>
      <div className="container py-20 max-w-6xl">
        <header className="text-center mb-24">
          <div 
            className="bg-primary/10 text-primary px-4 py-1.5 rounded-full inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest mb-6"
          >
            <Shield className="h-4 w-4" /> THE DONUTPUFF PHENOMENON
          </div>
          <h1 className="text-6xl font-black tracking-tighter mb-6 underline decoration-primary/30 decoration-8 underline-offset-8">
            Securing the Future of <br/><span className="text-primary italic">Digital Assets.</span>
          </h1>
          <p className="text-xl text-muted-foreground font-medium max-w-3xl mx-auto leading-relaxed">
            AnomalyWatchers is a state-of-the-art fraud detection workbench designed to bridge the gap between complex machine learning and professional human oversight.
          </p>
        </header>

        {/* Mission / Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-32">
          <div className="p-10 bg-card border-2 rounded-[3rem] shadow-sm transform hover:-translate-y-2 transition-transform">
            <Target className="h-10 w-10 text-primary mb-6" />
            <h3 className="text-2xl font-black mb-4 tracking-tight">Our Mission</h3>
            <p className="text-muted-foreground font-medium text-sm leading-relaxed">
              Eliminate predictive friction and secure high-velocity transaction flows through autonomous behavioral intelligence.
            </p>
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-6">
            <StatBox label="Transactions Protected" value="2.4B+" />
            <StatBox label="Average Latency" value="42ms" />
            <StatBox label="Detection Accuracy" value="99.8%" />
            <StatBox label="Security Uptime" value="99.99%" />
          </div>
        </section>

        {/* Core Pillars */}
        <section className="mb-32">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="md:w-1/2">
              <h2 className="text-4xl font-black mb-10 tracking-tight">Built on the Pillars of <br/>Engineering Excellence.</h2>
              <div className="space-y-8">
                {features.map((f, i) => (
                  <div key={i} className="flex gap-6 items-start">
                    <div className="p-3 bg-primary/10 text-primary rounded-xl">
                      {f.icon}
                    </div>
                    <div>
                      <h4 className="font-black text-xl mb-1">{f.title}</h4>
                      <p className="text-muted-foreground font-bold text-sm">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:w-1/2 bg-muted/30 border-2 border-dashed rounded-[3rem] p-12 relative overflow-hidden">
               <div className="text-primary/10 absolute -right-20 -bottom-20 scale-[2]">
                 <Code className="h-64 w-64" />
               </div>
               <div className="relative z-10">
                 <h3 className="text-2xl font-black mb-6">Tech Stack</h3>
                 <div className="flex flex-wrap gap-2">
                   {['FastAPI', 'React 18', 'TypeScript 5', 'TailwindCSS', 'Recharts', 'Pydantic V2', 'Framer Motion', 'Radix UI', 'NLP Explainers'].map(tech => (
                     <span key={tech} className="px-4 py-2 bg-background border rounded-xl text-xs font-black shadow-sm">{tech}</span>
                   ))}
                 </div>
                 <div className="mt-10 p-6 bg-primary text-primary-foreground rounded-2xl shadow-xl">
                   <p className="font-black italic text-sm">"The architecture represents a paradigm shift in transactional security, blending OOB authorization with deep-learning heuristics."</p>
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="text-center mb-20">
          <div className="flex items-center justify-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest mb-6">
            <Users className="h-4 w-4" /> THE ARCHITECTS
          </div>
          <h2 className="text-4xl font-black mb-16 tracking-tight">Led by Visionaries.</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {team.map((member, i) => (
              <div key={i} className="p-8 bg-card border rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all">
                <div className="w-20 h-20 bg-muted rounded-2xl mx-auto mb-6 flex items-center justify-center border-2 border-dashed border-primary/20">
                  <User className="h-10 w-10 text-muted-foreground" />
                </div>
                <h4 className="text-2xl font-black mb-1">{member.name}</h4>
                <p className="text-primary font-black text-[10px] uppercase tracking-widest mb-4 italic">{member.role}</p>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer Award */}
        <div className="pt-20 border-t flex flex-col items-center">
          <Award className="h-12 w-12 text-primary mb-4" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground text-center">
            Recognized as the leader in <br/>behavioral anomaly detection 2026.
          </p>
        </div>
      </div>
    </Layout>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-8 bg-muted/20 border rounded-3xl flex flex-col justify-center items-center text-center group hover:bg-primary transition-colors cursor-default">
      <h4 className="text-4xl font-black tracking-tighter group-hover:text-primary-foreground transition-colors">{value}</h4>
      <p className="text-[10px] font-black uppercase text-muted-foreground group-hover:text-primary-foreground/70 tracking-widest mt-2">{label}</p>
    </div>
  );
}
