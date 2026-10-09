"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { lockVaultAction } from "@/app/vault/actions";
import { ForgeMark, IconBack, IconBranch, IconChip, IconCore, IconGate, IconLock, IconLog, IconSpark, IconTrace } from "@/components/vault/icons";

const LINKS = [
  { href: "/vault", label: "Core", icon: IconCore },
  { href: "/vault/stage", label: "Gates", icon: IconGate },
  { href: "/vault/log", label: "Log", icon: IconLog },
  { href: "/vault/journey", label: "Journey", icon: IconTrace },
  { href: "/vault/tracks", label: "Tracks", icon: IconChip },
  { href: "/vault/review", label: "Review", icon: IconSpark },
  { href: "/vault/what-if", label: "What-if", icon: IconBranch },
];

export function ForgeNav() {
  const pathname = usePathname();
  const active = (href: string) => (href === "/vault" ? pathname === "/vault" : pathname.startsWith(href));
  return (
    <header className="fg-top">
      <Link href="/vault" className="fg-brand" aria-label="Forge — AI-ML vault home">
        <ForgeMark />
        <span>
          <b>Forge</b>
          <small>AI-ML VAULT</small>
        </span>
      </Link>
      <nav className="fg-nav" aria-label="Vault">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined}>
            <l.icon size={16} />
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="fg-top-actions">
        <Link href="/dashboard" className="fg-iconbtn" aria-label="Back to the UPSC desk">
          <IconBack size={16} />
          <span>UPSC desk</span>
        </Link>
        <form action={lockVaultAction}>
          <button type="submit" className="fg-iconbtn is-lock" aria-label="Lock the vault now">
            <IconLock size={16} />
            <span>Lock</span>
          </button>
        </form>
      </div>
    </header>
  );
}
