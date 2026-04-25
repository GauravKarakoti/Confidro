"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { Briefcase, User, ShieldCheck, ShieldAlert, Wallet, Plus, Loader2 } from "lucide-react";
import EmployerDashboard from "./EmployerDashboard";
import EmployeeDashboard from "./EmployeeDashboard";
import ComplianceDashboard from "./ComplianceDashboard";
import { FACTORY_ABI, FACTORY_CONTRACT_ADDRESS } from "@/lib/contract";

type Role = "employer" | "employee" | "compliance";

function RoleToggle({
  role,
  onChange,
}: {
  role: Role;
  onChange: (r: Role) => void;
}) {
  return (
    <div
      className="relative flex p-1 rounded-xl w-full sm:w-auto"
      style={{
        background: "rgba(18,18,30,0.8)",
        border: "1px solid rgba(90,41,228,0.2)",
      }}
    >
      {/* Sliding indicator adjusted for 3 items */}
      <motion.div
        layoutId="roleIndicator"
        className="absolute top-1 bottom-1 rounded-lg"
        style={{
          background: "linear-gradient(135deg, #5A29E4 0%, #7B4FF0 100%)",
          width: "calc(33.33% - 2.6px)",
          left: role === "employer" ? "4px" : role === "employee" ? "calc(33.33% + 1px)" : "calc(66.66% - 1px)",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />

      {(["employer", "employee", "compliance"] as Role[]).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className="relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 flex-1 justify-center whitespace-nowrap"
          style={{
            color: role === r ? "white" : "rgba(160,160,190,0.7)",
            fontFamily: "var(--font-body)",
          }}
        >
          {r === "employer" && <Briefcase size={14} />}
          {r === "employee" && <User size={14} />}
          {r === "compliance" && <ShieldAlert size={14} />}
          {r.charAt(0).toUpperCase() + r.slice(1)}
        </button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { isConnected, address } = useAccount();
  const [role, setRole] = useState<Role>("employer");
  
  // State for Employee/Compliance view to enter their Org address
  const [orgInput, setOrgInput] = useState("");
  const [activeOrgAddress, setActiveOrgAddress] = useState<`0x${string}` | null>(null);

  // Read Factory Contract to get Employer's deployed organizations
  const { data: employerContracts, refetch: refetchContracts } = useReadContract({
    address: FACTORY_CONTRACT_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getContractsByEmployer",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && role === "employer" }
  });

  // Write hook to deploy a new organization
  const { writeContractAsync: createOrg, isPending: isCreating } = useWriteContract();
  const [deployTxHash, setDeployTxHash] = useState<`0x${string}` | undefined>(undefined);
  
  const { isSuccess: isDeploySuccess, isLoading: isDeployConfirming } = useWaitForTransactionReceipt({
    hash: deployTxHash,
  });

  // Auto-select the first organization if the employer has one
  useEffect(() => {
    if (role === "employer" && employerContracts && (employerContracts as `0x${string}`[]).length > 0) {
      setActiveOrgAddress((employerContracts as `0x${string}`[])[0]);
    } else if (role === "employer") {
      setActiveOrgAddress(null);
    }
  }, [employerContracts, role]);

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
      <div className="min-h-screen flex items-center justify-center px-6 grid-bg">
        {/* BG orbs */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(90,41,228,0.15) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="glass rounded-2xl p-8 max-w-sm w-full text-center"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: "linear-gradient(135deg, #5A29E4 0%, #0A5C3E 100%)",
            }}
          >
            <ShieldCheck size={26} className="text-white" />
          </div>
          <h2
            className="text-xl font-bold text-white mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Connect your wallet
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Connect to Base Sepolia to access the Confidro payroll dashboard.
          </p>
          <div className="flex justify-center">
            {/* ConnectKit Button Drop-in */}
            <ConnectKitButton />
          </div>
        </motion.div>
      </div>
    );
  }

  const isLoadingOrg = isCreating || isDeployConfirming;

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8 grid-bg">
      {/* Background */}
      <div
        className="fixed top-0 right-0 w-[600px] h-[600px] pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, rgba(90,41,228,0.1) 0%, transparent 60%)",
        }}
      />
      <div
        className="fixed bottom-0 left-0 w-[400px] h-[400px] pointer-events-none opacity-30"
        style={{
          background:
            "radial-gradient(circle at 20% 80%, rgba(10,92,62,0.12) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-white capitalize"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {role} Dashboard
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Wallet size={12} className="text-slate-500" />
              <span className="text-xs text-slate-500 font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <span className="badge badge-green">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Base Sepolia
              </span>
            </div>
          </div>

          <RoleToggle role={role} onChange={setRole} />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {role === "employer" && (
              activeOrgAddress ? (
                <EmployerDashboard contractAddress={activeOrgAddress} />
              ) : (
                <div className="glass rounded-2xl p-10 text-center max-w-md mx-auto mt-12">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(90,41,228,0.1)" }}>
                    <Briefcase size={32} className="text-violet-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-display)" }}>Create Your Organization</h3>
                  <p className="text-sm text-slate-400 mb-8">Deploy your own isolated FHE Payroll contract. You will be the sole owner and administrator.</p>
                  
                  <button 
                    onClick={handleDeployOrganization} 
                    disabled={isLoadingOrg}
                    className="btn-primary w-full"
                  >
                    {isLoadingOrg ? (
                      <><Loader2 size={16} className="animate-spin" /> Deploying Protocol...</>
                    ) : (
                      <><Plus size={16} /> Deploy Payroll Contract</>
                    )}
                  </button>
                </div>
              )
            )}

            {role === "employee" && (
              activeOrgAddress ? (
                <EmployeeDashboard /> 
              ) : (
                <div className="glass rounded-2xl p-8 max-w-md mx-auto mt-12">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(10,92,62,0.1)" }}>
                    <User size={32} className="text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 text-center" style={{ fontFamily: "var(--font-display)" }}>Access Organization</h3>
                  <p className="text-sm text-slate-400 mb-6 text-center">Enter the payroll contract address provided by your employer.</p>
                  
                  <input
                    type="text"
                    placeholder="0x..."
                    value={orgInput}
                    onChange={(e) => setOrgInput(e.target.value)}
                    className="input-field mb-4"
                  />
                  <button 
                    onClick={() => setActiveOrgAddress(orgInput as `0x${string}`)}
                    className="btn-green w-full"
                    disabled={!orgInput.startsWith('0x')}
                  >
                    Connect to Organization
                  </button>
                </div>
              )
            )}

            {role === "compliance" && (
              activeOrgAddress ? (
                <ComplianceDashboard contractAddress={activeOrgAddress} />
              ) : (
                <div className="glass rounded-2xl p-8 max-w-md mx-auto mt-12 border-violet-500/20 border">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(90,41,228,0.1)" }}>
                    <ShieldAlert size={32} className="text-violet-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 text-center" style={{ fontFamily: "var(--font-display)" }}>Compliance Audit Portal</h3>
                  <p className="text-sm text-slate-400 mb-6 text-center">Enter the organization's contract address to access the aggregated payroll ledger.</p>
                  
                  <input
                    type="text"
                    placeholder="0x..."
                    value={orgInput}
                    onChange={(e) => setOrgInput(e.target.value)}
                    className="input-field mb-4 focus:ring-violet-500"
                  />
                  <button 
                    onClick={() => setActiveOrgAddress(orgInput as `0x${string}`)}
                    className="btn-primary w-full"
                    disabled={!orgInput.startsWith('0x')}
                  >
                    Authenticate Ledger
                  </button>
                </div>
              )
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}