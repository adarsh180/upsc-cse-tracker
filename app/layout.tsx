import type { Metadata, Viewport } from "next";
import { Inter, Noto_Serif_Devanagari } from "next/font/google";

import { LaunchSplash } from "@/components/launch-splash";
import { PwaRegister } from "@/components/pwa-register";
import { AppChrome } from "@/components/shell/app-chrome";

import "./globals.css";
import "./redesign.css";
import "./premium.css";
import "./theme.css";
import "./study.css";

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0d11",
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
      <body className={`${bodyFont.variable} ${devanagariFont.variable}`}>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("upsc-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}var d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t}catch(e){}',
          }}
        />
        <LaunchSplash />
        <PwaRegister />
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
