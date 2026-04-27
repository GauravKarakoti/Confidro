"use client";

import { useState, useCallback, useEffect } from "react";
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
  Anchor,
  Wallet,
  Unlock,
  Clock
} from "lucide-react";
import { ESCROW_ABI, PAYROLL_ABI, WRAPPER_ETH_ADDRESS, WRAPPER_USDC_ADDRESS, WRAPPER_ABI } from "@/lib/contract";
import { baseSepolia } from "@cofhe/sdk/chains";
import { erc20Abi, formatUnits, parseUnits } from "viem";

interface EmployerDashboardProps {
  contractAddress: `0x${string}`;
}

type EncryptedInput = {
  ctHash: bigint;
  securityZone: number;
  utype: number;
  signature: `0x${string}`;
};

type TxStatus = "idle" | "encrypting" | "pending" | "success" | "error";

function EscrowManagement({ contractAddress }: { contractAddress: `0x${string}` }) {
  const [officer, setOfficer] = useState("");
  
  // Deposit States
  const [depositAmount, setDepositAmount] = useState("");
  const [depositToken, setDepositToken] = useState<"0" | "1">("0");
  
  // Withdraw States
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawToken, setWithdrawToken] = useState<"0" | "1">("0");
  
  // Reveal Budget States
  const [showBudget, setShowBudget] = useState(false);
  const [budgetETH, setBudgetETH] = useState<string | null>(null);
  const [budgetUSDC, setBudgetUSDC] = useState<string | null>(null);
  const [isDecryptingBudget, setIsDecryptingBudget] = useState(false);

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: userAddress, chainId } = useAccount();

  const { data: currentEscrow } = useReadContract({
    address: contractAddress,
    abi: PAYROLL_ABI,
    functionName: "privaraEscrow",
  });

  const hasEscrow = currentEscrow && currentEscrow !== "0x0000000000000000000000000000000000000000";

  const handleAddCompliance = async () => {
    if (!officer) return;
    await writeContractAsync({
      address: contractAddress,
      abi: PAYROLL_ABI,
      functionName: "addCompliance",
      args: [officer as `0x${string}`],
    });
    setOfficer("");
  };

  const handleDeployEscrow = async () => {
    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: PAYROLL_ABI,
        functionName: "deployAndSetEscrow",
        args: [
          WRAPPER_ETH_ADDRESS,
          WRAPPER_USDC_ADDRESS 
        ],
      });
      console.log("Deploy tx:", hash);
      alert("Escrow deployed and linked successfully!");
    } catch (e) { 
      console.error(e); 
    }
  };

  const handleDepositTokens = async () => {
    if (!hasEscrow || !depositAmount) return;
    try {
      const isETH = depositToken === "0";
      const decimals = isETH ? 18 : 6;
      
      const amountParsed = parseUnits(depositAmount, decimals);

      if (isETH) {
        await writeContractAsync({
          address: currentEscrow as `0x${string}`,
          abi: ESCROW_ABI,
          functionName: "depositTokens",
          args: [amountParsed, 0],
          value: amountParsed, 
          gas: BigInt(8000000), 
        });
      } else {
        if (!publicClient) throw new Error("Public client not found");

        const underlyingUSDC = await publicClient.readContract({
          address: WRAPPER_USDC_ADDRESS,
          abi: WRAPPER_ABI,
          functionName: "underlying",
        });

        const approveTxHash = await writeContractAsync({
          address: underlyingUSDC as `0x${string}`,
          abi: erc20Abi, 
          functionName: "approve",
          args: [currentEscrow as `0x${string}`, amountParsed],
        });

        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

        alert("Approval successful! Now confirming deposit...");

        await writeContractAsync({
          address: currentEscrow as `0x${string}`,
          abi: ESCROW_ABI,
          functionName: "depositTokens",
          args: [amountParsed, 1],
          gas: BigInt(8000000), 
        });
      }
      setDepositAmount("");
    } catch (e) {
      console.error(e);
      alert("Transaction failed. Check console for details.");
    }
  };

  const handleRevealBudget = async () => {
    if (showBudget) {
      setShowBudget(false);
      setBudgetETH(null);
      setBudgetUSDC(null);
      return;
    }

    try {
      setIsDecryptingBudget(true);
      if (!publicClient || !walletClient || !userAddress || !chainId) {
        throw new Error("Please connect your wallet first.");
      }

      // [FIX]: Read explicitly from the Escrow contract's allowed budget variables, 
      // NOT the token wrapper's encrypted balances
      const encETH = await publicClient.readContract({
        address: currentEscrow as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: "budgetETH",
      });

      const encUSDC = await publicClient.readContract({
        address: currentEscrow as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: "budgetUSDC",
      });

      const cofheWeb = await import("@cofhe/sdk/web");
      const cofheCore = await import("@cofhe/sdk");
      
      const { createCofheConfig, createCofheClient } = cofheWeb;
      const { FheTypes } = cofheCore;

      const config = createCofheConfig({ environment: "web", supportedChains: [baseSepolia] });
      const client = await createCofheClient(config);
      await client.connect(publicClient, walletClient);
      let permit = await client.permits.getOrCreateSelfPermit(chainId, userAddress);
      
      // Convert handles to BigInt safely (handling both viem bigint and string returns)
      const ethHandle = BigInt(encETH?.toString() || "0");
      const usdcHandle = BigInt(encUSDC?.toString() || "0");
      
      let resETH = BigInt(0);
      let resUSDC = BigInt(0);

      try {
        const promises = [];
        
        if (ethHandle !== BigInt(0)) {
          promises.push(client.decryptForView(ethHandle, FheTypes.Uint64).withPermit(permit).execute());
        } else {
          promises.push(Promise.resolve(BigInt(0)));
        }

        if (usdcHandle !== BigInt(0)) {
          promises.push(client.decryptForView(usdcHandle, FheTypes.Uint64).withPermit(permit).execute());
        } else {
          promises.push(Promise.resolve(BigInt(0)));
        }

        [resETH, resUSDC] = await Promise.all(promises);
        
      } catch (err: any) {
        // Retry logic for expired permits
        if (err.message?.toLowerCase().includes("expired")) {
          client.permits.removeActivePermit(chainId, userAddress);
          permit = await client.permits.getOrCreateSelfPermit(chainId, userAddress);
          
          const retryPromises = [];
          retryPromises.push(ethHandle !== BigInt(0) ? client.decryptForView(ethHandle, FheTypes.Uint64).withPermit(permit).execute() : Promise.resolve(BigInt(0)));
          retryPromises.push(usdcHandle !== BigInt(0) ? client.decryptForView(usdcHandle, FheTypes.Uint64).withPermit(permit).execute() : Promise.resolve(BigInt(0)));
          
          [resETH, resUSDC] = await Promise.all(retryPromises);
        } else {
          throw err;
        }
      }
        
      setBudgetETH(formatUnits(resETH, 18));
      setBudgetUSDC(formatUnits(resUSDC, 6));
      setShowBudget(true);
    } catch (err) {
      console.error("Decryption failed:", err);
    } finally {
      setIsDecryptingBudget(false);
    }
  };

  const handleWithdrawTokens = async () => {
    if (!hasEscrow || !withdrawAmount) return;
    try {
      const isETH = withdrawToken === "0";
      const decimals = isETH ? 18 : 6;
      const amountParsed = parseUnits(withdrawAmount, decimals);

      await writeContractAsync({
        address: currentEscrow as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: "withdrawTokens",
        args: [amountParsed, withdrawToken === "0" ? 0 : 1],
        gas: BigInt(8000000), 
      });
      
      setWithdrawAmount("");
      alert("Withdrawal successful!");
    } catch (e) {
      console.error(e);
      alert("Transaction failed. Check console for details.");
    }
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-6 h-full flex flex-col">
      <h3 className="font-bold text-white flex items-center gap-2">
        <ShieldCheck className="text-violet-400" /> Admin & Escrow Management
      </h3>
      
      <div className="flex gap-2">
        <input 
          placeholder="Compliance Officer Address" 
          className="input-field flex-1" 
          value={officer}
          onChange={(e) => setOfficer(e.target.value)} 
        />
        <button onClick={handleAddCompliance} className="btn-primary">Add Role</button>
      </div>

      <div className="border-t border-white/10 pt-4 mt-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Anchor size={14} className="text-emerald-400" /> Escrow Budget Wallet
          </h4>
          
          {hasEscrow && (
            <button
              onClick={handleRevealBudget}
              disabled={isDecryptingBudget}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
            >
              {isDecryptingBudget ? <><Loader2 size={12} className="animate-spin" /> Decrypting...</> : showBudget ? <><EyeOff size={12} /> Hide Budget</> : <><Eye size={12} /> Reveal Budget</>}
            </button>
          )}
        </div>
        
        {!hasEscrow ? (
          <div className="flex flex-col gap-3">
            <button onClick={handleDeployEscrow} className="btn-primary w-full sm:w-auto">
              Deploy Organization Escrow
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Reveal Budget Section */}
            <AnimatePresence mode="wait">
              {showBudget && budgetETH !== null && budgetUSDC !== null ? (
                <motion.div key="revealed" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex flex-col gap-2 bg-white/5 p-4 rounded-xl">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-blue-400" style={{ fontFamily: "var(--font-display)" }}>
                      {parseFloat(budgetETH)}
                    </span>
                    <span className="text-sm text-slate-500">ETH Available</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>
                      ${parseFloat(budgetUSDC)}
                    </span>
                    <span className="text-sm text-slate-500">USDC Available</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[...Array(8)].map((_, i) => <div key={i} className="w-5 h-5 rounded" style={{ background: "rgba(0,255,157,0.08)" }} />)}
                  </div>
                  <Lock size={12} className="text-slate-600" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Deposit Form */}
            <div className="flex gap-2">
              <select value={depositToken} onChange={(e) => setDepositToken(e.target.value as "0" | "1")} className="input-field max-w-24">
                <option value="0">ETH</option>
                <option value="1">USDC</option>
              </select>
              <input 
                 type="number" 
                 placeholder="Amount to deposit" 
                 className="input-field flex-1" 
                 value={depositAmount} 
                 onChange={(e) => setDepositAmount(e.target.value)} 
              />
              <button onClick={handleDepositTokens} className="btn-green">Deposit Budget</button>
            </div>

            {/* Withdraw Form */}
            <div className="flex gap-2 pt-2 border-t border-white/5">
              <select value={withdrawToken} onChange={(e) => setWithdrawToken(e.target.value as "0" | "1")} className="input-field max-w-24 border-red-500/20">
                <option value="0">ETH</option>
                <option value="1">USDC</option>
              </select>
              <input 
                 type="number" 
                 placeholder="Amount to withdraw" 
                 className="input-field flex-1 border-red-500/20 focus:border-red-500/50" 
                 value={withdrawAmount} 
                 onChange={(e) => setWithdrawAmount(e.target.value)} 
              />
              <button onClick={handleWithdrawTokens} className="btn-primary bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30">
                Withdraw
              </button>
            </div>
            
            <p className="text-xs text-slate-500 mt-2">
              *The escrow automatically handles FHE wrapping upon deposit. Withdrawals return FHE-wrapped assets to the owner.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function EmployerUnwrapCard({ connectedAddress }: { connectedAddress?: string }) {
  const [currency, setCurrency] = useState<"USDC" | "ETH">("USDC");
  const activeAddress = currency === "USDC" ? WRAPPER_USDC_ADDRESS : WRAPPER_ETH_ADDRESS;

  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  
  const [showBalance, setShowBalance] = useState(false);
  const [decryptedBalance, setDecryptedBalance] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [unwrapAmount, setUnwrapAmount] = useState("");

  const { writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  // Add these hooks to access the necessary parameters for the permit
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: userAddress, chainId } = useAccount();

  // Reset UI states when the user toggles the currency
  useEffect(() => {
    setShowBalance(false);
    setDecryptedBalance(null);
    setUnwrapAmount("");
    setStatus("idle");
  }, [currency]);

  // Read the user's Encrypted Wrapper Token Balance for the selected currency
  const { data: encryptedBalance, refetch: refetchBalance } = useReadContract({
    address: activeAddress,
    abi: WRAPPER_ABI,
    functionName: "getEncryptedBalance",
    args: connectedAddress ? [connectedAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!connectedAddress,
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

      if (!encryptedBalance || BigInt(encryptedBalance as string) === BigInt(0)) {
        setDecryptedBalance(0);
        setShowBalance(true);
        return;
      }

      if (!publicClient || !walletClient || !userAddress || !chainId) {
        throw new Error("Please connect your wallet first.");
      }

      const cofheWeb = await import("@cofhe/sdk/web");
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
      await client.connect(publicClient, walletClient);

      let permit = await client.permits.getOrCreateSelfPermit(chainId, userAddress);
      let result;

      try {
        result = await client
          .decryptForView(BigInt(encryptedBalance as string), FheTypes.Uint64)
          .withPermit(permit)
          .execute();
      } catch (err: any) {
        if (err.message?.toLowerCase().includes("expired")) {
            client.permits.removeActivePermit(chainId, userAddress);
            permit = await client.permits.getOrCreateSelfPermit(chainId, userAddress);
            
            result = await client
              .decryptForView(BigInt(encryptedBalance as string), FheTypes.Uint64)
              .withPermit(permit)
              .execute();
        } else {
            throw err;
        }
      }
        
      // Dynamic decimal formatting based on token type
      const decimals = currency === "USDC" ? 1e6 : 1e18;
      setDecryptedBalance(Number(result) / decimals); 
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
      
      // Utilize viem's parseUnits to robustly translate strings/floats
      const decimals = currency === "USDC" ? 6 : 18;
      const amountToUnwrap = parseUnits(unwrapAmount, decimals);

      const hash = await writeContractAsync({
        address: activeAddress,
        abi: WRAPPER_ABI,
        functionName: "unwrap",
        args: [amountToUnwrap],
        gas: BigInt(8000000)
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
    <div className="glass rounded-2xl p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(90,41,228,0.2)" }}>
            <Wallet size={17} className="text-violet-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base" style={{ fontFamily: "var(--font-display)" }}>Admin Wallet Unwrap</h3>
            <p className="text-xs text-slate-500">Unwrap withdrawn FHE tokens</p>
          </div>
        </div>

        {/* Currency Toggle */}
        <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
          <button 
            onClick={() => setCurrency("USDC")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${currency === "USDC" ? "bg-violet-500/20 text-violet-400" : "text-slate-400 hover:text-slate-300"}`}
          >
            USDC
          </button>
          <button 
            onClick={() => setCurrency("ETH")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${currency === "ETH" ? "bg-violet-500/20 text-violet-400" : "text-slate-400 hover:text-slate-300"}`}
          >
            ETH
          </button>
        </div>
      </div>

      {/* Balance preview */}
      <div className="rounded-xl p-4 mb-4 flex items-center justify-between" style={{ background: "rgba(90,41,228,0.04)", border: "1px solid rgba(90,41,228,0.1)" }}>
        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">FHE Encrypted Balance ({currency})</span>
            <button onClick={handleRevealBalance} disabled={isDecrypting || !encryptedBalance} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50">
              {isDecrypting ? (
                <><Loader2 size={12} className="animate-spin" /> Decrypting...</>
              ) : showBalance ? (
                <><EyeOff size={12} /> Hide</>
              ) : (
                <><Eye size={12} /> Reveal</>
              )}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {showBalance && decryptedBalance !== null ? (
              <motion.div key="revealed" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-violet-400" style={{ fontFamily: "var(--font-display)" }}>
                  {currency === "USDC" ? "$" : "Ξ"}
                  {decryptedBalance}
                </span>
                <span className="text-sm text-slate-500">FHE-{currency}</span>
              </motion.div>
            ) : (
              <motion.div key="hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-3xl font-bold text-violet-400 tracking-widest" style={{ fontFamily: "var(--font-display)", marginTop: "-4px" }}>
                ****
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 mb-5 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
        <Clock size={16} className="text-violet-500 shrink-0" /> 
        <span>Withdrawing from the Escrow sends FHE-encrypted tokens to your wallet. <strong>Unwrap them below</strong> to convert back to public Base Sepolia {currency}.</span>
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

      <div className="mt-auto pt-2">
        <label className="block text-xs font-medium text-slate-400 mb-2">Unwrap to Public Base Sepolia {currency}</label>
        <div className="flex gap-2">
          <input 
            type="number" 
            placeholder={`Amount to Unwrap`} 
            className="input-field flex-1 border-violet-500/20 focus:border-violet-500/50"
            value={unwrapAmount}
            onChange={(e) => setUnwrapAmount(e.target.value)}
            disabled={isLoading}
          />
          <button onClick={handleUnwrap} disabled={isLoading || !unwrapAmount} className="btn-primary bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/30">
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><Unlock size={14} /> Unwrap</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Helpers
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
      style={{ background: "rgba(90,41,228,0.05)", borderColor: "rgba(90,41,228,0.2)" }}
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

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent: "purple" | "green" }) {
  return (
    <div className="glass rounded-xl p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accent === "purple" ? "rgba(90,41,228,0.2)" : "rgba(10,92,62,0.3)" }}>
        <Icon size={20} className={accent === "purple" ? "text-violet-400" : "text-emerald-400"} />
      </div>
      <div>
        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{value}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Existing Subcomponents (AddEmployeeForm, PayrollCard)
// ──────────────────────────────────────────────
function AddEmployeeForm({ employeeCount, contractAddress }: { employeeCount: number, contractAddress: `0x${string}` }) {
  // Existing AddEmployeeForm Logic intact
  const [address, setAddress] = useState("");
  const [salary, setSalary] = useState("");
  const [currency, setCurrency] = useState<"0" | "1">("0");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: userAddress, chainId } = useAccount();

  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!address || !salary) return;

      try {
        setStatus("encrypting");
        setErrorMsg("");

        if (!publicClient || !walletClient || !userAddress || !chainId) {
          throw new Error("Please connect your wallet first.");
        }

        const cofheWeb = await import("@cofhe/sdk/web");
        const cofheCore = await import("@cofhe/sdk");
        
        const { createCofheConfig, createCofheClient } = cofheWeb;
        const { Encryptable } = cofheCore;

        const config = createCofheConfig({ environment: "web", supportedChains: [baseSepolia] });
        const client = await createCofheClient(config);
        
        await client.connect(publicClient, walletClient);
        
        const decimals = currency === "0" ? 18 : 6; 
        const salaryInBaseUnits = parseUnits(salary, decimals);

        const encryptedInputs = await client.encryptInputs([
          Encryptable.uint64(salaryInBaseUnits) 
        ]).execute();

        const encryptedResult = encryptedInputs[0];

        const encryptedSalaryInput: EncryptedInput = {
          ctHash: encryptedResult.ctHash,
          securityZone: encryptedResult.securityZone,
          utype: encryptedResult.utype,
          signature: encryptedResult.signature as `0x${string}`,
        };

        setStatus("pending");

        const hash = await writeContractAsync({
          address: contractAddress, 
          abi: PAYROLL_ABI,        
          functionName: "addEmployee",
          args: [address as `0x${string}`, encryptedSalaryInput, parseInt(currency)],
        });

        setTxHash(hash);
        setStatus("success");
        setAddress("");
        setSalary("");

        setTimeout(() => setStatus("idle"), 4000);
      } catch (err: unknown) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Transaction failed. Please try again.");
        setTimeout(() => setStatus("idle"), 5000);
      }
    },
    [address, salary, currency, writeContractAsync, contractAddress, publicClient, walletClient, userAddress, chainId]
  );

  const isLoading = status === "encrypting" || status === "pending" || isConfirming;

  return (
    <div className="glass rounded-2xl p-6 glow-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(90,41,228,0.2)" }}>
          <UserPlus size={17} className="text-violet-400" />
        </div>
        <div>
          <h3 className="font-bold text-white text-base" style={{ fontFamily: "var(--font-display)" }}>Add Employee</h3>
          <p className="text-xs text-slate-500">Salary is FHE-encrypted</p>
        </div>
        <div className="ml-auto">
          <span className="badge badge-purple"><Lock size={9} /> FHE</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Employee Wallet Address</label>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Payment Token</label>
            <select 
              value={currency} 
              onChange={(e) => setCurrency(e.target.value as "0" | "1")}
              className="input-field w-full"
              disabled={isLoading}
            >
              <option value="0">Base Sepolia ETH</option>
              <option value="1">USDC</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Monthly Salary</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{currency === "0" ? "Ξ" : "$"}</span>
              <input
                type="number"
                placeholder="5000"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                className="input-field pl-8"
                disabled={isLoading}
                required
                step="any"
              />
            </div>
          </div>
        </div>
        
        <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1">
          <Lock size={9} className="text-violet-500" />
          Amount encrypted client-side via CoFHE before on-chain submission.
        </p>

        <AnimatePresence>
          {status === "encrypting" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2.5">
              <Loader2 size={14} className="animate-spin" /> Encrypting salary...
            </motion.div>
          )}
          {status === "pending" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2.5">
              <Loader2 size={14} className="animate-spin" /> Awaiting wallet confirmation...
            </motion.div>
          )}
          {status === "success" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5">
              <CheckCircle2 size={14} /> Employee added successfully!
            </motion.div>
          )}
          {status === "error" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> <span className="break-all">{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" className="btn-primary w-full" disabled={isLoading || !address || !salary}>
          {isLoading ? (
            <><Loader2 size={16} className="animate-spin" />{status === "encrypting" ? "Encrypting..." : status === "pending" ? "Sending..." : "Confirming..."}</>
          ) : (
            <><UserPlus size={16} /> Add Employee ({employeeCount} registered)</>
          )}
        </button>
      </form>
    </div>
  );
}

