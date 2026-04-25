"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { ConnectKitButton } from "connectkit";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
      style={{
        background:
          "linear-gradient(180deg, rgba(12,12,20,0.95) 0%, rgba(12,12,20,0.0) 100%)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #5A29E4 0%, #0A5C3E 100%)",
          }}
        >
          <ShieldCheck size={16} className="text-white" />
        </div>
        <span
          className="text-lg font-bold tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Confidro
        </span>
        <span className="badge badge-purple hidden sm:inline-flex">Beta</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Base Sepolia
        </span>
        
        {/* ConnectKit Button Drop-in */}
        <ConnectKitButton />
      </div>
    </motion.nav>
  );
}