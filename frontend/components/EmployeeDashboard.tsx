"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useReadContract,
  useWriteContract,
  useAccount,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  Wallet,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowDownToLine,
  BadgeCheck,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import { CONFIDRO_ABI, CONFIDRO_CONTRACT_ADDRESS } from "@/lib/contract";
import { baseSepolia } from "@cofhe/sdk/chains";

// ──────────────────────────────────────────────
// Employee row
// ──────────────────────────────────────────────
function EmployeeRow({
  address,
  index,
  isYou,
}: {
  address: string;
  index: number;
  isYou: boolean;
}) {
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex items-center justify-between py-3 border-b border-slate-800/50 last:border-0"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{
            background: `hsl(${(parseInt(address.slice(2, 8), 16) % 360)}, 60%, 25%)`,
            border: isYou
              ? "1.5px solid rgba(0,255,157,0.5)"
              : "1.5px solid rgba(90,41,228,0.25)",
            color: isYou ? "#00FF9D" : "#A080FF",
          }}
        >
          {address.slice(2, 4).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-mono text-slate-300 flex items-center gap-2">
            {short}
            {isYou && (
              <span className="badge badge-green text-[10px]">
                <BadgeCheck size={9} />
                You
              </span>
            )}
          </div>
          <div className="text-xs text-slate-600">Registered employee</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <CheckCircle2 size={12} className="text-emerald-500" />
        Active
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────
// Withdraw card
// ──────────────────────────────────────────────
function WithdrawCard({
  connectedAddress,
  isRegistered,
}: {
  connectedAddress?: string;
  isRegistered: boolean;
}) {
  const [status, setStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  
  const [showBalance, setShowBalance] = useState(false);
  const [decryptedBalance, setDecryptedBalance] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const { writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const { data: encryptedSalary } = useReadContract({
    address: CONFIDRO_CONTRACT_ADDRESS,
    abi: CONFIDRO_ABI,
    functionName: "salaries",
    args: connectedAddress ? [connectedAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!connectedAddress && isRegistered,
    },
  });

  const handleRevealBalance = async () => {
    if (showBalance) {
      setShowBalance(false);
      setDecryptedBalance(null);
      return;
    }

    try {
      setIsDecrypting(true);

      const cofheWeb = await import("@cofhe/sdk/web");
      // @ts-ignore
      const cofheCore = await import("@cofhe/sdk");
      
      const { createCofheConfig, createCofheClient } = cofheWeb;
      const { FheTypes } = cofheCore;

      if (!encryptedSalary) {
        throw new Error("No encrypted salary found or zero balance.");
      }

      const config = createCofheConfig({ 
        environment: "web",
        supportedChains: [baseSepolia]
      });
      const client = await createCofheClient(config);

      const result = await client
        .decryptForView(BigInt(encryptedSalary), FheTypes.Uint32)
        .withPermit()
        .execute();
        
      setDecryptedBalance(Number(result));
      setShowBalance(true);
    } catch (err) {
      console.error("Decryption failed:", err);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleWithdraw = useCallback(async () => {
    try {
      setStatus("pending");
      const hash = await writeContractAsync({
        address: CONFIDRO_CONTRACT_ADDRESS,
        abi: CONFIDRO_ABI,
        functionName: "withdrawSalary",
        args: [],
      });
      setTxHash(hash);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 5000);
    } catch (err: unknown) {
      setStatus("error");
      console.error(err);
      setTimeout(() => setStatus("idle"), 4000);
    }
  }, [writeContractAsync]);

  const isLoading = status === "pending" || isConfirming;

  return (
    <div className="glass-green rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(0,255,157,0.1)" }}
        >
          <Wallet size={17} className="text-emerald-400" />
        </div>
        <div>
          <h3
            className="font-bold text-white text-base"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Withdraw Salary
          </h3>
          <p className="text-xs text-slate-500">
            Claim your available balance
          </p>
        </div>
      </div>

      {/* Balance preview */}
      <div
        className="rounded-xl p-4 mb-4 flex items-center justify-between"
        style={{
          background: "rgba(0,255,157,0.04)",
          border: "1px solid rgba(0,255,157,0.1)",
        }}
      >
        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Available Balance
            </span>
            {isRegistered && (
              <button
                onClick={handleRevealBalance}
                disabled={isDecrypting || !encryptedSalary}
                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
              >
                {isDecrypting ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Decrypting...
                  </>
                ) : showBalance ? (
                  <>
                    <EyeOff size={12} />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye size={12} />
                    Reveal
                  </>
                )}
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {showBalance && decryptedBalance !== null ? (
              <motion.div
                key="revealed"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-baseline gap-1"
              >
                <span
                  className="text-3xl font-bold text-emerald-400"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  ${decryptedBalance.toLocaleString()}
                </span>
                <span className="text-sm text-slate-500">USD</span>
              </motion.div>
            ) : (
              <motion.div
                key="hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-3xl font-bold text-emerald-400 tracking-widest"
                style={{ fontFamily: "var(--font-display)", marginTop: "-4px" }}
              >
                ****
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-xs text-slate-600 mt-1.5">
            {showBalance 
              ? "Your private balance revealed via FHE decryption"
              : "Amount is private — encrypted on-chain"}
          </div>
        </div>
      </div>

      {/* Next payout */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-5">
        <Clock size={12} />
        Next payroll cycle: determined by employer
      </div>

      {/* Status */}
      <AnimatePresence>
        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 mb-3"
          >
            <CheckCircle2 size={14} />
            Withdrawal successful! Funds sent to your wallet.
          </motion.div>
        )}
        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-3"
          >
            <AlertCircle size={14} />
            Transaction failed. Please try again.
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleWithdraw}
        disabled={isLoading || !isRegistered}
        className="btn-green w-full"
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {status === "pending" ? "Sending..." : "Confirming..."}
          </>
        ) : (
          <>
            <ArrowDownToLine size={16} />
            Withdraw My Salary
          </>
        )}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────
export default function EmployeeDashboard() {
  const { address: connectedAddress } = useAccount();

  const { data: employees, isLoading } = useReadContract({
    address: CONFIDRO_CONTRACT_ADDRESS,
    abi: CONFIDRO_ABI,
    functionName: "getEmployees",
  });

  const employeeList = (employees as `0x${string}`[] | undefined) ?? [];
  const isRegistered = connectedAddress
    ? employeeList
        .map((a) => a.toLowerCase())
        .includes(connectedAddress.toLowerCase())
    : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="grid grid-cols-1 lg:grid-cols-5 gap-6"
    >
      {/* Employee list — 3 cols */}
      <div className="lg:col-span-3 glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(90,41,228,0.2)" }}
            >
              <Users size={17} className="text-violet-400" />
            </div>
            <div>
              <h3
                className="font-bold text-white text-base"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Team Directory
              </h3>
              <p className="text-xs text-slate-500">
                {employeeList.length} registered employee
                {employeeList.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {isRegistered && (
            <span className="badge badge-green">
              <BadgeCheck size={9} />
              Registered
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="shimmer h-14 rounded-lg" />
            ))}
          </div>
        ) : employeeList.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No employees registered yet.</p>
            <p className="text-xs mt-1">
              The employer needs to add employees first.
            </p>
          </div>
        ) : (
          <div>
            {employeeList.map((addr, i) => (
              <EmployeeRow
                key={addr}
                address={addr}
                index={i}
                isYou={
                  connectedAddress?.toLowerCase() === addr.toLowerCase()
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Withdraw — 2 cols */}
      <div className="lg:col-span-2">
        <WithdrawCard 
          connectedAddress={connectedAddress} 
          isRegistered={isRegistered} 
        />

        {!isRegistered && connectedAddress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 glass rounded-xl p-4"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle size={15} className="text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-400 font-medium">
                  Not registered
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your wallet is not yet added as an employee. Contact your
                  employer to get registered.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}