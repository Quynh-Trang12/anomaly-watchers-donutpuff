import { Layout } from "../components/layout/Layout";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";

export default function About() {
  const teamMembers = [
    {
      name: "Alex Nguyen",
      role: "Lead ML Engineer",
      bio: "Designed the XGBoost fraud detection pipeline.",
      initials: "AN",
    },
    {
      name: "Sam Tran",
      role: "Backend Developer",
      bio: "Built the FastAPI inference engine and data layer.",
      initials: "ST",
    },
    {
      name: "Jordan Lee",
      role: "Frontend Developer",
      bio: "Crafted the React dashboard and simulator UI.",
      initials: "JL",
    },
    {
      name: "Casey Pham",
      role: "Data Scientist",
      bio: "Conducted EDA and continuous learning experiments.",
      initials: "CP",
    },
  ];

  return (
    <Layout>
      <div className="min-h-screen flex flex-col">
        {/* ─── Hero Section ───────────────────────────────────────────────────── */}
        <section className="relative py-12 md:py-20 px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Meet the <span className="text-primary">DonutPuff</span> Team
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              A dedicated team of engineers and data scientists building the future of fraud detection.
            </p>
          </div>
        </section>

        {/* ─── Team Section ──────────────────────────────────────────────────── */}
        <section className="py-16 px-4 flex-1">
          <div className="container">
            <h2 className="text-3xl font-bold mb-12 text-center">Our Team</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {teamMembers.map((member) => (
                <div key={member.name} className="bg-card rounded-lg p-6 border border-border text-center">
                  <div
                    className="w-16 h-16 rounded-full bg-primary/10 text-primary font-bold text-xl flex items-center justify-center mx-auto mb-4"
                    aria-hidden="true"
                  >
                    {member.initials}
                  </div>
                  <h3 className="text-lg font-semibold mb-1">{member.name}</h3>
                  <p className="text-sm text-primary font-medium mb-2">{member.role}</p>
                  <p className="text-sm text-muted-foreground">{member.bio}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Project Section ──────────────────────────────────────────────── */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="container max-w-3xl">
            <h2 className="text-3xl font-bold mb-8">About AnomalyWatchers</h2>
            <div className="space-y-6 text-muted-foreground">
              <p>
                AnomalyWatchers is an advanced fraud detection system designed to protect financial institutions from 
                emerging threats. Our machine learning model analyzes transaction patterns in real-time, identifying 
                suspicious activities with high precision while minimizing false positives that could frustrate legitimate users.
              </p>
              <p>
                Built using the PaySim synthetic transaction dataset from Kaggle, our system captures realistic patterns 
                of both fraudulent and legitimate e-wallet transactions. This enables our Random Forest and XGBoost models 
                to learn nuanced decision boundaries that adapt to evolving fraud tactics.
              </p>
              <p>
                The technology stack combines React for the modern user interface, FastAPI for high-performance backend 
                processing, and industry-standard machine learning frameworks (scikit-learn, joblib) for model inference. 
                All components are designed for scalability, security, and transparent explainability of fraud decisions.
              </p>
            </div>
          </div>
        </section>

        {/* ─── CTA Section ───────────────────────────────────────────────────── */}
        <section className="py-12 px-4 text-center border-t">
          <div className="container">
            <p className="text-muted-foreground mb-6">Ready to explore fraud detection in action?</p>
            <Link
              to="/simulate"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              <Users className="h-5 w-5" />
              Try the Simulator
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
}
