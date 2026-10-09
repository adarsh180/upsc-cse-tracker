"use client";

import { HubProvider } from "@/components/hub/hub-context";
import { HubShell } from "@/components/hub/hub-shell";
import { UpscOrbit } from "@/components/shell/upsc-orbit";

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <HubProvider base="/hub" site="upsc" api="/api/hub" lockUrl="/api/hub/lock">
      <HubShell switcher={<UpscOrbit />}>{children}</HubShell>
    </HubProvider>
  );
}
