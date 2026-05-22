"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useReadContract,
  useWriteContract,
  useAccount,
  useWaitForTransactionReceipt,
  usePublicClient,
  useWalletClient,
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
  Unlock,
  Zap,
  FileKey,
  Copy,
  Check,
  Bot
} from "lucide-react";
import { PAYROLL_ABI, WRAPPER_ABI, WRAPPER_USDC_ADDRESS, WRAPPER_ETH_ADDRESS } from "@/lib/contract";
import { baseSepolia } from "@cofhe/sdk/chains";
import { parseUnits } from "viem";

function EmployeeRow({ address, index, isYou }: { address: string; index: number; isYou: boolean }) {
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} className="flex items-center justify-between py-3 border-b border-slate-800/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `hsl(${(parseInt(address.slice(2, 8), 16) % 360)}, 60%, 25%)`, border: isYou ? "1.5px solid rgba(0,255,157,0.5)" : "1.5px solid rgba(90,41,228,0.25)", color: isYou ? "#00FF9D" : "#A080FF" }}>
          {address.slice(2, 4).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-mono text-slate-300 flex items-center gap-2">{short} {isYou && <span className="badge badge-green text-[10px]"><BadgeCheck size={9} /> You</span>}</div>
          <div className="text-xs text-slate-600">Registered employee</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500"><CheckCircle2 size={12} className="text-emerald-500" /> Active</div>
    </motion.div>
  );
}

