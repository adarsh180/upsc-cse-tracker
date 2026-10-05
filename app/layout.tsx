import type { Metadata, Viewport } from "next";
import { Doto, Funnel_Display, Geist, Geist_Mono, Noto_Serif_Devanagari } from "next/font/google";

import { LaunchSplash } from "@/components/launch-splash";
import { PwaRegister } from "@/components/pwa-register";
import { AppChrome } from "@/components/shell/app-chrome";
import { PaletteCycler } from "@/components/shell/palette-cycler";
import { RouteProgress } from "@/components/shell/route-progress";

import "./globals.css";
import "./redesign.css";
import "./premium.css";
import "./theme.css";
import "./study.css";
import "./editorial.css";
import "./nova.css";
import "./nova-goals.css";
import "./nova-study.css";
import "./sutra.css";
import "./sutra-pages.css";

// Sutra type system: Funnel Display for display and big figures, Geist for
// reading, Geist Mono for labels/data, Doto (dot-matrix) only for countdowns.
const bodyFont = Geist({
  subsets: ["latin"],
  variable: "--font-body",
});

const displayFont = Funnel_Display({
  subsets: ["latin"],
  variable: "--font-su-display",
});

const devanagariFont = Noto_Serif_Devanagari({
  subsets: ["latin"],
  variable: "--font-devanagari",
});

const monoFont = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const dotFont = Doto({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-dot",
});

export const metadata: Metadata = {
  title: "UPSC CSE Tracker",
  description:
    "Sacred Attempt is an editorial UPSC preparation workspace for syllabus mastery, daily execution, stage-aware tests, revision and analytics.",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090a" },
    { media: "(prefers-color-scheme: light)", color: "#f3f1ec" },
  ],
  // Keyboard resizes the layout, so fixed composers stay visible while typing
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-scroll-behavior="smooth"
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <body className={`${bodyFont.variable} ${displayFont.variable} ${devanagariFont.variable} ${monoFont.variable} ${dotFont.variable}`}>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("upsc-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}var d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t;var P=["brass","saffron","lotus","banyan","monsoon","terracotta"];d.dataset.palette=P[Math.floor(Date.now()/60000)%P.length]}catch(e){}',
          }}
        />
        <LaunchSplash />
        <PwaRegister />
        <PaletteCycler />
        <RouteProgress />
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
