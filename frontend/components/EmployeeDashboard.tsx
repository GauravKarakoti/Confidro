"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useReadContract,
  useWriteContract,
  useAccount,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import {
  Wallet,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BadgeCheck,
  Clock,
  Eye,
  EyeOff,
  Building,
  ArrowLeft,
  ChevronRight,
  Plus,
  Unlock
} from "lucide-react";
import { PAYROLL_ABI, WRAPPER_ABI, WRAPPER_USDC_ADDRESS } from "@/lib/contract";
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
// Withdraw card (Strictly View & Unwrap Flow)
// ──────────────────────────────────────────────
function WithdrawCard({
  connectedAddress,
  isRegistered,
}: {
  connectedAddress?: string;
  isRegistered: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  
  const [showBalance, setShowBalance] = useState(false);
  const [decryptedBalance, setDecryptedBalance] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [unwrapAmount, setUnwrapAmount] = useState("");

  const { writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  // Read the user's Encrypted Wrapper Token Balance
  const { data: encryptedBalance, refetch: refetchBalance } = useReadContract({
    address: WRAPPER_USDC_ADDRESS,
    abi: WRAPPER_ABI,
    functionName: "getEncryptedBalance",
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

      if (!encryptedBalance) {
        throw new Error("No encrypted balance found or zero balance.");
      }

      const config = createCofheConfig({ 
        environment: "web",
        supportedChains: [baseSepolia]
      });
      const client = await createCofheClient(config);

      // Decrypt the Wrapper token balance
      const result = await client
        .decryptForView(BigInt(encryptedBalance), FheTypes.Uint64)
        .withPermit()
        .execute();
        
      setDecryptedBalance(Number(result) / 1e6); // Format from 6 decimals
      setShowBalance(true);
    } catch (err) {
      console.error("Decryption failed:", err);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleUnwrap = async () => {
    if (!unwrapAmount) return;
    try {
      setStatus("pending");
      const hash = await writeContractAsync({
        address: WRAPPER_USDC_ADDRESS,
        abi: WRAPPER_ABI,
        functionName: "unwrap",
        args: [BigInt(Number(unwrapAmount) * 1e6)], // USDC has 6 decimals
      });
      setTxHash(hash);
      setStatus("success");
      setUnwrapAmount("");
      
      // Hide balance and refetch encrypted state after unwrap
      setShowBalance(false);
      setDecryptedBalance(null);
      setTimeout(() => {
        setStatus("idle");
        refetchBalance();
      }, 5000);
    } catch (err) {
      setStatus("error");
      console.error(err);
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  const isLoading = status === "pending" || isConfirming;

  return (
    <div className="glass-green rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,255,157,0.1)" }}>
          <Wallet size={17} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="font-bold text-white text-base" style={{ fontFamily: "var(--font-display)" }}>My Salary Wallet</h3>
          <p className="text-xs text-slate-500">Manage your private funds</p>
        </div>
      </div>

      {/* Balance preview */}
      <div className="rounded-xl p-4 mb-4 flex items-center justify-between" style={{ background: "rgba(0,255,157,0.04)", border: "1px solid rgba(0,255,157,0.1)" }}>
        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">FHE Encrypted Balance</span>
            {isRegistered && (
              <button onClick={handleRevealBalance} disabled={isDecrypting || !encryptedBalance} className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50">
                {isDecrypting ? (
                  <><Loader2 size={12} className="animate-spin" /> Decrypting...</>
                ) : showBalance ? (
                  <><EyeOff size={12} /> Hide</>
                ) : (
                  <><Eye size={12} /> Reveal</>
                )}
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {showBalance && decryptedBalance !== null ? (
              <motion.div key="revealed" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>${decryptedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-sm text-slate-500">FHE-USDC</span>
              </motion.div>
            ) : (
              <motion.div key="hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-3xl font-bold text-emerald-400 tracking-widest" style={{ fontFamily: "var(--font-display)", marginTop: "-4px" }}>
                ****
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 mb-5 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
        <Clock size={16} className="text-emerald-500 shrink-0" /> 
        <span>Your salary has been pushed directly to your wallet as encrypted tokens. <strong>Unwrap them below</strong> to convert them back into public Base Sepolia USDC.</span>
      </div>

      <AnimatePresence>
        {status === "success" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 mb-3">
            <CheckCircle2 size={14} /> Unwrap successful! Check your public wallet.
          </motion.div>
        )}
        {status === "error" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-3">
            <AlertCircle size={14} /> Transaction failed. Please try again.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {/* Unwrap to Public Wallet */}
        <div className="pt-2">
          <label className="block text-xs font-medium text-slate-400 mb-2">Unwrap to Public Base Sepolia USDC</label>
          <div className="flex gap-2">
            <input 
              type="number" 
              placeholder="Amount to Unwrap" 
              className="input-field flex-1"
              value={unwrapAmount}
              onChange={(e) => setUnwrapAmount(e.target.value)}
              disabled={isLoading}
            />
            <button onClick={handleUnwrap} disabled={isLoading || !unwrapAmount} className="btn-green">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><Unlock size={14} /> Unwrap</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Active Organization View
// ──────────────────────────────────────────────
function ActiveOrganizationDashboard({ 
  contractAddress, 
  onBack 
}: { 
  contractAddress: `0x${string}`, 
  onBack: () => void 
}) {
  const { address: connectedAddress } = useAccount();

  const { data: employees, isLoading } = useReadContract({
    address: contractAddress,
    abi: PAYROLL_ABI,
    functionName: "getEmployees",
  });

  const employeeList = (employees as `0x${string}`[] | undefined) ?? [];
  const isRegistered = connectedAddress
    ? employeeList.map((a) => a.toLowerCase()).includes(connectedAddress.toLowerCase())
    : false;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-6">
        <ArrowLeft size={16} /> Back to my organizations
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(90,41,228,0.2)" }}>
                <Users size={17} className="text-violet-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base" style={{ fontFamily: "var(--font-display)" }}>Team Directory</h3>
                <p className="text-xs text-slate-500">{employeeList.length} registered employee{employeeList.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            {isRegistered && <span className="badge badge-green"><BadgeCheck size={9} /> Registered</span>}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="shimmer h-14 rounded-lg" />)}
            </div>
          ) : employeeList.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No employees registered yet.</p>
            </div>
          ) : (
            <div>
              {employeeList.map((addr, i) => (
                <EmployeeRow key={addr} address={addr} index={i} isYou={connectedAddress?.toLowerCase() === addr.toLowerCase()} />
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {/* We remove contractAddress since we only interact with the Wrapper token contract now */}
          <WithdrawCard connectedAddress={connectedAddress} isRegistered={isRegistered} />
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────
// Main export - Organization Selector
// ──────────────────────────────────────────────
export default function EmployeeDashboard() {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();

  const [activeOrg, setActiveOrg] = useState<`0x${string}` | null>(null);
  const [joinedOrgs, setJoinedOrgs] = useState<`0x${string}`[]>([]);
  const [inputAddress, setInputAddress] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (connectedAddress) {
      const saved = localStorage.getItem(`confidro_orgs_${connectedAddress}`);
      if (saved) {
        setJoinedOrgs(JSON.parse(saved));
      }
    }
  }, [connectedAddress]);

  const saveOrg = (org: `0x${string}`) => {
    if (!connectedAddress) return;
    const newOrgs = [...new Set([...joinedOrgs, org])];
    setJoinedOrgs(newOrgs);
    localStorage.setItem(`confidro_orgs_${connectedAddress}`, JSON.stringify(newOrgs));
  };

  const handleConnectOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!inputAddress.startsWith("0x") || inputAddress.length !== 42) {
      setErrorMsg("Please enter a valid smart contract address (0x...)");
      return;
    }

    try {
      setIsSearching(true);
      
      const employeeList = await publicClient?.readContract({
        address: inputAddress as `0x${string}`,
        abi: PAYROLL_ABI,
        functionName: "getEmployees",
      }) as string[];

      const isEmployee = employeeList.map(a => a.toLowerCase()).includes(connectedAddress?.toLowerCase() || "");

      if (isEmployee) {
        saveOrg(inputAddress as `0x${string}`);
        setActiveOrg(inputAddress as `0x${string}`);
        setInputAddress(""); 
      } else {
        setErrorMsg("Access Denied: You are not registered as an employee in this organization.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Error connecting. Is this a valid Confidro Protocol contract?");
    } finally {
      setIsSearching(false);
    }
  };

  if (activeOrg) {
    return <ActiveOrganizationDashboard contractAddress={activeOrg} onBack={() => setActiveOrg(null)} />;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
      <div className="glass rounded-2xl p-8 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(90,41,228,0.2)" }}>
            <Building size={20} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Your Organizations</h2>
            <p className="text-sm text-slate-400">Select an organization to view your payroll</p>
          </div>
        </div>

        {joinedOrgs.length > 0 ? (
          <div className="space-y-3 mb-8">
            {joinedOrgs.map((org) => (
              <button
                key={org}
                onClick={() => setActiveOrg(org)}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-700/50 hover:border-emerald-500/50 bg-slate-800/30 hover:bg-slate-800/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-sm text-slate-300">{org.slice(0, 8)}...{org.slice(-6)}</span>
                </div>
                <ChevronRight size={18} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 mb-8 border border-dashed border-slate-700 rounded-xl bg-slate-800/10">
            <p className="text-sm text-slate-500">You are not in any organization yet.</p>
          </div>
        )}

        <hr className="border-slate-800 mb-6" />

        <form onSubmit={handleConnectOrg}>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Join New Organization
          </label>
          <p className="text-xs text-slate-500 mb-4">Paste the payroll contract address provided by your employer.</p>
          
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="0x..."
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value)}
              className="input-field flex-1"
              disabled={isSearching}
            />
            <button 
              type="submit" 
              disabled={!inputAddress || isSearching}
              className="btn-primary whitespace-nowrap px-6"
            >
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Connect
            </button>
          </div>

          <AnimatePresence>
            {errorMsg && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mt-4">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </motion.div>
  );
}