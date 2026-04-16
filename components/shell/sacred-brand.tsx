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
      <span className="sacred-logo-core devanagari">ॐ</span>
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
