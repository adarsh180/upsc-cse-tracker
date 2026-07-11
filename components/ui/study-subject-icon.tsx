import type { LucideIcon } from "lucide-react";
import {
  Atom,
  Banknote,
  BookOpenText,
  BrainCircuit,
  Building2,
  Calculator,
  Castle,
  ChartNoAxesCombined,
  Columns3,
  Compass,
  Factory,
  FilePenLine,
  Gavel,
  Globe2,
  Handshake,
  Landmark,
  Leaf,
  MapPinned,
  Mountain,
  Newspaper,
  Palette,
  Scale,
  ScrollText,
  Shield,
  ShieldAlert,
  Telescope,
  UsersRound,
  Vote,
} from "lucide-react";

import { cn } from "@/lib/utils";

type StudyVisual = {
  key: string;
  icon: LucideIcon;
};

const exactVisuals: Record<string, StudyVisual> = {
  "general-studies-1": { key: "heritage", icon: Landmark },
  "general-studies-2": { key: "polity", icon: Scale },
  "general-studies-3": { key: "development", icon: ChartNoAxesCombined },
  "general-studies-4": { key: "ethics", icon: Compass },
  psir: { key: "psir", icon: Vote },
  csat: { key: "csat", icon: BrainCircuit },
  essay: { key: "essay", icon: FilePenLine },
  "current-affairs": { key: "current-affairs", icon: Newspaper },
  geography: { key: "geography", icon: Globe2 },
  "physical-geography": { key: "terrain", icon: Mountain },
  "indian-geography": { key: "india-map", icon: MapPinned },
  "economic-geography": { key: "industry", icon: Factory },
  "human-geography": { key: "society", icon: UsersRound },
  "modern-history": { key: "modern-history", icon: ScrollText },
  "ancient-history": { key: "ancient-history", icon: Columns3 },
  "medieval-history": { key: "medieval-history", icon: Castle },
  "art-culture": { key: "culture", icon: Palette },
  "indian-society": { key: "society", icon: UsersRound },
  "indian-polity": { key: "polity", icon: Landmark },
  governance: { key: "governance", icon: Building2 },
  "international-relations": { key: "international-relations", icon: Handshake },
  "social-justice": { key: "social-justice", icon: Scale },
  "indian-economy": { key: "economy", icon: Banknote },
  "science-technology": { key: "science", icon: Atom },
  "disaster-management": { key: "disaster", icon: ShieldAlert },
  "internal-security": { key: "security", icon: Shield },
  environment: { key: "environment", icon: Leaf },
  ethics: { key: "ethics", icon: Compass },
  "psir-international-relations": { key: "international-relations", icon: Globe2 },
  "political-theories-and-ideologies": { key: "political-theory", icon: Gavel },
  "indian-politics": { key: "polity", icon: Vote },
  "comparative-politics-analysis": { key: "comparative-politics", icon: Globe2 },
  "logical-reasoning": { key: "reasoning", icon: BrainCircuit },
  "reading-comprehension": { key: "reading", icon: BookOpenText },
  "quantitative-aptitude": { key: "quantitative", icon: Calculator },
};

const keywordVisuals: Array<[string, StudyVisual]> = [
  ["geography", { key: "geography", icon: Globe2 }],
  ["climate", { key: "environment", icon: Leaf }],
  ["ecology", { key: "environment", icon: Leaf }],
  ["environment", { key: "environment", icon: Leaf }],
  ["history", { key: "history", icon: ScrollText }],
  ["civilization", { key: "ancient-history", icon: Columns3 }],
  ["architecture", { key: "culture", icon: Landmark }],
  ["painting", { key: "culture", icon: Palette }],
  ["heritage", { key: "culture", icon: Landmark }],
  ["society", { key: "society", icon: UsersRound }],
  ["gender", { key: "society", icon: UsersRound }],
  ["population", { key: "society", icon: UsersRound }],
  ["constitution", { key: "polity", icon: Landmark }],
  ["rights", { key: "social-justice", icon: Scale }],
  ["governance", { key: "governance", icon: Building2 }],
  ["policy", { key: "governance", icon: Building2 }],
  ["neighbourhood", { key: "international-relations", icon: Handshake }],
  ["global", { key: "international-relations", icon: Globe2 }],
  ["vulnerable", { key: "social-justice", icon: Scale }],
  ["econom", { key: "economy", icon: Banknote }],
  ["fiscal", { key: "economy", icon: Banknote }],
  ["agriculture", { key: "economy", icon: ChartNoAxesCombined }],
  ["industry", { key: "industry", icon: Factory }],
  ["digital", { key: "science", icon: Atom }],
  ["space", { key: "space", icon: Telescope }],
  ["manufacturing", { key: "industry", icon: Factory }],
  ["energy", { key: "science", icon: Atom }],
  ["disaster", { key: "disaster", icon: ShieldAlert }],
  ["vulnerability", { key: "disaster", icon: ShieldAlert }],
  ["resilience", { key: "disaster", icon: ShieldAlert }],
  ["security", { key: "security", icon: Shield }],
  ["terror", { key: "security", icon: Shield }],
  ["border", { key: "security", icon: Shield }],
  ["cyber", { key: "security", icon: Shield }],
  ["ethic", { key: "ethics", icon: Compass }],
  ["attitude", { key: "ethics", icon: Compass }],
  ["case-study", { key: "ethics", icon: Gavel }],
  ["politic", { key: "psir", icon: Vote }],
  ["reasoning", { key: "reasoning", icon: BrainCircuit }],
  ["comprehension", { key: "reading", icon: BookOpenText }],
  ["quantitative", { key: "quantitative", icon: Calculator }],
];

export function resolveStudyVisual(slug: string, title?: string): StudyVisual {
  const normalizedSlug = slug.toLowerCase();
  const exact = exactVisuals[normalizedSlug];
  if (exact) return exact;

  const haystack = `${normalizedSlug} ${title ?? ""}`.toLowerCase();
  return keywordVisuals.find(([keyword]) => haystack.includes(keyword))?.[1] ?? { key: "study", icon: BookOpenText };
}

export function StudySubjectIcon({
  slug,
  title,
  size = 22,
  className,
}: {
  slug: string;
  title?: string;
  size?: number;
  className?: string;
}) {
  const visual = resolveStudyVisual(slug, title);
  const Icon = visual.icon;

  return (
    <span className={cn("study-semantic-icon", className)} data-study-visual={visual.key} aria-hidden="true">
      <Icon size={size} strokeWidth={1.7} />
    </span>
  );
}
