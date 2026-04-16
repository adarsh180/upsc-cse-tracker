"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Sparkles, ChevronRight } from "lucide-react";

import { SacredLogoMark } from "@/components/shell/sacred-brand";
import { navGroups } from "@/components/shell/nav-config";
import { cn } from "@/lib/utils";

/* ─── Nav Drawer Overlay ─────────────────────────────────────── */
function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Trap scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="nav-backdrop"
        />
      )}

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className={cn("nav-drawer", open && "nav-drawer-open")}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        {/* Decorative glow */}
        <div className="nav-drawer-glow" aria-hidden="true" />

        {/* Header */}
        <div className="nav-drawer-header">
          <Link href="/dashboard" className="nav-drawer-brand" onClick={onClose}>
            <SacredLogoMark size="sm" />
            <div className="nav-drawer-brand-copy">
              <span className="nav-drawer-brand-title">Sacred Attempt</span>
              <span className="nav-drawer-brand-subtitle">UPSC CSE 2027</span>
            </div>
          </Link>
          <button
            type="button"
            className="nav-drawer-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Guru Link — featured */}
        <div className="nav-drawer-guru-wrap">
          <Link
            href="/ai-insight/guru"
            className="nav-drawer-guru-link"
            onClick={onClose}
          >
            <Sparkles size={14} />
            <span>UPSC Guru</span>
            <ChevronRight size={13} style={{ marginLeft: "auto", opacity: 0.6 }} />
          </Link>
        </div>

        {/* Nav Groups */}
        <nav className="nav-drawer-scroll">
          {navGroups.map((group) => (
            <div key={group.label} className="nav-drawer-group">
              <div className="nav-drawer-group-label">{group.label}</div>
              <div className="nav-drawer-items">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn("nav-drawer-link", active && "nav-drawer-link-active")}
                      style={{ "--nav-accent": item.accent } as React.CSSProperties}
                    >
                      <span className="nav-drawer-link-icon">
                        <Icon size={14} />
                      </span>
                      <span className="nav-drawer-link-label">{item.label}</span>
                      {active && <span className="nav-drawer-link-dot" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="nav-drawer-footer">
          <span className="nav-drawer-status-dot" />
          <span className="nav-drawer-status-text">Live sync · All systems active</span>
        </div>
      </div>
    </>
  );
}

/* ─── Main App Chrome ─────────────────────────────────────────── */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = pathname === "/" || pathname === "/sign-in";
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  // Close on route change
  useEffect(() => { setNavOpen(false); }, [pathname]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Main content */}
      <div className="app-shell">
        <div className="app-shell-inner">{children}</div>
      </div>

      {/* Floating top-right menu trigger */}
      <div className="shell-float-bar-minimal">
        <button
          type="button"
          id="nav-menu-trigger"
          className="shell-menu-btn-premium"
          onClick={() => setNavOpen((v) => !v)}
          aria-label={navOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={navOpen}
        >
          <Menu size={18} />
          <span className="shell-menu-btn-label">Menu</span>
        </button>
      </div>

      {/* Nav Drawer */}
      <NavDrawer open={navOpen} onClose={closeNav} />
    </>
  );
}
