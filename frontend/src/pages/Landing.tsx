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
  ClipboardCheck
} from "lucide-react";

const howItWorks = [
  {
    step: 1,
    icon: PlayCircle,
    title: "Simulate Traffic",
    description: "Generate transaction metadata to stress-test the system against diverse payment scenarios.",
  },
  {
    step: 2,
    icon: Brain,
    title: "AI Analysis",
    description: "Our engine evaluates risk in milliseconds using behavioral anomaly detection.",
  },
  {
    step: 3,
    icon: ClipboardCheck,
    title: "Admin Review",
    description: "Route suspicious cases to the 'Review Queue' for human expert analysis.",
  },
];

const features = [
  {
    icon: Zap,
    title: "Real-Time Scoring",
    description: "Instant feedback on transaction risk with sub-second response times.",
  },
  {
    icon: Users,
    title: "Role-Based Workflows",
    description: "Distinct interfaces for Analysts and Admins with appropriate access controls.",
  },
  {
    icon: FileText,
    title: "Audit Logging",
    description: "Immutable logs of every decision for compliance and review.",
  },
  {
    icon: Activity,
    title: "Pattern Detection",
    description: "Identify high-risk behavior patterns instantly across transaction flows.",
  },
];

export default function Landing() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero py-16 sm:py-24 lg:py-32">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        </div>

        {/* Shield Watermark - Mobile Background / Desktop Side Element */}
        <div className="absolute top-10 -right-12 w-3/4 opacity-10 z-0 pointer-events-none md:hidden" aria-hidden="true">
          <Shield className="w-full h-auto text-primary" />
        </div>

        <div className="container relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between md:gap-12 max-w-6xl mx-auto">
            {/* Text Content - On top of watermark */}
            <div className="relative z-10 text-left md:flex-1 md:max-w-2xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Radar className="h-4 w-4" aria-hidden="true" />
                Transaction Risk Workbench
              </div>
              
              {/* Headline */}
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Next-Gen Transaction
                <span className="block text-primary">Fraud Detection</span>
              </h1>

              {/* Slogan */}
              <p className="text-xl font-medium italic text-primary mt-4">
                See the invisible. Block the impossible.
              </p>
              
              {/* Subheadline */}
              <p className="text-lg text-muted-foreground mt-4 leading-relaxed max-w-xl">
                Experience the power of real-time anomaly detection. Simulate payment flows 
                and evaluate risk with our advanced machine learning engine.
              </p>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <Button asChild size="lg" className="w-full sm:w-auto gap-2 h-12 px-8 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow">
                  <Link to="/simulate">
                    <PlayCircle className="h-5 w-5" aria-hidden="true" />
                    Start Simulation
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto gap-2 h-12 px-8 text-base">
                  <Link to="/admin">
                    <Shield className="h-5 w-5" aria-hidden="true" />
                    Admin Console
                  </Link>
                </Button>
              </div>
            </div>

            {/* Hero Visual - Desktop Only */}
            <div className="hidden md:flex md:flex-1 md:justify-center md:items-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse-subtle" />
                <div className="relative w-48 h-48 lg:w-64 lg:h-64 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                  <Shield className="w-24 h-24 lg:w-32 lg:h-32 text-primary" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-24 border-b border-border">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A streamlined workflow from simulation to review in three simple steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {howItWorks.map((item) => (
              <div key={item.step} className="relative text-center">
                {/* Step number */}
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg mb-6">
                  {item.step}
                </div>
                
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                  <item.icon className="h-8 w-8 text-primary" aria-hidden="true" />
                </div>
                
                <h3 className="text-xl font-semibold text-foreground mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.description}</p>

                {/* Connector arrow (hidden on mobile) */}
                {item.step < 3 && (
                  <div className="hidden md:block absolute top-12 -right-4 text-muted-foreground/30">
                    <ArrowRight className="w-8 h-8" aria-hidden="true" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Key Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for enterprise-grade fraud detection and analyst workflows.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {features.map((feature) => (
              <div 
                key={feature.title} 
                className="section-card-elevated flex gap-4 items-start hover:shadow-lg transition-shadow"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <feature.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Final CTA */}
          <div className="mt-12 text-center">
            <Button asChild size="lg" className="gap-2 h-12 px-8 text-base font-semibold">
              <Link to="/simulate">
                Get Started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
