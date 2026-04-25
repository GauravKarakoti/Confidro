"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Briefcase,
  User,
  ShieldCheck,
  Wallet,
  ChevronDown,
} from "lucide-react";
import EmployerDashboard from "./EmployerDashboard";
import EmployeeDashboard from "./EmployeeDashboard";

type Role = "employer" | "employee";

function RoleToggle({
  role,
  onChange,
}: {
  role: Role;
  onChange: (r: Role) => void;
}) {
  return (
    <div
      className="relative flex p-1 rounded-xl"
      style={{
        background: "rgba(18,18,30,0.8)",
        border: "1px solid rgba(90,41,228,0.2)",
      }}
    >
      {/* Sliding indicator */}
      <motion.div
        layoutId="roleIndicator"
        className="absolute top-1 bottom-1 rounded-lg"
        style={{
          background: "linear-gradient(135deg, #5A29E4 0%, #7B4FF0 100%)",
          width: "calc(50% - 2px)",
          left: role === "employer" ? "4px" : "calc(50% + 2px)",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />

      {(["employer", "employee"] as Role[]).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className="relative z-10 flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 flex-1 justify-center"
          style={{
            color: role === r ? "white" : "rgba(160,160,190,0.7)",
            fontFamily: "var(--font-body)",
          }}
        >
          {r === "employer" ? (
            <Briefcase size={14} />
          ) : (
            <User size={14} />
          )}
          {r.charAt(0).toUpperCase() + r.slice(1)}
        </button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { isConnected, address } = useAccount();
  const [role, setRole] = useState<Role>("employer");

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 grid-bg">
        {/* BG orbs */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(90,41,228,0.15) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="glass rounded-2xl p-8 max-w-sm w-full text-center"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: "linear-gradient(135deg, #5A29E4 0%, #0A5C3E 100%)",
            }}
          >
            <ShieldCheck size={26} className="text-white" />
          </div>
          <h2
            className="text-xl font-bold text-white mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Connect your wallet
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Connect to Base Sepolia to access the Confidro payroll dashboard.
          </p>
          <div className="flex justify-center">
            <ConnectButton label="Connect Wallet" />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8 grid-bg">
      {/* Background */}
      <div
        className="fixed top-0 right-0 w-[600px] h-[600px] pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, rgba(90,41,228,0.1) 0%, transparent 60%)",
        }}
      />
      <div
        className="fixed bottom-0 left-0 w-[400px] h-[400px] pointer-events-none opacity-30"
        style={{
          background:
            "radial-gradient(circle at 20% 80%, rgba(10,92,62,0.12) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {role === "employer" ? "Employer" : "Employee"} Dashboard
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Wallet size={12} className="text-slate-500" />
              <span className="text-xs text-slate-500 font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <span className="badge badge-green">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Base Sepolia
              </span>
            </div>
          </div>

          <RoleToggle role={role} onChange={setRole} />
        </motion.div>

        {/* Dashboard content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {role === "employer" ? (
              <EmployerDashboard />
            ) : (
              <EmployeeDashboard />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
