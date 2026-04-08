import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { TransactionForm } from "@/components/simulator/TransactionForm";

export default function Simulate() {
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  return (
    <Layout>
      <div className="container py-4 sm:py-6 pb-28">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-black tracking-tight">
              Elite Digital Wallet
            </h1>
            <p className="text-muted-foreground mt-2">
              Experience the next generation of secure, AI-powered financial transfers. 
              Our system analyzes every transaction in real-time to ensure your funds remain safe.
            </p>
          </header>

          <TransactionForm 
            onTransactionApproved={() => setRefreshTrigger(prev => prev + 1)} 
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>
    </Layout>
  );
}
