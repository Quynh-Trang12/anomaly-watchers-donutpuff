import { Layout } from "@/components/layout/Layout";
import { TransactionForm } from "@/components/simulator/TransactionForm";

export default function Simulate() {
  return (
    <Layout>
      <div className="container py-4 sm:py-6 pb-28">
        <div className="max-w-6xl mx-auto">
          <header className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">
              Risk Analysis Workbench
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Simulate a financial transaction to test the Fraud Detection
              Engine. Configure the sender, recipient, and time context to
              observe how the AI assesses risk.
            </p>
          </header>

          <TransactionForm />
        </div>
      </div>
    </Layout>
  );
}
