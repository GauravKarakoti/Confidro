import VerifierDashboard from "@/components/VerifierDashboard";
import { Suspense } from "react";
import { Providers } from "../providers";

export const metadata = {
  title: "Income Verification | Confidro",
  description: "Verify encrypted income streams securely using Confidro.",
};

export default function VerifierPage() {
  return (
    <Providers>
        <main className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
            {/* Next.js recommends wrapping client components that read URL search params in a Suspense boundary */}
            <Suspense fallback={
            <div className="flex justify-center items-center h-64 text-slate-400">
                Loading Verifier Portal...
            </div>
            }>
            <VerifierDashboard />
            </Suspense>
        </div>
        </main>
    </Providers>
  );
}