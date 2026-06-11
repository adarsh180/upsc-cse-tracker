"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";

/* Primary destinations — desktop top nav + mobile bottom tabs */
const primaryTabs = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/tests", label: "Tests", icon: ClipboardList },
  { href: "/ai-insight/guru", label: "Guru", icon: Sparkles },
] as const;

const desktopNav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/goals", label: "Goals" },
  { href: "/tests", label: "Tests" },
  { href: "/performance", label: "Performance" },
  { href: "/ai-insight/guru", label: "Guru" },
  { href: "/report-card", label: "Report Card" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
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
        className={cn("v2-sheet-backdrop", open && "open")}
      />
      <div
        className={cn("v2-sheet", open && "open")}
        role="dialog"
        aria-modal="true"
        aria-label="All pages"
        aria-hidden={!open}
      >
        <div className="v2-sheet-grab" aria-hidden="true" />
        <div className="v2-sheet-head">
          <span className="v2-sheet-title">All pages</span>
          <button type="button" className="v2-iconbtn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <nav className="v2-sheet-scroll">
          {navGroups.map((group) => (
            <div key={group.label} className="v2-sheet-group">
              <div className="v2-sheet-group-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn("v2-sheet-link", isActive(pathname, item.href) && "active")}
                    style={{ "--nav-accent": item.accent } as React.CSSProperties}
                  >
                    <span className="v2-sheet-link-icon">
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
  // so the global top bar + tab bar step aside below 860px.
  const isGuruPage = pathname.startsWith("/ai-insight/guru");
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);

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
      {/* Top bar */}
      <header className={cn("v2-topbar", isGuruPage && "v2-mobile-hidden")}>
        <div className="v2-topbar-inner">
          <Link href="/dashboard" className="v2-brand">
            <SacredLogoMark size="sm" />
            <span>
              <span className="v2-brand-title">Sacred Attempt</span>
              <span className="v2-brand-sub">UPSC CSE 2027</span>
            </span>
          </Link>

          <ThemeToggle className="theme-toggle-inline" />

          <nav className="v2-topnav" aria-label="Primary">
            {desktopNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn("v2-topnav-link", isActive(pathname, item.href) && "active")}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="v2-topbar-actions">
            <button
              type="button"
              className="v2-iconbtn"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="All pages"
              aria-expanded={moreOpen}
            >
              <LayoutGrid size={17} />
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <div className="app-shell">
        <div className="app-shell-inner">{children}</div>
      </div>

      {/* Notifications (renders its own floating UI; hidden on Guru mobile) */}
      <div className={cn(isGuruPage && "notify-host-guru")}>
        <NotificationCenter appLabel="UPSC Desk" defaultSender="Adarsh" partnerLabel="Misti's NEET phone" />
      </div>

      {/* Bottom tab bar — mobile */}
      <nav className={cn("v2-tabbar", isGuruPage && "v2-mobile-hidden")} aria-label="Primary">
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(pathname, tab.href);
          return (
            <Link key={tab.href} href={tab.href} className={cn("v2-tab", active && "active")}>
              <span className="v2-tab-icon">
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              </span>
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          className={cn("v2-tab", moreOpen && "active")}
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="More pages"
          aria-expanded={moreOpen}
        >
          <span className="v2-tab-icon">
            <LayoutGrid size={19} strokeWidth={moreOpen ? 2.4 : 2} />
          </span>
          More
        </button>
      </nav>

      <MoreSheet open={moreOpen} onClose={closeMore} />
    </>
  );
}
