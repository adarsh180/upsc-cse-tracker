"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sparkles } from "lucide-react";

import { primaryNavItems } from "@/components/shell/nav-config";
import { cn } from "@/lib/utils";

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        {/* Brand */}
        <Link href="/dashboard" className="topbar-logo">
          <div className="topbar-logo-mark devanagari">ॐ</div>
          <div className="topbar-logo-copy">
            <span className="topbar-logo-title" style={{ fontFamily: "var(--font-display, serif)", fontWeight: 700 }}>
              Sacred Attempt
            </span>
            <span className="topbar-logo-subtitle">UPSC CSE 2027</span>
          </div>
        </Link>

        {/* Primary nav */}
        <nav className="topbar-nav">
          {primaryNavItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("topbar-link", active && "topbar-link-active")}
              >
                <Icon size={13} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="topbar-actions">
          <div className="topbar-status">
            <span className="dot-online" />
            Live sync
          </div>

          <Link href="/ai-insight/guru" className="topbar-chip">
            <Sparkles size={13} style={{ color: "var(--gold)" }} />
            <span style={{ color: "var(--gold-bright)", fontWeight: 800 }}>UPSC Guru</span>
          </Link>

          <button
            type="button"
            className="topbar-menu-button"
            onClick={onOpenMenu}
            aria-label="Open navigation"
            suppressHydrationWarning
          >
            <Menu size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
