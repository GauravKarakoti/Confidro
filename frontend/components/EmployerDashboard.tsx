"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useWalletClient,
  useAccount,
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
  Copy,
  Check,
  ShieldCheck,
  Anchor
} from "lucide-react";
import { PAYROLL_ABI } from "@/lib/contract";
import { baseSepolia } from "@cofhe/sdk/chains";

interface EmployerDashboardProps {
  contractAddress: `0x${string}`;
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type EncryptedInput = {
  ctHash: bigint;
  securityZone: number;
  utype: number;
  signature: `0x${string}`;
};

type TxStatus = "idle" | "encrypting" | "pending" | "success" | "error";

function ConfigurationPanel({ contractAddress }: { contractAddress: `0x${string}` }) {
  const [officer, setOfficer] = useState("");
  const [escrow, setEscrow] = useState("");
  const { writeContractAsync } = useWriteContract();

  const handleAddCompliance = async () => {
    await writeContractAsync({
      address: contractAddress,
      abi: PAYROLL_ABI,
      functionName: "addCompliance",
      args: [officer as `0x${string}`],
    });
  };

  const handleSetEscrow = async () => {
    await writeContractAsync({
      address: contractAddress,
      abi: PAYROLL_ABI,
      functionName: "setPrivaraEscrow",
      args: [escrow as `0x${string}`],
    });
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-6 mt-6">
      <h3 className="font-bold text-white flex items-center gap-2">
        <ShieldCheck className="text-violet-400" /> Administrative Config
      </h3>
      <div className="flex gap-2">
        <input 
          placeholder="Compliance Officer Address" 
          className="input-field flex-1" 
          onChange={(e) => setOfficer(e.target.value)} 
        />
        <button onClick={handleAddCompliance} className="btn-primary">Add Role</button>
      </div>
      <div className="flex gap-2">
        <input 
          placeholder="Privara Escrow Address" 
          className="input-field flex-1" 
          onChange={(e) => setEscrow(e.target.value)} 
        />
        <button onClick={handleSetEscrow} className="btn-primary">Set Escrow</button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Address Banner
// ──────────────────────────────────────────────
function AddressBanner({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="glass rounded-xl p-4 mb-6 flex sm:flex-row flex-col sm:items-center justify-between gap-3 border" 
      style={{ 
        background: "rgba(90,41,228,0.05)",
        borderColor: "rgba(90,41,228,0.2)"
      }}
    >
      <div>
        <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
          Organization Contract Address (Share with Employees)
        </div>
        <div className="text-sm font-mono text-violet-300 break-all">
          {address}
        </div>
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs transition-colors border border-white/10 flex-shrink-0"
      >
        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-300" />}
        {copied ? "Copied!" : "Copy Address"}
      </button>
    </div>
  );
}

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

function AddEmployeeForm({ employeeCount, contractAddress }: { employeeCount: number, contractAddress: `0x${string}` }) {
  const [address, setAddress] = useState("");
  const [salary, setSalary] = useState("");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // 1. Fetch wallet clients from Wagmi
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: userAddress, chainId } = useAccount();

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

        // 2. Ensure wallet is connected
        if (!publicClient || !walletClient || !userAddress || !chainId) {
          throw new Error("Please connect your wallet first.");
        }

        const cofheWeb = await import("@cofhe/sdk/web");
        const cofheCore = await import("@cofhe/sdk");
        
        const { createCofheConfig, createCofheClient } = cofheWeb;
        const { Encryptable } = cofheCore;

        const config = createCofheConfig({ 
          environment: "web",
          supportedChains: [baseSepolia]
        });
        const client = await createCofheClient(config);
        
        // 3. Connect the CoFHE client to the user's wallet
        await client.connect(publicClient, walletClient);
        
        // Real FHE encryption on the client using encryptInputs
        const encryptedInputs = await client.encryptInputs([
          Encryptable.uint32(BigInt(salary))
        ]).execute();

        const encryptedResult = encryptedInputs[0];

        // Format the input based on the updated ABI struct InEuint32
        const encryptedSalaryInput: EncryptedInput = {
          ctHash: encryptedResult.ctHash,
          securityZone: encryptedResult.securityZone,
          utype: encryptedResult.utype,
          signature: encryptedResult.signature as `0x${string}`,
        };

        setStatus("pending");

        const hash = await writeContractAsync({
          address: contractAddress, // USE PROP HERE
          abi: PAYROLL_ABI,         // USE NEW ABI NAME
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

function PayrollCard({ contractAddress }: { contractAddress: `0x${string}` }) {
  const [showTotal, setShowTotal] = useState(false);
  const [decryptedTotal, setDecryptedTotal] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [processStatus, setProcessStatus] = useState<TxStatus>("idle");
  const [processTxHash, setProcessTxHash] = useState<`0x${string}` | undefined>(
    undefined
  );
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: userAddress, chainId } = useAccount();

  const { writeContractAsync } = useWriteContract();
  const { isLoading: isProcessConfirming } = useWaitForTransactionReceipt({
    hash: processTxHash,
  });

  const { data: encryptedTotal } = useReadContract({
    address: contractAddress,  // USE PROP HERE
    abi: PAYROLL_ABI,          // USE NEW ABI NAME
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

      if (!publicClient || !walletClient || !userAddress || !chainId) {
        throw new Error("Please connect your wallet first.");
      }

      if (!encryptedTotal || BigInt(encryptedTotal) === BigInt(0)) {
        throw new Error("No payroll data available yet. Add an employee first.");
      }

      const cofheWeb = await import("@cofhe/sdk/web");
      const cofheCore = await import("@cofhe/sdk");
      
      const { createCofheConfig, createCofheClient } = cofheWeb;
      const { FheTypes } = cofheCore;

      const config = createCofheConfig({ 
        environment: "web",
        supportedChains: [baseSepolia]
      });
      const client = await createCofheClient(config);

      await client.connect(publicClient, walletClient);

      const permit = await client.permits.getOrCreateSelfPermit(chainId, userAddress);

      const result = await client
        .decryptForView(BigInt(encryptedTotal), FheTypes.Uint32)
        .withPermit(permit) 
        .execute();
        
      setDecryptedTotal(Number(result));
      setShowTotal(true);
    } catch (err) {
      console.error("Decryption failed:", err);
    } finally {
      setIsDecrypting(false);
    }
  };

 const handleProcessPayroll = async () => {
    try {
      setProcessStatus("pending");
      const hash = await writeContractAsync({
        address: contractAddress, // USE PROP HERE
        abi: PAYROLL_ABI,         // USE NEW ABI NAME
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
            disabled={isDecrypting || !encryptedTotal}
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

export default function EmployerDashboard({ contractAddress }: EmployerDashboardProps) {
  const { data: employees } = useReadContract({
    address: contractAddress, // USE PROP HERE
    abi: PAYROLL_ABI,         // USE NEW ABI NAME
    functionName: "getEmployees",
  });

  const employeeList = (employees as `0x${string}`[] | undefined) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Contract Address Banner for quick copy */}
      <AddressBanner address={contractAddress} />

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pass the address down to child components */}
        <AddEmployeeForm employeeCount={employeeList.length} contractAddress={contractAddress} />
        <PayrollCard contractAddress={contractAddress} />
      </div>

      {/* ADD THE CONFIGURATION PANEL HERE */}
      <ConfigurationPanel contractAddress={contractAddress} />
      
    </motion.div>
  );
}