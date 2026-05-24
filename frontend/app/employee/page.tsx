"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { User, Wallet } from "lucide-react";
import EmployeeDashboard from "@/components/EmployeeDashboard";
import Navbar from "@/components/Navbar";
import { Providers } from "@/app/providers";

function EmployeeContent() {
  const { isConnected, address } = useAccount();
  const [orgInput, setOrgInput] = useState("");
  const [activeOrgAddress, setActiveOrgAddress] = useState<`0x${string}` | null>(null);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center flex-1 px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-2xl p-8 max-w-sm w-full text-center border border-emerald-500/20">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-emerald-500/10">
            <User size={26} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>Connect as Employee</h2>
          <p className="text-sm text-slate-500 mb-6">Connect your wallet to access your organization.</p>
          <div className="flex justify-center"><ConnectKitButton /></div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Employee Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <Wallet size={12} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
          </div>
        </div>
      </div>

      {activeOrgAddress ? (
        <EmployeeDashboard /> 
      ) : (
        <div className="glass rounded-2xl p-8 max-w-md mx-auto mt-12 border border-emerald-500/20">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-emerald-500/10">
            <User size={32} className="text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2 text-center" style={{ fontFamily: "var(--font-display)" }}>Access Organization</h3>
          <p className="text-sm text-slate-400 mb-6 text-center">Enter the payroll contract address provided by your employer.</p>
          
          <input
            type="text"
            placeholder="0x..."
            value={orgInput}
            onChange={(e) => setOrgInput(e.target.value)}
            className="input-field mb-4 focus:ring-emerald-500"
          />
          <button 
            onClick={() => setActiveOrgAddress(orgInput as `0x${string}`)}
            className="btn-green w-full"
            disabled={!orgInput.startsWith('0x')}
          >
            Connect to Organization
          </button>
        </div>
      )}
    </div>
  );
}

export default function EmployeeRoute() {
  return (
    <Providers>
      <div className="flex flex-col min-h-screen grid-bg">
        <Navbar />
        <div className="pt-20 pb-12 flex flex-col flex-1">
          <EmployeeContent />
        </div>
      </div>
    </Providers>
  );
}