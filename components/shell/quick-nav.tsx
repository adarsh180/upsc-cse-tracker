"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, X } from "lucide-react";

import { navGroups } from "@/components/shell/nav-config";
import { SacredBrand } from "@/components/shell/sacred-brand";
import { cn } from "@/lib/utils";

export function QuickNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close menu backdrop"
        className={cn("quicknav-backdrop", open && "quicknav-backdrop-visible")}
        onClick={onClose}
      />

      <aside className={cn("quicknav-shell", open && "quicknav-shell-open")} aria-hidden={!open}>
        <div className="quicknav-panel">
          <div className="quicknav-panel-glow" />

          <div className="quicknav-header">
            <div className="quicknav-header-copy">
              <SacredBrand className="quicknav-brand" subtitle="Liquid-glass workspace map" markSize="sm" />
              <div>
                <div className="eyebrow">Navigation</div>
                <div className="quicknav-title">UPSC workspace map</div>
                <div className="quicknav-subtitle">All major sections in one premium command panel.</div>
              </div>
            </div>

            <button type="button" className="quicknav-close" onClick={onClose} aria-label="Close navigation">
              <X size={18} />
            </button>
          </div>

          <div className="quicknav-scroll">
            {navGroups.map((group) => (
              <section key={group.label} className="quicknav-group">
                <div className="quicknav-group-label">{group.label}</div>
                <div className="quicknav-grid">
                  {group.items.map((item, index) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn("quicknav-link", active && "quicknav-link-active")}
                        style={{ "--quicknav-accent": item.accent, "--quicknav-delay": `${index * 40}ms` } as CSSProperties}
                      >
                        <div className="quicknav-link-icon">
                          <Icon size={18} />
                        </div>
                        <div className="quicknav-link-copy">
                          <span className="quicknav-link-title">{item.label}</span>
                          <span className="quicknav-link-subtitle">{active ? "Current page" : "Open section"}</span>
                        </div>
                        <ArrowRight size={16} className="quicknav-link-arrow" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