function AIAgentCard({ contractAddress }: { contractAddress: `0x${string}` }) {
  const [risk, setRisk] = useState('Low Risk (Stablecoins Only)');
  const [strategy, setStrategy] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Wagmi Hooks for Execution
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: userAddress, chainId } = useAccount();

  const deployAgent = async () => {
    setLoading(true);
    try {
        const res = await fetch('/api/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ riskPreference: risk }) 
        });
        const data = await res.json();
        if (data.success) {
            setStrategy(data.strategy);
        }
    } catch (e) {
        console.warn("API route not found, using mock fallback...", e);
        setTimeout(() => {
          setStrategy({ "aave": 40, "compound": 60, "uniswap": 0 });
        }, 2000);
    } finally {
        setLoading(false);
    }
  };

  const handleExecuteStrategy = async () => {
    if (!strategy) return;
    setIsExecuting(true);
    try {
      if (!publicClient || !walletClient || !userAddress || !chainId) {
        throw new Error("Wallet not connected.");
      }

      // 1. Initialize FHE Client
      const cofheWeb = await import("@cofhe/sdk/web");
      const cofheCore = await import("@cofhe/sdk");
      const { createCofheConfig, createCofheClient } = cofheWeb;
      const { Encryptable } = cofheCore;

      const config = createCofheConfig({ environment: "web", supportedChains: [baseSepolia] });
      const client = await createCofheClient(config);
      await client.connect(publicClient, walletClient);

      // 2. Encrypt strategy allocations
      // Assumes your contract accepts allocations in a fixed order (e.g., Aave, Compound, Uniswap. Curve)
      const aaveAlloc = strategy.aave || 0;
      const compAlloc = strategy.compound || 0;
      const uniAlloc = strategy.uniswap || 0;
      const curveAlloc = strategy.curve || 0;

      const encryptedInputs = await client.encryptInputs([
        Encryptable.uint64(BigInt(aaveAlloc)),
        Encryptable.uint64(BigInt(compAlloc)),
        Encryptable.uint64(BigInt(uniAlloc)),
        Encryptable.uint64(BigInt(curveAlloc)),
      ]).execute();

      // Map to the EncryptedInput struct format expected by your contract
      const formattedInputs = encryptedInputs.map(res => ({
        ctHash: res.ctHash,
        securityZone: res.securityZone,
        utype: res.utype,
        signature: res.signature as `0x${string}`,
      }));

      // 3. Execute Contract Call
      // Update "updateYieldRouting" to whatever your routing function is named in PAYROLL_ABI
      const txHash = await writeContractAsync({
        address: contractAddress,
        abi: PAYROLL_ABI,
        functionName: "updateYieldRouting",
        args: [formattedInputs],
        gas: BigInt(8000000)
      });
      
      alert(`FHE Permit Signed! Successfully routed encrypted yield across: ${Object.keys(strategy).join(', ')}. Tx: ${txHash}`);
      setStrategy(null); 
    } catch (error: any) {
      console.error("Agent execution failed:", error);
      alert(error.message || "Execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6 border border-blue-500/20 bg-blue-500/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
      
      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/20">
            <Bot size={17} className="text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base" style={{ fontFamily: "var(--font-display)" }}>AI DeFi Agent</h3>
            <p className="text-xs text-slate-400">Powered by Groq</p>
          </div>
        </div>
        <span className="badge bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">Experimental</span>
      </div>

      <p className="text-xs text-slate-400 mb-4 relative z-10">
        Deploy an ultra-fast agent to dynamically route your encrypted streaming yield to the best pools without manual decryption.
      </p>

      <div className="space-y-4 relative z-10">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Target Risk Profile</label>
          <select 
            value={risk} 
            onChange={(e) => setRisk(e.target.value)}
            className="input-field w-full text-sm appearance-none bg-slate-900/50"
          >
            <option>Low Risk (Stablecoins Only, Aave/Compound)</option>
            <option>Medium Risk (Mixed Lending & Curve)</option>
            <option>High Risk (LPs & Yield Farming)</option>
          </select>
        </div>

        <button 
          onClick={deployAgent} 
          disabled={loading || isExecuting}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Agent Analyzing Markets...</>
          ) : (
            <><Bot size={16} /> Deploy Groq Agent</>
          )}
        </button>

        <AnimatePresence>
          {strategy && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="pt-4 border-t border-slate-700/50">
              <p className="text-xs font-bold text-white mb-3">Optimal Encrypted Routing:</p>
              <div className="space-y-2 mb-4">
                {Object.entries(strategy).map(([pool, allocation]) => (
                  <div key={pool} className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-white/5">
                    <span className="capitalize text-xs text-slate-300 font-medium">{pool}</span>
                    <div className="flex items-center gap-3 w-1/2">
                      <div className="w-full bg-slate-800 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${allocation}%` }}></div>
                      </div>
                      <span className="font-mono text-[10px] text-blue-400 w-8 text-right">{String(allocation)}%</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                onClick={handleExecuteStrategy}
                disabled={isExecuting}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs py-2 rounded-lg transition-colors border border-slate-600 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isExecuting ? (
                  <><Loader2 size={14} className="animate-spin" /> Routing Yield...</>
                ) : (
                  <><FileKey size={14} className="text-emerald-400" /> Sign FHE Permit & Execute</>
                )}
              </button>
              
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 1. Withdraw/Unwrap Card
// ──────────────────────────────────────────────
function WithdrawCard({ connectedAddress, isRegistered }: { connectedAddress?: string; isRegistered: boolean }) {
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
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: userAddress, chainId } = useAccount();

  useEffect(() => { setShowBalance(false); setDecryptedBalance(null); setUnwrapAmount(""); setStatus("idle"); }, [currency]);

  const { data: encryptedBalance, refetch: refetchBalance } = useReadContract({
    address: activeAddress, abi: WRAPPER_ABI, functionName: "getEncryptedBalance", args: connectedAddress ? [connectedAddress as `0x${string}`] : undefined,
    query: { enabled: !!connectedAddress && isRegistered },
  });

  const handleRevealBalance = async () => {
    if (showBalance) { setShowBalance(false); setDecryptedBalance(null); return; }
    try {
      setIsDecrypting(true);
      if (!encryptedBalance || BigInt(encryptedBalance as string) === BigInt(0)) { setDecryptedBalance(0); setShowBalance(true); return; }
      if (!publicClient || !walletClient || !userAddress || !chainId) throw new Error("Wallet not connected.");

      const cofheWeb = await import("@cofhe/sdk/web");
      const cofheCore = await import("@cofhe/sdk");
      const { createCofheConfig, createCofheClient } = cofheWeb;
      const { FheTypes } = cofheCore;

      const config = createCofheConfig({ environment: "web", supportedChains: [baseSepolia] });
      const client = await createCofheClient(config);
      await client.connect(publicClient, walletClient);

      let permit = await client.permits.getOrCreateSelfPermit(chainId, userAddress);
      let result;

      try {
        result = await client.decryptForView(BigInt(encryptedBalance as string), FheTypes.Uint64).withPermit(permit).execute();
      } catch (err: any) {
        if (err.message?.toLowerCase().includes("expired")) {
            client.permits.removeActivePermit(chainId, userAddress);
            permit = await client.permits.getOrCreateSelfPermit(chainId, userAddress);
            result = await client.decryptForView(BigInt(encryptedBalance as string), FheTypes.Uint64).withPermit(permit).execute();
        } else { throw err; }
      }
        
      const decimals = currency === "USDC" ? 1e6 : 1e18;
      setDecryptedBalance(Number(result) / decimals); 
      setShowBalance(true);
    } catch (err) { console.error(err); } finally { setIsDecrypting(false); }
  };

  const handleUnwrap = async () => {
    if (!unwrapAmount) return;
    try {
      setStatus("pending");
      
      const decimals = currency === "USDC" ? 6 : 18;
      const amountToUnwrap = parseUnits(unwrapAmount, decimals);

      const hash = await writeContractAsync({
        address: activeAddress, abi: WRAPPER_ABI, functionName: "unwrap", args: [amountToUnwrap], gas: BigInt(8000000)
      });
      
      setTxHash(hash); setStatus("success"); setUnwrapAmount(""); setShowBalance(false); setDecryptedBalance(null);
      setTimeout(() => { setStatus("idle"); refetchBalance(); }, 5000);
    } catch (err) { setStatus("error"); console.error(err); setTimeout(() => setStatus("idle"), 4000); }
  };

  const isLoading = status === "pending" || isConfirming;

  return (
    <div className="glass-green rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,255,157,0.1)" }}>
            <Wallet size={17} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base" style={{ fontFamily: "var(--font-display)" }}>My Salary Wallet</h3>
            <p className="text-xs text-slate-500">Manage your private funds</p>
          </div>
        </div>

        <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
          <button onClick={() => setCurrency("USDC")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${currency === "USDC" ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:text-slate-300"}`}>USDC</button>
          <button onClick={() => setCurrency("ETH")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${currency === "ETH" ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:text-slate-300"}`}>ETH</button>
        </div>
      </div>

      <div className="rounded-xl p-4 mb-4 flex items-center justify-between" style={{ background: "rgba(0,255,157,0.04)", border: "1px solid rgba(0,255,157,0.1)" }}>
        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">FHE Encrypted Balance ({currency})</span>
            {isRegistered && (
              <button onClick={handleRevealBalance} disabled={isDecrypting || !encryptedBalance} className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50">
                {isDecrypting ? <><Loader2 size={12} className="animate-spin" /> Decrypting...</> : showBalance ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> Reveal</>}
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {showBalance && decryptedBalance !== null ? (
              <motion.div key="revealed" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>{currency === "USDC" ? "$" : "Ξ"}{decryptedBalance}</span>
                <span className="text-sm text-slate-500">FHE-{currency}</span>
              </motion.div>
            ) : (
              <motion.div key="hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-3xl font-bold text-emerald-400 tracking-widest" style={{ fontFamily: "var(--font-display)", marginTop: "-4px" }}>****</motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 mb-5 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
        <Clock size={16} className="text-emerald-500 shrink-0" /> 
        <span>Claimed salary is in your FHE wallet. <strong>Unwrap them below</strong> to convert them back into public Base Sepolia {currency}.</span>
      </div>

      <AnimatePresence>
        {status === "success" && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 mb-3"><CheckCircle2 size={14} /> Unwrap successful!</motion.div>}
        {status === "error" && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-3"><AlertCircle size={14} /> Transaction failed.</motion.div>}
      </AnimatePresence>

      <div className="space-y-3">
        <div className="pt-2">
          <label className="block text-xs font-medium text-slate-400 mb-2">Unwrap to Public Base Sepolia {currency}</label>
          <div className="flex gap-2">
            <input type="number" placeholder={`Amount to Unwrap`} className="input-field flex-1" value={unwrapAmount} onChange={(e) => setUnwrapAmount(e.target.value)} disabled={isLoading} />
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
// 2. Active Organization Dashboard (With Streaming & Permits)
// ──────────────────────────────────────────────
function ActiveOrganizationDashboard({ contractAddress, onBack }: { contractAddress: `0x${string}`, onBack: () => void }) {
  const { address: connectedAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [permitAddress, setPermitAddress] = useState("");
  const [permitDays, setPermitDays] = useState("1");
  const [isPermitting, setIsPermitting] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  
  // New States for Shareable Verification Link
  const [shareableLink, setShareableLink] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: employees, isLoading } = useReadContract({ address: contractAddress, abi: PAYROLL_ABI, functionName: "getEmployees" });
  const employeeList = (employees as `0x${string}`[] | undefined) ?? [];
  const isRegistered = connectedAddress ? employeeList.map((a) => a.toLowerCase()).includes(connectedAddress.toLowerCase()) : false;

  const handleClaimStream = async () => {
    try {
      setIsClaiming(true);
      await writeContractAsync({
        address: contractAddress, abi: PAYROLL_ABI, functionName: "claimStream", gas: BigInt(8000000)
      });
      alert("Successfully claimed accrued stream into your encrypted wallet!");
    } catch (err) { console.error(err); } finally { setIsClaiming(false); }
  };

  const handleGrantPermit = async () => {
    if (!permitAddress || !permitDays) return;
    setShareableLink(""); // Reset on new attempt
    
    try {
      setIsPermitting(true);
      const seconds = parseInt(permitDays) * 86400; // Convert days to seconds
      await writeContractAsync({
        address: contractAddress, abi: PAYROLL_ABI, functionName: "grantIncomeViewPermit", args: [permitAddress as `0x${string}`, BigInt(seconds)]
      });
      
      // Generate the Verification Link 
      const url = new URL(`${window.location.href}verifier`);
      url.searchParams.set("role", "verifier");
      url.searchParams.set("org", contractAddress);
      if (connectedAddress) {
        url.searchParams.set("emp", connectedAddress);
      }
      setShareableLink(url.toString());

      setPermitAddress("");
    } catch (err) { console.error(err); } finally { setIsPermitting(false); }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-6"><ArrowLeft size={16} /> Back to my organizations</button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="glass rounded-xl p-5 border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-3 mb-2">
            <Zap size={20} className="text-emerald-400" />
            <h3 className="font-bold text-white">Live Stream Claim</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">Your salary accrues every second and generates DeFi yield in Escrow. Claim your accrued balance into your FHE wallet at any time.</p>
          <button onClick={handleClaimStream} disabled={isClaiming || !isRegistered} className="btn-green w-full py-2.5">
            {isClaiming ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Claim Accrued Salary"}
          </button>
        </div>

        <div className="glass rounded-xl p-5 border border-violet-500/20 bg-violet-500/5">
          <div className="flex items-center gap-3 mb-2">
            <FileKey size={20} className="text-violet-400" />
            <h3 className="font-bold text-white">Income Verification</h3>
          </div>
          <p className="text-xs text-slate-400 mb-3">Grant a landlord or bank temporary access to view your encrypted stream rate without revealing your total wallet history.</p>
          
          <div className="flex gap-2">
             <input type="text" placeholder="0x..." className="input-field w-10 h-9 text-xs" value={permitAddress} onChange={(e)=>setPermitAddress(e.target.value)} />
             <input type="number" placeholder="Days" className="input-field w-10 h-9 text-xs" value={permitDays} onChange={(e)=>setPermitDays(e.target.value)} />
             <button onClick={handleGrantPermit} disabled={isPermitting || !permitAddress} className="btn-primary h-9 px-3 text-xs">
               {isPermitting ? <Loader2 size={12} className="animate-spin" /> : "Grant"}
             </button>
          </div>

          {/* Verification Link UI */}
          <AnimatePresence>
            {shareableLink && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 pt-3 border-t border-violet-500/20 overflow-hidden">
                 <p className="text-xs text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle2 size={12}/> Permit Active. Share this link:</p>
                 <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-lg border border-slate-700/50">
                    <input type="text" readOnly value={shareableLink} className="bg-transparent text-[10px] text-slate-400 flex-1 outline-none px-2 truncate cursor-text" />
                    <button 
                      onClick={handleCopyLink} 
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors text-slate-300 hover:text-white"
                      title="Copy Link"
                    >
                      {copied ? <Check size={14} className="text-emerald-400"/> : <Copy size={14} />}
                    </button>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="glass rounded-2xl p-6">
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
              <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="shimmer h-14 rounded-lg" />)}</div>
            ) : employeeList.length === 0 ? (
              <div className="text-center py-12 text-slate-600">
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No employees registered yet.</p>
              </div>
            ) : (
              <div>{employeeList.map((addr, i) => <EmployeeRow key={addr} address={addr} index={i} isYou={connectedAddress?.toLowerCase() === addr.toLowerCase()} />)}</div>
            )}
          </div>
          
          <AIAgentCard contractAddress={contractAddress} />
        </div>

        <div className="lg:col-span-2">
          <WithdrawCard connectedAddress={connectedAddress} isRegistered={isRegistered} />
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────
// 3. Organization Selector (Main Export)
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
      if (saved) setJoinedOrgs(JSON.parse(saved));
    }
  }, [connectedAddress]);

  const saveOrg = (org: `0x${string}`) => {
    if (!connectedAddress) return;
    const newOrgs = [...new Set([...joinedOrgs, org])];
    setJoinedOrgs(newOrgs);
    localStorage.setItem(`confidro_orgs_${connectedAddress}`, JSON.stringify(newOrgs));
  };

  const handleConnectOrg = async (e: React.FormEvent) => {
    e.preventDefault(); setErrorMsg("");
    if (!inputAddress.startsWith("0x") || inputAddress.length !== 42) { setErrorMsg("Please enter a valid smart contract address (0x...)"); return; }

    try {
      setIsSearching(true);
      const employeeList = await publicClient?.readContract({ address: inputAddress as `0x${string}`, abi: PAYROLL_ABI, functionName: "getEmployees" }) as string[];
      const isEmployee = employeeList.map(a => a.toLowerCase()).includes(connectedAddress?.toLowerCase() || "");

      if (isEmployee) {
        saveOrg(inputAddress as `0x${string}`); setActiveOrg(inputAddress as `0x${string}`); setInputAddress(""); 
      } else { setErrorMsg("Access Denied: You are not registered as an employee in this organization."); }
    } catch (err) { console.error(err); setErrorMsg("Error connecting. Is this a valid Confidro Protocol contract?"); } finally { setIsSearching(false); }
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
              <button key={org} onClick={() => setActiveOrg(org)} className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-700/50 hover:border-emerald-500/50 bg-slate-800/30 hover:bg-slate-800/50 transition-all group">
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="font-mono text-sm text-slate-300">{org.slice(0, 8)}...{org.slice(-6)}</span></div>
                <ChevronRight size={18} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 mb-8 border border-dashed border-slate-700 rounded-xl bg-slate-800/10"><p className="text-sm text-slate-500">You are not in any organization yet.</p></div>
        )}

        <hr className="border-slate-800 mb-6" />

        <form onSubmit={handleConnectOrg}>
          <label className="block text-sm font-medium text-slate-300 mb-2">Join New Organization</label>
          <p className="text-xs text-slate-500 mb-4">Paste the payroll contract address provided by your employer.</p>
          
          <div className="flex gap-3">
            <input type="text" placeholder="0x..." value={inputAddress} onChange={(e) => setInputAddress(e.target.value)} className="input-field flex-1" disabled={isSearching} />
            <button type="submit" disabled={!inputAddress || isSearching} className="btn-primary whitespace-nowrap px-6">{isSearching ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Connect</button>
          </div>

          <AnimatePresence>
            {errorMsg && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mt-4"><AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{errorMsg}</span></motion.div>}
          </AnimatePresence>
        </form>
      </div>
    </motion.div>
  );
}