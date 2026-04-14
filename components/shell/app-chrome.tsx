"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";

import { QuickNav } from "@/components/shell/quick-nav";
import { TopBar } from "@/components/shell/topbar";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = pathname === "/" || pathname === "/sign-in";
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <>
      <TopBar onOpenMenu={() => setMenuOpen(true)} />
      <div className="app-shell">
        <div className="app-shell-inner">{children}</div>
      </div>
      <QuickNav open={menuOpen} onClose={closeMenu} />
    </>
  );
}
