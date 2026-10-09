"use client";

import { usePathname, useRouter } from "next/navigation";

import { DashOrbit } from "@/components/dash-orbit";

/** UPSC site's dashboard switch: the desk, the AI-ML vault and Saath (the last two ask for the switch password). */
export function UpscOrbit() {
  const pathname = usePathname();
  const router = useRouter();
  const at = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  return (
    <DashOrbit
      items={[
        { key: "desk", label: "UPSC desk", sub: "CSE 2027", logo: "/brand/upsc-desk-160.webp", current: !at("/vault") && !at("/hub"), onPick: () => router.push("/dashboard") },
        { key: "vault", label: "AI-ML", logo: "/brand/ai-ml-160.webp", current: at("/vault"), locked: true, onPick: () => router.push("/vault") },
        { key: "hub", label: "Saath", logo: "/brand/saath-160.webp", current: at("/hub"), locked: true, onPick: () => router.push("/hub") },
      ]}
    />
  );
}
