import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#5A29E4",
          "purple-light": "#7B4FF0",
          "purple-dark": "#3D19A8",
          green: "#0A5C3E",
          "green-light": "#0E7D54",
          "green-neon": "#00FF9D",
        },
        surface: {
          DEFAULT: "#0C0C14",
          card: "#12121E",
          border: "#1E1E32",
          muted: "#1A1A2C",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "mesh-purple":
          "radial-gradient(ellipse at 20% 50%, #5A29E430 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #0A5C3E20 0%, transparent 50%)",
        "mesh-card":
          "linear-gradient(135deg, rgba(90,41,228,0.08) 0%, rgba(10,92,62,0.05) 100%)",
        "glow-border":
          "linear-gradient(135deg, #5A29E4 0%, #0A5C3E 50%, #5A29E4 100%)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 20s linear infinite",
        float: "float 6s ease-in-out infinite",
        "gradient-shift": "gradientShift 8s ease infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      boxShadow: {
        purple: "0 0 40px rgba(90,41,228,0.3)",
        "purple-sm": "0 0 16px rgba(90,41,228,0.25)",
        green: "0 0 40px rgba(10,92,62,0.4)",
        "green-sm": "0 0 16px rgba(0,255,157,0.2)",
        card: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
