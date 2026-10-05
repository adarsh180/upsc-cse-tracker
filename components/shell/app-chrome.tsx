"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  Sparkles,
  Target,
  X,
} from "lucide-react";

import { SacredLogoMark } from "@/components/shell/sacred-brand";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { navGroups } from "@/components/shell/nav-config";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { SyllabusCommand } from "@/components/ui/syllabus-command";
import { cn } from "@/lib/utils";

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

/* ── More sheet: every destination, grouped ─────────────────────── */
function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn("su-sheet-backdrop", open && "open")}
      />
      <div
        className={cn("su-sheet su-glass", open && "open")}
        role="dialog"
        aria-modal="true"
        aria-label="All pages"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="su-sheet-grab" aria-hidden="true" />
        <div className="su-sheet-head">
          <span>Everything</span>
          <button type="button" className="v2-iconbtn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <nav className="su-sheet-scroll">
          {navGroups.map((group, gi) => (
            <div key={group.label} className="su-sheet-group" style={{ "--g": gi } as React.CSSProperties}>
              <div className="su-sheet-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn("su-sheet-link", isActive(pathname, item.href) && "active")}
                    style={{ "--nav-accent": item.accent } as React.CSSProperties}
                  >
                    <span className="su-sheet-icon">
                      <Icon size={15} />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}

/* ── App chrome ─────────────────────────────────────────────────── */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = pathname === "/" || pathname === "/sign-in";
  // Guru is a full-screen chat surface on phones: it brings its own header,
  // so the global top bar + dock step aside below 860px.
  const isGuruPage = pathname.startsWith("/ai-insight/guru");
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const navRef = useLiquidIndicator(pathname);
  const dockRef = useLiquidIndicator(pathname);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

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
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="su-actions su-glass">
          <SyllabusCommand />
          <div className={cn("notify-host-inline", isGuruPage && "notify-host-guru")}>
            <NotificationCenter appLabel="UPSC Desk" defaultSender="Adarsh" partnerLabel="Misti's NEET phone" />
          </div>
          <ThemeToggle className="theme-toggle-inline" />
          <button
            type="button"
            className="v2-iconbtn su-more-btn"
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="All pages"
            aria-expanded={moreOpen}
          >
            <LayoutGrid size={17} />
          </button>
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
            >
              <Icon size={19} strokeWidth={active ? 2.3 : 1.9} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          data-item=""
          className={cn("su-dock-tab", moreOpen && "active")}
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="More pages"
          aria-expanded={moreOpen}
        >
          <LayoutGrid size={19} strokeWidth={moreOpen ? 2.3 : 1.9} />
          <span>More</span>
        </button>
      </nav>

      <MoreSheet open={moreOpen} onClose={closeMore} />
    </>
  );
}