function PayrollCard({ contractAddress }: { contractAddress: `0x${string}` }) {
  const [showTotal, setShowTotal] = useState(false);
  const [decryptedETH, setDecryptedETH] = useState<number | null>(null);
  const [decryptedUSDC, setDecryptedUSDC] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [processStatus, setProcessStatus] = useState<TxStatus>("idle");
  const [processTxHash, setProcessTxHash] = useState<`0x${string}` | undefined>(undefined);
  
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: userAddress, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { isLoading: isProcessConfirming } = useWaitForTransactionReceipt({ hash: processTxHash });

  const { data: encryptedTotals } = useReadContract({
    address: contractAddress,  
    abi: PAYROLL_ABI,          
    functionName: "getEncryptedTotals",
  });

  const handleRevealTotal = async () => {
    if (showTotal) {
      setShowTotal(false);
      setDecryptedETH(null);
      setDecryptedUSDC(null);
      return;
    }

    try {
      setIsDecrypting(true);

      if (!publicClient || !walletClient || !userAddress || !chainId) {
        throw new Error("Please connect your wallet first.");
      }

      const cofheWeb = await import("@cofhe/sdk/web");
      const cofheCore = await import("@cofhe/sdk");
      
      const { createCofheConfig, createCofheClient } = cofheWeb;
      const { FheTypes } = cofheCore;

      if (encryptedTotals && Array.isArray(encryptedTotals)) {
        const handles = encryptedTotals.map(h => BigInt(h));
        const [encETH, encUSDC] = handles;
        
        const config = createCofheConfig({ 
            environment: "web", 
            supportedChains: [baseSepolia] 
        });
        const client = await createCofheClient(config);
        await client.connect(publicClient, walletClient);
        
        let permit = await client.permits.getOrCreateSelfPermit(chainId, userAddress);
        let resETH, resUSDC;

        try {
            [resETH, resUSDC] = await Promise.all([
                client.decryptForView(encETH, FheTypes.Uint64).withPermit(permit).execute(),
                client.decryptForView(encUSDC, FheTypes.Uint64).withPermit(permit).execute()
            ]);
        } catch (err: any) {
            if (err.message?.toLowerCase().includes("expired")) {
                client.permits.removeActivePermit(chainId, userAddress);
                permit = await client.permits.getOrCreateSelfPermit(chainId, userAddress);
                
                [resETH, resUSDC] = await Promise.all([
                    client.decryptForView(encETH, FheTypes.Uint64).withPermit(permit).execute(),
                    client.decryptForView(encUSDC, FheTypes.Uint64).withPermit(permit).execute()
                ]);
            } else {
                throw err;
            }
        }
        
        setDecryptedETH(Number(formatUnits(resETH, 18)));
        setDecryptedUSDC(Number(formatUnits(resUSDC, 6)));
        setShowTotal(true);
      }
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
        address: contractAddress, 
        abi: PAYROLL_ABI,        
        functionName: "processPayroll",
        args: [],
        gas: BigInt(8000000)
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

  const isProcessing = processStatus === "pending" || isProcessConfirming;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(10,92,62,0.3)" }}>
          <TrendingUp size={17} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="font-bold text-white text-base" style={{ fontFamily: "var(--font-display)" }}>Payroll Controls</h3>
          <p className="text-xs text-slate-500">Manage payroll settlement</p>
        </div>
      </div>

      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(10,92,62,0.12)", border: "1px solid rgba(0,255,157,0.12)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Dual Budget (Encrypted)</span>
          <button
            onClick={handleRevealTotal}
            disabled={isDecrypting || !encryptedTotals}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
          >
            {isDecrypting ? <><Loader2 size={12} className="animate-spin" /> Decrypting...</> : showTotal ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> Reveal</>}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {showTotal && decryptedETH !== null && decryptedUSDC !== null ? (
            <motion.div key="revealed" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex flex-col gap-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-blue-400" style={{ fontFamily: "var(--font-display)" }}>
                  {decryptedETH}
                </span>
                <span className="text-sm text-slate-500">ETH /cycle</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>
                  ${decryptedUSDC}
                </span>
                <span className="text-sm text-slate-500">USDC /cycle</span>
              </div>
            </motion.div>
          ) : (
            <motion.div key="hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
              <div className="flex gap-1">
                {[...Array(8)].map((_, i) => <div key={i} className="w-5 h-5 rounded" style={{ background: "rgba(0,255,157,0.08)" }} />)}
              </div>
              <Lock size={12} className="text-slate-600" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {processStatus === "success" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 mb-3">
            <CheckCircle2 size={14} /> Payroll processed successfully!
          </motion.div>
        )}
        {processStatus === "error" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-3">
            <AlertCircle size={14} /> Transaction failed.
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={handleProcessPayroll} disabled={isProcessing} className="btn-green w-full">
        {isProcessing ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <><Play size={16} /> Process Payroll</>}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Dashboard Export
// ──────────────────────────────────────────────
export default function EmployerDashboard({ contractAddress }: EmployerDashboardProps) {
  const { data: employees } = useReadContract({
    address: contractAddress, 
    abi: PAYROLL_ABI,        
    functionName: "getEmployees",
  });

  const { address: userAddress } = useAccount();

  const employeeList = (employees as `0x${string}`[] | undefined) ?? [];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <AddressBanner address={contractAddress} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={UserPlus} label="Employees" value={String(employeeList.length)} accent="purple" />
        <StatCard icon={DollarSign} label="Next Cycle" value="Encrypted" accent="green" />
        <StatCard icon={Lock} label="FHE Layer" value="Active" accent="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AddEmployeeForm employeeCount={employeeList.length} contractAddress={contractAddress} />
        <PayrollCard contractAddress={contractAddress} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <EscrowManagement contractAddress={contractAddress} />
        <EmployerUnwrapCard connectedAddress={userAddress} />
      </div>
      
    </motion.div>
  );
}