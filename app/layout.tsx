import type { Metadata } from "next";
import { Inter, Noto_Serif_Devanagari, Playfair_Display } from "next/font/google";

import { AppChrome } from "@/components/shell/app-chrome";

import "./globals.css";

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const displayFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
});

const devanagariFont = Noto_Serif_Devanagari({
  subsets: ["latin"],
  variable: "--font-devanagari",
});

export const metadata: Metadata = {
  title: "UPSC CSE Tracker",
  description:
    "A premium sacred-glass UPSC preparation workspace for dashboarding, daily goals, mood, tests, performance and AI insight.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable} ${devanagariFont.variable}`}>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
