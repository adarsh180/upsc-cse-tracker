import type { Metadata } from "next";
import { Inter, Noto_Serif_Devanagari, Playfair_Display } from "next/font/google";

import { LaunchSplash } from "@/components/launch-splash";
import { PwaRegister } from "@/components/pwa-register";
import { AppChrome } from "@/components/shell/app-chrome";

import "./globals.css";
import "./redesign.css";
import "./premium.css";

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
  applicationName: "UPSC CSE Tracker",
  appleWebApp: {
    capable: true,
    title: "UPSC Tracker",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable} ${devanagariFont.variable}`}>
        <LaunchSplash />
        <PwaRegister />
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
