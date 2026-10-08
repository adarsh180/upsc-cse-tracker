import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

import "./vault.css";

const forgeDisplay = Space_Grotesk({ subsets: ["latin"], variable: "--font-forge", weight: ["400", "500", "600", "700"] });
const forgeMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-forge-mono", weight: ["400", "500", "700"] });

export const metadata: Metadata = { title: "Forge · AI-ML Vault", robots: { index: false, follow: false } };

/** The vault is its own arena: own type, own canvas, no UPSC chrome. */
export default function VaultRootLayout({ children }: { children: React.ReactNode }) {
  return <div className={`forge ${forgeDisplay.variable} ${forgeMono.variable}`}>{children}</div>;
}
