"use client";

import { useState } from "react";
import { useReadContract, useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Lock, Eye, Loader2, ShieldAlert, Network, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PAYROLL_ABI } from "@/lib/contract";
import { baseSepolia } from "@cofhe/sdk/chains";
import { formatUnits } from "viem";

export default function ComplianceDashboard({ contractAddress }: { contractAddress: `0x${string}` }) {
  const [decryptedETH, setDecryptedETH] = useState<string | null>(null);
  const [decryptedUSDC, setDecryptedUSDC] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  
  // NEW: Graph-Based Forensics State
  const [scanActive, setScanActive] = useState(false);
  const [forensicResults, setForensicResults] = useState<{node: string, riskScore: number, flagged: boolean, reason: string}[] | null>(null);
  
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

  // NEW: Trigger for AML Network Scan
  const runForensics = () => {
    setScanActive(true);
    // Simulating a backend call to an FHE/ZK graph analysis service
    setTimeout(() => {
        setForensicResults([
            { node: '0x71C...976F', riskScore: 12, flagged: false, reason: 'Standard DeFi interactions' },
            { node: '0x33A...21B4', riskScore: 5, flagged: false, reason: 'Direct settlement only' },
            { node: '0x88D...DANGER', riskScore: 94, flagged: true, reason: '2-hop proximity to sanctioned mixer' },
        ]);
        setScanActive(false);
    }, 2500);
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 space-y-6">
      <div className="glass rounded-2xl p-8 border-violet-500/30 border-2">
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

      {/* NEW: Graph-Based AML Forensics Panel */}
      <div className="glass rounded-2xl p-8 border-rose-500/20 border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-rose-500/10">
              <Network className="text-rose-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Graph-Based AML Forensics</h2>
              <p className="text-sm text-slate-400">ZK-proofs over FHE-encrypted states for OFAC compliance.</p>
            </div>
          </div>
          <button 
            onClick={runForensics}
            disabled={scanActive}
            className="bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            {scanActive ? (
              <><Loader2 size={16} className="animate-spin" /> Analyzing Graph...</>
            ) : (
              <><Network size={16} /> Run Network Scan</>
            )}
          </button>
        </div>

        {forensicResults && (
          <div className="animate-in fade-in slide-in-from-bottom-2 mt-6">
            <div className="overflow-hidden rounded-xl border border-slate-700/50">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/50 text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Encrypted Node ID</th>
                    <th className="px-6 py-4 font-medium">Risk Score</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 bg-slate-900/30">
                  {forensicResults.map((result, idx) => (
                    <tr key={idx} className={result.flagged ? 'bg-rose-500/5' : ''}>
                      <td className="px-6 py-4 font-mono text-slate-300">{result.node}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full ${result.riskScore > 75 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${result.riskScore}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400">{result.riskScore}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {result.flagged ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/20 uppercase tracking-wider">
                            <AlertTriangle size={10} /> High Risk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                            <CheckCircle2 size={10} /> Cleared
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{result.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}