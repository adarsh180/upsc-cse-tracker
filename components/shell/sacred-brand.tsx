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
    <div className={cn("sacred-logo sacred-logo-image", `sacred-logo-${size}`, className)} aria-hidden="true">
      <img src="/upsc-logo-mark.png" alt="" draggable={false} />
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
