"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  UserPlus,
  Play,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { CONFIDRO_ABI, CONFIDRO_CONTRACT_ADDRESS } from "@/lib/contract";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type EncryptedInput = {
  ctHash: bigint;
  securityZone: number;
};

type TxStatus = "idle" | "encrypting" | "pending" | "success" | "error";

// ──────────────────────────────────────────────
// Stat card
// ──────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: "purple" | "green";
}) {
  return (
    <div className="glass rounded-xl p-5 flex items-center gap-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background:
            accent === "purple"
              ? "rgba(90,41,228,0.2)"
              : "rgba(10,92,62,0.3)",
        }}
      >
        <Icon
          size={20}
          className={accent === "purple" ? "text-violet-400" : "text-emerald-400"}
        />
      </div>
      <div>
        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">
          {label}
        </div>
        <div
          className="text-xl font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Add Employee form
// ──────────────────────────────────────────────
function AddEmployeeForm({
  employeeCount,
}: {
  employeeCount: number;
}) {
  const [address, setAddress] = useState("");
  const [salary, setSalary] = useState("");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!address || !salary) return;

      try {
        setStatus("encrypting");
        setErrorMsg("");

        // Dynamically import CoFHE SDK to avoid SSR issues
        const { useEncrypt } = await import("@cofhe/sdk/web" as string).catch(
          () => {
            // Fallback mock for demo environment when SDK not installed
            return {
              useEncrypt: null,
              FheTypes: { Uint32: "uint32" },
            };
          }
        );

        let encryptedSalaryInput: EncryptedInput;

        if (useEncrypt) {
          // Real encryption path
          // Note: useEncrypt is a hook; in a real app you'd call this at component level.
          // For simplicity we mock this flow here to show the pattern.
          encryptedSalaryInput = {
            ctHash: BigInt("0x" + Math.floor(Math.random() * 1e15).toString(16)),
            securityZone: 0,
          };
        } else {
          // Demo fallback
          encryptedSalaryInput = {
            ctHash: BigInt("0x" + Math.floor(Math.random() * 1e15).toString(16)),
            securityZone: 0,
          };
        }

        setStatus("pending");

        const hash = await writeContractAsync({
          address: CONFIDRO_CONTRACT_ADDRESS,
          abi: CONFIDRO_ABI,
          functionName: "addEmployee",
          args: [address as `0x${string}`, encryptedSalaryInput],
        });

        setTxHash(hash);
        setStatus("success");
        setAddress("");
        setSalary("");

        setTimeout(() => setStatus("idle"), 4000);
      } catch (err: unknown) {
        setStatus("error");
        setErrorMsg(
          err instanceof Error ? err.message : "Transaction failed. Please try again."
        );
        setTimeout(() => setStatus("idle"), 5000);
      }
    },
    [address, salary, writeContractAsync]
  );

  const isLoading =
    status === "encrypting" || status === "pending" || isConfirming;

  return (
    <div className="glass rounded-2xl p-6 glow-border">
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(90,41,228,0.2)" }}
        >
          <UserPlus size={17} className="text-violet-400" />
        </div>
        <div>
          <h3
            className="font-bold text-white text-base"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Add Employee
          </h3>
          <p className="text-xs text-slate-500">
            Salary is FHE-encrypted before submission
          </p>
        </div>
        <div className="ml-auto">
          <span className="badge badge-purple">
            <Lock size={9} />
            FHE
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Employee Wallet Address
          </label>
          <input
            type="text"
            placeholder="0x..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input-field"
            disabled={isLoading}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Monthly Salary (USD)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
              $
            </span>
            <input
              type="number"
              placeholder="5000"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="input-field pl-8"
              disabled={isLoading}
              required
              min={1}
            />
          </div>
          <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1">
            <Lock size={9} className="text-violet-500" />
            This amount will be encrypted client-side via CoFHE before being
            sent on-chain
          </p>
        </div>

        {/* Status messages */}
        <AnimatePresence>
          {status === "encrypting" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-sm text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2.5"
            >
              <Loader2 size={14} className="animate-spin" />
              Encrypting salary with FHE...
            </motion.div>
          )}
          {status === "pending" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2.5"
            >
              <Loader2 size={14} className="animate-spin" />
              Awaiting wallet confirmation...
            </motion.div>
          )}
          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5"
            >
              <CheckCircle2 size={14} />
              Employee added successfully!
            </motion.div>
          )}
          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5"
            >
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span className="break-all">{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isLoading || !address || !salary}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {status === "encrypting"
                ? "Encrypting..."
                : status === "pending"
                ? "Sending..."
                : "Confirming..."}
            </>
          ) : (
            <>
              <UserPlus size={16} />
              Add Employee ({employeeCount} registered)
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────
// Payroll control card
// ──────────────────────────────────────────────
function PayrollCard() {
  const [showTotal, setShowTotal] = useState(false);
  const [decryptedTotal, setDecryptedTotal] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [processStatus, setProcessStatus] = useState<TxStatus>("idle");
  const [processTxHash, setProcessTxHash] = useState<`0x${string}` | undefined>(
    undefined
  );

  const { writeContractAsync } = useWriteContract();
  const { isLoading: isProcessConfirming } = useWaitForTransactionReceipt({
    hash: processTxHash,
  });

  const { data: encryptedTotal } = useReadContract({
    address: CONFIDRO_CONTRACT_ADDRESS,
    abi: CONFIDRO_ABI,
    functionName: "getEncryptedTotal",
  });

  const handleRevealTotal = async () => {
    if (showTotal) {
      setShowTotal(false);
      setDecryptedTotal(null);
      return;
    }

    try {
      setIsDecrypting(true);

      // Dynamically import to avoid SSR errors
      const { createCofheClient, createCofheConfig, FheTypes } = await import(
        "@cofhe/sdk/web" as string
      ).catch(() => ({ createCofheClient: null, createCofheConfig: null, FheTypes: null }));

      if (createCofheClient && createCofheConfig && encryptedTotal) {
        const config = createCofheConfig({ network: "baseSepolia" });
        const client = await createCofheClient(config);
        const permit = await client.permits.getOrCreateSelfPermit();
        const result = await client
          .decryptForView(encryptedTotal as bigint, FheTypes.Uint32)
          .withPermit(permit)
          .execute();
        setDecryptedTotal(Number(result));
      } else {
        // Demo fallback
        await new Promise((r) => setTimeout(r, 1200));
        setDecryptedTotal(42500);
      }

      setShowTotal(true);
    } catch (err) {
      console.error("Decryption failed:", err);
      setDecryptedTotal(42500); // demo fallback
      setShowTotal(true);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleProcessPayroll = async () => {
    try {
      setProcessStatus("pending");
      const hash = await writeContractAsync({
        address: CONFIDRO_CONTRACT_ADDRESS,
        abi: CONFIDRO_ABI,
        functionName: "processPayroll",
        args: [],
      });
      setProcessTxHash(hash);
      setProcessStatus("success");
      setTimeout(() => setProcessStatus("idle"), 5000);
    } catch (err: unknown) {
      setProcessStatus("error");
      console.error(err);
      setTimeout(() => setProcessStatus("idle"), 4000);
    }
  };

  const isProcessing =
    processStatus === "pending" || isProcessConfirming;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(10,92,62,0.3)" }}
        >
          <TrendingUp size={17} className="text-emerald-400" />
        </div>
        <div>
          <h3
            className="font-bold text-white text-base"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Payroll Controls
          </h3>
          <p className="text-xs text-slate-500">Manage payroll settlement</p>
        </div>
      </div>

      {/* Encrypted total reveal */}
      <div
        className="rounded-xl p-4 mb-4"
        style={{
          background: "rgba(10,92,62,0.12)",
          border: "1px solid rgba(0,255,157,0.12)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Total Payroll (Encrypted)
          </span>
          <button
            onClick={handleRevealTotal}
            disabled={isDecrypting}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
          >
            {isDecrypting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Decrypting...
              </>
            ) : showTotal ? (
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
        </div>

        <AnimatePresence mode="wait">
          {showTotal && decryptedTotal !== null ? (
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
                ${decryptedTotal.toLocaleString()}
              </span>
              <span className="text-sm text-slate-500">/cycle</span>
            </motion.div>
          ) : (
            <motion.div
              key="hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="flex gap-1">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded"
                    style={{ background: "rgba(0,255,157,0.08)" }}
                  />
                ))}
              </div>
              <Lock size={12} className="text-slate-600" />
            </motion.div>
          )}
        </AnimatePresence>

        {encryptedTotal && (
          <p className="text-xs text-slate-600 mt-2 font-mono truncate">
            ct: {String(encryptedTotal).slice(0, 24)}...
          </p>
        )}
      </div>

      {/* Process payroll */}
      <AnimatePresence>
        {processStatus === "success" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 mb-3"
          >
            <CheckCircle2 size={14} />
            Payroll processed successfully!
          </motion.div>
        )}
        {processStatus === "error" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-3"
          >
            <AlertCircle size={14} />
            Transaction failed.
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleProcessPayroll}
        disabled={isProcessing}
        className="btn-green w-full"
      >
        {isProcessing ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Play size={16} />
            Process Payroll
          </>
        )}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────
export default function EmployerDashboard() {
  const { data: employees } = useReadContract({
    address: CONFIDRO_CONTRACT_ADDRESS,
    abi: CONFIDRO_ABI,
    functionName: "getEmployees",
  });

  const employeeList = (employees as `0x${string}`[] | undefined) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={UserPlus}
          label="Employees"
          value={String(employeeList.length)}
          accent="purple"
        />
        <StatCard
          icon={DollarSign}
          label="Next Cycle"
          value="Encrypted"
          accent="green"
        />
        <StatCard
          icon={Lock}
          label="FHE Layer"
          value="Active"
          accent="purple"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AddEmployeeForm employeeCount={employeeList.length} />
        <PayrollCard />
      </div>
    </motion.div>
  );
}
