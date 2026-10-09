"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  Sparkles,
  Target,
} from "lucide-react";

import { SacredLogoMark } from "@/components/shell/sacred-brand";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { navGroups } from "@/components/shell/nav-config";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { SyllabusCommand } from "@/components/ui/syllabus-command";
import { cn } from "@/lib/utils";
import { UpscOrbit } from "@/components/shell/upsc-orbit";
import { PageDial, type DialItem } from "@/components/page-dial";
import { irisGo } from "@/components/iris";

/* Primary destinations — desktop island + mobile dock */
const primaryTabs = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/tests", label: "Tests", icon: ClipboardList },
  { href: "/ai-insight/guru", label: "Guru", icon: Sparkles },
] as const;

const desktopNav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/goals", label: "Goals" },
  { href: "/tests", label: "Tests" },
  { href: "/performance", label: "Performance" },
  { href: "/ai-insight/guru", label: "Guru" },
  { href: "/report-card", label: "Report" },
  { href: "/vault", label: "AI-ML" },
  { href: "/hub", label: "Saath" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Liquid indicator: one glass "drop" inside a nav that sits under the active
 * item and slides (with a little stretch) to whatever the pointer is over.
 * Position lives in CSS custom properties on the container, so moving it
 * never re-renders React.
 */
function useLiquidIndicator(pathname: string) {
  const ref = useRef<HTMLElement | null>(null);

  const moveTo = useCallback((target: Element | null) => {
    const host = ref.current;
    if (!host) return;
    if (!target) {
      host.style.setProperty("--blob-o", "0");
      return;
    }
    const hostBox = host.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    host.style.setProperty("--blob-x", `${box.left - hostBox.left}px`);
    host.style.setProperty("--blob-w", `${box.width}px`);
    host.style.setProperty("--blob-o", "1");
  }, []);

  const toActive = useCallback(() => {
    moveTo(ref.current?.querySelector("[data-active='true']") ?? null);
  }, [moveTo]);

  useIsoLayoutEffect(() => {
    toActive();
  }, [pathname, toActive]);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // Enable the transition only after the first placement, so the drop
    // doesn't fly in from the left edge on load.
    const raf = window.requestAnimationFrame(() => host.classList.add("is-ready"));
    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const item = (event.target as HTMLElement).closest("[data-item]");
      if (item && host.contains(item)) moveTo(item);
    };
    const onResize = () => toActive();
    host.addEventListener("pointerover", onOver);
    host.addEventListener("pointerleave", toActive);
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(toActive).catch(() => undefined);
    return () => {
      window.cancelAnimationFrame(raf);
      host.removeEventListener("pointerover", onOver);
      host.removeEventListener("pointerleave", toActive);
      window.removeEventListener("resize", onResize);
    };
  }, [moveTo, toActive]);

  return ref;
}

/* ── Page dial: every destination on two rings ─────────────────── */
// Short names for the ring; the dial's hub shows the full label.
const SHORT: Record<string, string> = {
  "/goals": "Goals", "/tests": "Tests", "/mood": "Mood", "/mission-control": "Mission", "/todo": "Todo", "/dashboard": "Home",
  "/ai-insight": "AI hub", "/ai-insight/guru": "Guru", "/report-card": "Report", "/ai-insight/rank-prediction": "Rank",
  "/ai-insight/deep-analytics": "Analytics", "/ai-insight/essay-checker": "Essay AI", "/study/general-studies-1": "GS 1",
  "/study/general-studies-2": "GS 2", "/study/general-studies-3": "GS 3", "/study/general-studies-4": "GS 4",
  "/study/psir": "PSIR", "/study/csat": "CSAT", "/study/essay": "Essay", "/current-affairs": "Affairs",
};
// Workspace pages on the inner ring; AI, papers and the rest outside. AI-ML and Saath are dashboards (the switch).
const dialItems: DialItem[] = navGroups
  .filter((g) => g.label !== "Private")
  .flatMap((g, gi) => g.items.map((it) => ({ href: it.href, label: it.label, short: SHORT[it.href], icon: it.icon, group: g.label === "Optional & More" ? "Optional" : g.label, ring: gi === 0 ? (0 as const) : (1 as const) })));

/* ── App chrome ─────────────────────────────────────────────────── */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = pathname === "/" || pathname === "/sign-in";
  // Guru is a full-screen chat surface on phones: it brings its own header,
  // so the global top bar + dock step aside below 860px.
  const isGuruPage = pathname.startsWith("/ai-insight/guru");
  const router = useRouter();
  // Rail and dock links open their page through the same circular iris as the dial.
  const irisLink = (e: React.MouseEvent<HTMLAnchorElement>, href: string, label: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || isActive(pathname, href)) return;
    e.preventDefault();
    irisGo(() => router.push(href), { x: e.clientX, y: e.clientY }, label);
  };
  const navRef = useLiquidIndicator(pathname);
  const dockRef = useLiquidIndicator(pathname);

  // The AI-ML vault and Saath are separate arenas with their own chrome.
  if (pathname.startsWith("/vault") || pathname === "/hub" || pathname.startsWith("/hub/")) return <>{children}</>;

  if (isPublicPage) {
    return (
      <>
        <ThemeToggle className="theme-toggle-public" />
        {children}
      </>
    );
  }

  return (
    <>
      <header className={cn("su-top", isGuruPage && "su-mobile-hidden")}>
        <Link href="/dashboard" className="su-brand su-glass" aria-label="Sacred Attempt — overview">
          <SacredLogoMark size="sm" />
          <span className="su-brand-copy">
            <span className="su-brand-title">Sacred Attempt</span>
            <span className="su-brand-sub">CSE · 2027</span>
          </span>
        </Link>

        <nav
          className="su-nav su-glass"
          aria-label="Primary"
          ref={navRef as React.RefObject<HTMLElement>}
        >
          <span className="su-blob" aria-hidden="true" />
          {desktopNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-item=""
                data-active={active}
                aria-current={active ? "page" : undefined}
                className={cn("su-nav-link", active && "active")}
                onClick={(e) => irisLink(e, item.href, item.label)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="su-actions su-glass">
          <UpscOrbit />
          <SyllabusCommand />
          <div className={cn("notify-host-inline", isGuruPage && "notify-host-guru")}>
            <NotificationCenter appLabel="UPSC Desk" defaultSender="Adarsh" partnerLabel="Misti's NEET desk" />
          </div>
          <ThemeToggle className="theme-toggle-inline" />
          <span className="su-more-btn"><PageDial items={dialItems} title="Sacred Attempt" label="All pages" /></span>
        </div>
      </header>

      <div className="app-shell su-shell">
        <div className="app-shell-inner">{children}</div>
      </div>

      {/* Bottom dock — phones and small tablets */}
      <nav
        className={cn("su-dock su-glass", isGuruPage && "su-mobile-hidden")}
        aria-label="Primary"
        ref={dockRef as React.RefObject<HTMLElement>}
      >
        <span className="su-blob" aria-hidden="true" />
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-item=""
              data-active={active}
              aria-current={active ? "page" : undefined}
              className={cn("su-dock-tab", active && "active")}
              onClick={(e) => irisLink(e, tab.href, tab.label)}
            >
              <Icon size={19} strokeWidth={active ? 2.3 : 1.9} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <span className="su-dock-dial">
          <PageDial items={dialItems} title="Sacred Attempt" label="All pages" variant="dock" />
        </span>
      </nav>
    </>
  );
}
