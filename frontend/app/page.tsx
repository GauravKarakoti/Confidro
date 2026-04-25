"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Dashboard from "@/components/Dashboard";
import { Providers } from "./providers";

export default function Home() {
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <Providers>
      <div className="flex flex-col flex-1">
        <Navbar />
        {showDashboard ? (
          <Dashboard />
        ) : (
          <Hero onLaunch={() => setShowDashboard(true)} />
        )}
      </div>
    </Providers>
  );
}
