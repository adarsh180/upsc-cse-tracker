"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

/**
 * Nova motion helpers — dependency-free, pure CSS driven.
 *
 * - `NovaStage` is the page root. It runs ONE IntersectionObserver that adds
 *   `.is-in` to every `[data-nv]` descendant (staggered via `--nv-i`), and ONE
 *   pointer listener that feeds `--mx/--my` to the `.nv-spot` card under the
 *   cursor for the spotlight glow. Touch devices skip the spotlight entirely.
 * - `CountUp` eases a number from 0 when it scrolls into view.
 *
 * Reduced motion is honoured in CSS (`app/nova.css`) and here (CountUp jumps).
 */

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function NovaStage({
  as,
  className,
  children,
  style,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
} & Record<`data-${string}`, string | undefined>) {
  const ref = useRef<HTMLElement | null>(null);
  const Tag = (as ?? "main") as ElementType;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.classList.add("nv-ready");

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-nv]"));
    let observer: IntersectionObserver | null = null;

    if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) {
      targets.forEach((el) => el.classList.add("is-in"));
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("is-in");
            observer?.unobserve(entry.target);
          }
        },
        { threshold: 0, rootMargin: "0px 0px -7% 0px" },
      );
      targets.forEach((el) => observer?.observe(el));
    }

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      const card = (event.target as HTMLElement | null)?.closest<HTMLElement>(".nv-spot");
      if (!card || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        card.style.setProperty("--my", `${event.clientY - rect.top}px`);
      });
    };
    if (finePointer) root.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      observer?.disconnect();
      if (finePointer) root.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <Tag ref={ref} className={className} style={style} {...rest}>
      {children}
    </Tag>
  );
}

export function CountUp({
  value,
  decimals = 0,
  duration = 1200,
  suffix = "",
  prefix = "",
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(value) || prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setDisplay(value);
      return;
    }

    let raf = 0;
    setDisplay(0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 4);
          setDisplay(value * eased);
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
