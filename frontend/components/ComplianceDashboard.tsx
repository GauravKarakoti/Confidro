"use client";

import { useState } from "react";
import { useReadContract, useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Lock, Eye, Loader2, ShieldAlert } from "lucide-react";
import { PAYROLL_ABI } from "@/lib/contract";
import { baseSepolia } from "@cofhe/sdk/chains";
import { formatUnits } from "viem";

export default function ComplianceDashboard({ contractAddress }: { contractAddress: `0x${string}` }) {
  const [decryptedETH, setDecryptedETH] = useState<string | null>(null);
  const [decryptedUSDC, setDecryptedUSDC] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  
  const { address: userAddress, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const { data: encryptedTotal } = useReadContract({
    address: contractAddress,
    abi: PAYROLL_ABI,
    functionName: "getEncryptedTotals",
  });

  const handleRevealComplianceTotal = async () => {
    if (!encryptedTotal || !Array.isArray(encryptedTotal)) return;

    try {
      setIsDecrypting(true);
      const cofheWeb = await import("@cofhe/sdk/web");
      const cofheCore = await import("@cofhe/sdk"); 
      const { createCofheConfig, createCofheClient } = cofheWeb;
      const { FheTypes } = cofheCore;

      const config = createCofheConfig({ environment: "web", supportedChains: [baseSepolia] });
      const client = await createCofheClient(config);
      await client.connect(publicClient!, walletClient!);

      let permit = await client.permits.getOrCreateSelfPermit(chainId!, userAddress!);

      // Extract both handles
      const handles = encryptedTotal.map(h => BigInt(h));
      const [encETH, encUSDC] = handles;

      let resETH, resUSDC;

      try {
        // Decrypt both totals concurrently
        [resETH, resUSDC] = await Promise.all([
            client.decryptForView(encETH, FheTypes.Uint64).withPermit(permit).execute(),
            client.decryptForView(encUSDC, FheTypes.Uint64).withPermit(permit).execute()
        ]);
      } catch (err: any) {
        // Retry logic for expired permits
        if (err.message?.toLowerCase().includes("expired")) {
            client.permits.removeActivePermit(chainId!, userAddress!);
            permit = await client.permits.getOrCreateSelfPermit(chainId!, userAddress!);
            
            [resETH, resUSDC] = await Promise.all([
                client.decryptForView(encETH, FheTypes.Uint64).withPermit(permit).execute(),
                client.decryptForView(encUSDC, FheTypes.Uint64).withPermit(permit).execute()
            ]);
        } else {
            throw err;
        }
      }

      // Format with correct decimals based on the token
      setDecryptedETH(formatUnits(resETH, 18));
      setDecryptedUSDC(formatUnits(resUSDC, 6));
    } catch (err) {
      console.error("Compliance decryption failed", err);
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto glass rounded-2xl p-8 border-violet-500/30 border-2 mt-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-violet-500/20">
          <ShieldAlert className="text-violet-400" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Compliance Portal</h2>
          <p className="text-sm text-slate-400">Restricted access: Total Aggregated Payroll only</p>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-xl p-8 border border-white/10 text-center">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Total Organization Liability</p>
        
        {decryptedETH !== null && decryptedUSDC !== null ? (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 mb-4">
              <div className="text-center">
                <h1 className="text-4xl sm:text-5xl font-bold text-blue-400 mb-1 font-display">
                  {Number(decryptedETH)} <span className="text-xl sm:text-2xl text-blue-400/50">ETH</span>
                </h1>
                <p className="text-sm text-slate-500">ETH Liability</p>
              </div>
              <div className="hidden sm:block w-px h-16 bg-slate-700"></div>
              <div className="text-center">
                <h1 className="text-4xl sm:text-5xl font-bold text-emerald-400 mb-1 font-display">
                  ${Number(decryptedUSDC)}
                </h1>
                <p className="text-sm text-slate-500">USDC Liability</p>
              </div>
            </div>
            <p className="text-sm text-slate-500">Decrypted securely via FHE</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="flex gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="w-6 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <Lock size={12} className="text-slate-600" />
                </div>
              ))}
            </div>
            <button 
              onClick={handleRevealComplianceTotal}
              disabled={isDecrypting || !encryptedTotal}
              className="btn-primary flex items-center gap-2"
            >
              {isDecrypting ? (
                <><Loader2 size={18} className="animate-spin" /> Unsealing Data...</>
              ) : (
                <><Eye size={18} /> Decrypt Aggregate Total</>
              )}
            </button>
          </div>
        )}
      </div>
      
      {encryptedTotal && (
        <div className="mt-6 pt-6 border-t border-slate-800 text-center">
           <p className="text-[10px] text-slate-600 font-mono break-all px-4">
             Encrypted State: {String(encryptedTotal)}
           </p>
        </div>
      )}
    </div>
  );
}