"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Lock, Zap, Eye } from "lucide-react";

const features = [
  {
    icon: Lock,
    label: "FHE Encrypted",
    sub: "Salaries never exposed on-chain",
  },
  {
    icon: Zap,
    label: "Instant Settlement",
    sub: "Trustless crypto payroll",
  },
  {
    icon: Eye,
    label: "Zero Visibility",
    sub: "Employer controls who sees what",
  },
];

export default function Hero({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden grid-bg">
      {/* Background orbs */}
      <div
        className="absolute top-1/4 left-1/4 w-[480px] h-[480px] rounded-full orb-pulse pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(90,41,228,0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute bottom-1/3 right-1/4 w-[360px] h-[360px] rounded-full orb-pulse pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(10,92,62,0.2) 0%, transparent 70%)",
          filter: "blur(40px)",
          animationDelay: "2s",
        }}
      />

      {/* Floating shield */}
      <motion.div
        className="absolute right-[8%] top-[18%] opacity-10 float-anim hidden lg:block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.08 }}
        transition={{ delay: 0.8 }}
      >
        <ShieldCheck size={280} className="text-purple-400" />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-8"
        >
          <span className="badge badge-purple text-xs px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Powered by Fully Homomorphic Encryption
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tight mb-6"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="text-white">Payroll that </span>
          <span
            style={{
              background: "linear-gradient(135deg, #A080FF 0%, #00FF9D 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            keeps your secrets
          </span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10"
        >
          Confidro is the first privacy-preserving on-chain payroll protocol.
          Pay your team in crypto — salary amounts stay encrypted end-to-end via
          FHE on the Fhenix network.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <button
            onClick={onLaunch}
            className="btn-primary text-base px-8 py-3.5 w-full sm:w-auto"
          >
            <ShieldCheck size={18} />
            Launch App
          </button>
          <a
            href="https://github.com/GauravKarakoti/Confidro"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-base px-8 py-3.5 w-full sm:w-auto"
          >
            View Docs
          </a>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {features.map(({ icon: Icon, label, sub }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="glass rounded-xl px-5 py-3.5 flex items-center gap-3 w-full sm:w-auto"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(90,41,228,0.2)" }}
              >
                <Icon size={16} className="text-violet-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white">{label}</div>
                <div className="text-xs text-slate-500">{sub}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background:
            "linear-gradient(0deg, #0C0C14 0%, transparent 100%)",
        }}
      />
    </section>
  );
}
