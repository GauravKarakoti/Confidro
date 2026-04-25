import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confidro — Private Payroll on Chain",
  description:
    "Privacy-preserving on-chain payroll protocol powered by Fully Homomorphic Encryption on Fhenix.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col noise">{children}</body>
    </html>
  );
}
