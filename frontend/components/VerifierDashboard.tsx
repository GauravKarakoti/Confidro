"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation"; // <-- Added Next.js hook
import { motion, AnimatePresence } from "framer-motion";
import { useReadContract, useAccount, usePublicClient, useWalletClient } from "wagmi";
import { FileKey, Loader2, ShieldCheck, AlertCircle, Building, Search } from "lucide-react";
import { PAYROLL_ABI } from "@/lib/contract";
import { baseSepolia } from "@cofhe/sdk/chains";
import { formatUnits } from "viem";

export default function VerifierDashboard() {
  const [contractAddress, setContractAddress] = useState("");
  const [activeContract, setActiveContract] = useState<`0x${string}` | null>(null);
  const [employeeAddress, setEmployeeAddress] = useState("");
  
  const [decryptedRate, setDecryptedRate] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const { address: verifierAddress, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  // --- Auto-fill from URL Parameters ---
  const searchParams = useSearchParams(); // <-- Initialize hook

  useEffect(() => {
    // Safely extract parameters using the Next.js hook
    const orgParam = searchParams.get("org");
    const empParam = searchParams.get("emp");

    if (orgParam && orgParam.length === 42) {
      setContractAddress(orgParam);
      setActiveContract(orgParam as `0x${string}`);
    }
    if (empParam && empParam.length === 42) {
      setEmployeeAddress(empParam);
    }
  }, [searchParams]); // <-- Depend on searchParams

  // Fetch the encrypted income using the specific function in ConfidroPayroll.sol
  const { data: encryptedIncome, error: contractError } = useReadContract({
    address: activeContract as `0x${string}`,
    abi: PAYROLL_ABI,
    functionName: "verifyEmployeeIncome",
    args: employeeAddress ? [employeeAddress as `0x${string}`] : undefined,
    query: { enabled: !!activeContract && employeeAddress.length === 42 },
  });

  const handleConnectOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractAddress.startsWith("0x") || contractAddress.length !== 42) {
      setErrorMsg("Invalid contract address.");
      return;
    }
    setActiveContract(contractAddress as `0x${string}`);
    setErrorMsg("");
  };

  const handleVerify = async () => {
    setErrorMsg("");
    setDecryptedRate(null);

    if (contractError) {
      setErrorMsg("Verification failed: Permit not active or expired on-chain.");
      return;
    }

    if (!encryptedIncome) {
      setErrorMsg("No encrypted data found. Ensure the employee address is correct.");
      return;
    }

    try {
      setStatus("verifying");
      
      const cofheWeb = await import("@cofhe/sdk/web");
      const cofheCore = await import("@cofhe/sdk"); 
      const { createCofheConfig, createCofheClient } = cofheWeb;
      const { FheTypes } = cofheCore;

      const config = createCofheConfig({ environment: "web", supportedChains: [baseSepolia] });
      const client = await createCofheClient(config);
      await client.connect(publicClient!, walletClient!);

      let permit = await client.permits.getOrCreateSelfPermit(chainId!, verifierAddress!);

      let result;
      try {
        result = await client.decryptForView(BigInt(encryptedIncome as string), FheTypes.Uint64)
                             .withPermit(permit)
                             .execute();
      } catch (err: any) {
        if (err.message?.toLowerCase().includes("expired")) {
            client.permits.removeActivePermit(chainId!, verifierAddress!);
            permit = await client.permits.getOrCreateSelfPermit(chainId!, verifierAddress!);
            result = await client.decryptForView(BigInt(encryptedIncome as string), FheTypes.Uint64).withPermit(permit).execute();
        } else {
            throw err;
        }
      }

      const rawRate = Number(formatUnits(result, 6)); 
      const monthlyEstimate = rawRate * 2592000; 

      setDecryptedRate(monthlyEstimate.toFixed(2));
      setStatus("success");

    } catch (err) {
      console.error("Decryption failed", err);
      setStatus("error");
      setErrorMsg("Failed to decrypt. The FHE network rejected the request.");
    } finally {
      if (status !== "error") setStatus("idle");
    }
  };

  if (!activeContract) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
        <div className="glass rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/20">
              <Building size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-display">Verifier Portal</h2>
              <p className="text-sm text-slate-400">Connect to an organization to verify income</p>
            </div>
          </div>
          
          <form onSubmit={handleConnectOrg}>
            <label className="block text-sm font-medium text-slate-300 mb-2">Organization Contract Address</label>
            <div className="flex gap-3">
              <input 
                type="text" 
                placeholder="0x..." 
                value={contractAddress} 
                onChange={(e) => setContractAddress(e.target.value)} 
                className="input-field flex-1" 
              />
              <button type="submit" disabled={!contractAddress} className="btn-primary px-6">
                Connect
              </button>
            </div>
            {errorMsg && <p className="text-red-400 text-sm mt-3">{errorMsg}</p>}
          </form>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
      <button onClick={() => setActiveContract(null)} className="text-sm text-slate-400 hover:text-white mb-6 flex items-center gap-2">
        ← Change Organization
      </button>

      <div className="glass rounded-2xl p-8 border-violet-500/30 border-2">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-violet-500/20">
              <FileKey className="text-violet-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Income Verification</h2>
              <p className="text-sm text-slate-400 font-mono text-xs">{activeContract.slice(0,10)}...{activeContract.slice(-8)}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-xl p-6 border border-white/10 mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">Employee Wallet Address</label>
          <p className="text-xs text-slate-500 mb-4">Enter the address of the employee who granted you a view permit.</p>
          
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="text" 
                placeholder="0x..." 
                value={employeeAddress} 
                onChange={(e) => setEmployeeAddress(e.target.value)} 
                className="input-field w-full pl-10" 
              />
            </div>
            <button 
              onClick={handleVerify} 
              disabled={status === "verifying" || employeeAddress.length !== 42} 
              className="btn-primary flex items-center gap-2 px-6"
            >
              {status === "verifying" ? <><Loader2 size={16} className="animate-spin" /> Requesting...</> : "Verify"}
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
        </div>

        <AnimatePresence mode="wait">
          {decryptedRate && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-8 text-center"
            >
              <ShieldCheck size={32} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-xs text-emerald-500/80 uppercase tracking-widest mb-1">Cryptographically Verified Salary</p>
              <h1 className="text-5xl font-bold text-emerald-400 font-display mb-2">
                ${decryptedRate} <span className="text-lg text-emerald-500/60">/ mo</span>
              </h1>
              <p className="text-sm text-slate-400">Stream rate successfully decrypted via Fhenix Oracle</p>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
}