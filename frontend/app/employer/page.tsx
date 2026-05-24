"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { Briefcase, Wallet, Plus, Loader2 } from "lucide-react";
import EmployerDashboard from "@/components/EmployerDashboard";
import Navbar from "@/components/Navbar";
import { Providers } from "@/app/providers";
import { FACTORY_ABI, FACTORY_CONTRACT_ADDRESS } from "@/lib/contract";

function EmployerContent() {
  const { isConnected, address } = useAccount();
  const [activeOrgAddress, setActiveOrgAddress] = useState<`0x${string}` | null>(null);

  const { data: employerContracts, refetch: refetchContracts } = useReadContract({
    address: FACTORY_CONTRACT_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getContractsByEmployer",
    args: address ? [address] : undefined,
    query: { enabled: isConnected }
  });

  const { writeContractAsync: createOrg, isPending: isCreating } = useWriteContract();
  const [deployTxHash, setDeployTxHash] = useState<`0x${string}` | undefined>(undefined);
  
  const { isSuccess: isDeploySuccess, isLoading: isDeployConfirming } = useWaitForTransactionReceipt({
    hash: deployTxHash,
  });

  useEffect(() => {
    if (employerContracts && (employerContracts as `0x${string}`[]).length > 0) {
      setActiveOrgAddress((employerContracts as `0x${string}`[])[0]);
    } else {
      setActiveOrgAddress(null);
    }
  }, [employerContracts]);

  useEffect(() => {
    if (isDeploySuccess) refetchContracts();
  }, [isDeploySuccess, refetchContracts]);

  const handleDeployOrganization = async () => {
    try {
      const hash = await createOrg({
        address: FACTORY_CONTRACT_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "createOrganization",
      });
      setDeployTxHash(hash);
    } catch (error) {
      console.error("Failed to deploy organization:", error);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center flex-1 px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-2xl p-8 max-w-sm w-full text-center border border-violet-500/20">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-violet-500/10">
            <Briefcase size={26} className="text-violet-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>Connect as Employer</h2>
          <p className="text-sm text-slate-500 mb-6">Connect to Base Sepolia to access your organization.</p>
          <div className="flex justify-center"><ConnectKitButton /></div>
        </motion.div>
      </div>
    );
  }

  const isLoadingOrg = isCreating || isDeployConfirming;

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Employer Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <Wallet size={12} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
          </div>
        </div>
      </div>

      {activeOrgAddress ? (
        <EmployerDashboard contractAddress={activeOrgAddress} />
      ) : (
        <div className="glass rounded-2xl p-10 text-center max-w-md mx-auto mt-12">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-violet-500/10">
            <Briefcase size={32} className="text-violet-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-display)" }}>Create Your Organization</h3>
          <p className="text-sm text-slate-400 mb-8">Deploy your own isolated FHE Payroll contract. You will be the sole owner and administrator.</p>
          <button onClick={handleDeployOrganization} disabled={isLoadingOrg} className="btn-primary w-full">
            {isLoadingOrg ? <><Loader2 size={16} className="animate-spin" /> Deploying Protocol...</> : <><Plus size={16} /> Deploy Payroll Contract</>}
          </button>
        </div>
      )}
    </div>
  );
}

export default function EmployerRoute() {
  return (
    <Providers>
      <div className="flex flex-col min-h-screen grid-bg">
        <Navbar />
        <div className="pt-20 pb-12 flex flex-col flex-1">
          <EmployerContent />
        </div>
      </div>
    </Providers>
  );
}