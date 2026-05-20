"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

export function SacredLogoMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className={cn("sacred-logo", `sacred-logo-${size}`, className)} aria-hidden="true">
      <span className="sacred-logo-ring sacred-logo-ring-a" />
      <span className="sacred-logo-ring sacred-logo-ring-b" />
      <span className="sacred-logo-ring sacred-logo-ring-c" />
      <span className="sacred-logo-core">
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle cx="32" cy="24" r="12" stroke="currentColor" strokeWidth="4" />
          <path d="M32 10v28M18 24h28M22 15l20 20M42 15 22 35" stroke="var(--physics)" strokeWidth="2.7" strokeLinecap="round" />
          <path d="M16 49h32M21 43h22M24 43V35M32 43V35M40 43V35" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M22 35h20L32 29 22 35Z" fill="currentColor" />
        </svg>
      </span>
      <span className="sacred-logo-dot sacred-logo-dot-a" />
      <span className="sacred-logo-dot sacred-logo-dot-b" />
    </div>
  );
}

export function SacredBrand({
  href = "/dashboard",
  title = "Sacred Attempt",
  subtitle = "UPSC command room",
  className,
  markSize = "md",
}: {
  href?: string;
  title?: string;
  subtitle?: string;
  className?: string;
  markSize?: "sm" | "md" | "lg";
}) {
  return (
    <Link href={href} className={cn("sacred-brand", className)}>
      <SacredLogoMark size={markSize} />
      <span className="sacred-brand-copy">
        <span className="sacred-brand-title">{title}</span>
        <span className="sacred-brand-subtitle">{subtitle}</span>
      </span>
    </Link>
  );
}
