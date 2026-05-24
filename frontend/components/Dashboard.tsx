"use client";

import Link from "next/link";
import { Briefcase, User, ShieldAlert } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen grid-bg">
      <div className="flex flex-col items-center justify-center flex-1 px-4 sm:px-6 lg:px-8 mt-20">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>
          Select Your Portal
        </h1>
        <p className="text-slate-400 mb-10 text-center max-w-lg">
          Choose your role to access the appropriate dashboard for managing, receiving, or auditing encrypted payrolls.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
          <Link href="/employer" className="glass p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-200 flex flex-col items-center text-center cursor-pointer border border-violet-500/20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-violet-500/10">
              <Briefcase size={32} className="text-violet-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Employer</h2>
            <p className="text-slate-400 text-sm">Deploy organizations and manage encrypted payrolls.</p>
          </Link>

          <Link href="/employee" className="glass p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-200 flex flex-col items-center text-center cursor-pointer border border-emerald-500/20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-emerald-500/10">
              <User size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Employee</h2>
            <p className="text-slate-400 text-sm">Access your salary dashboard and withdraw funds.</p>
          </Link>

          <Link href="/compliance" className="glass p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-200 flex flex-col items-center text-center cursor-pointer border border-blue-500/20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-blue-500/10">
              <ShieldAlert size={32} className="text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Compliance</h2>
            <p className="text-slate-400 text-sm">Audit aggregated payroll ledgers securely.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}