"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

/**
 * Lightweight, dependency-free scroll/entrance reveal system.
 *
 * - `RevealGroup` wraps a section and staggers any descendant marked with
 *   `data-reveal` (or rendered via `<Reveal />`). It uses a single
 *   IntersectionObserver, so it is cheap even with many children.
 * - Animation itself is pure CSS (see `app/premium.css` → `[data-reveal]`).
 * - Honors `prefers-reduced-motion` via the CSS layer.
 *
 * No layout/feature impact: purely additive visual polish.
 */

export function RevealGroup({
  as,
  children,
  className,
  style,
  threshold = 0.12,
  once = true,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  threshold?: number;
  once?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const Tag = (as ?? "div") as ElementType;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (root.hasAttribute("data-reveal")) targets.unshift(root);
    if (targets.length === 0) return;

    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            entry.target.classList.remove("is-revealed");
          }
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [threshold, once]);

  return (
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
}

export function Reveal({
  as,
  children,
  className,
  style,
  delay,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Stagger index 0–12 → adds `delay * 60ms`. */
  delay?: number;
}) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      data-reveal=""
      data-delay={delay != null ? String(delay) : undefined}
      className={className}
      style={style}
    >
      {children}
    </Tag>
  );
}
