import {
  Activity,
  BarChart3,
  BookOpen,
  BrainCircuit,
  ClipboardList,
  Compass,
  ListTodo,
  FileText,
  Goal,
  HeartPulse,
  LayoutDashboard,
  Newspaper,
  PenSquare,
  ScanSearch,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

export const navGroups = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, accent: "var(--gold)" },
      { href: "/goals", label: "Daily Goals", icon: Target, accent: "var(--rose-bright)" },
      { href: "/tests", label: "Test Tracker", icon: ClipboardList, accent: "var(--physics)" },
      { href: "/performance", label: "Performance", icon: Activity, accent: "var(--lotus-bright)" },
      { href: "/mood", label: "Mood Tracker", icon: HeartPulse, accent: "var(--saffron)" },
      { href: "/mission-control", label: "Mission Control", icon: BrainCircuit, accent: "var(--gold-bright)" },
      { href: "/todo", label: "Todo Board", icon: ListTodo, accent: "var(--botany)" },
    ],
  },
  {
    label: "AI Insight",
    items: [
      { href: "/ai-insight", label: "AI Hub", icon: Sparkles, accent: "var(--gold)" },
      { href: "/ai-insight/guru", label: "UPSC Guru", icon: BrainCircuit, accent: "var(--gold-bright)" },
      { href: "/ai-insight/rank-prediction", label: "Rank Prediction", icon: Trophy, accent: "var(--botany)" },
      { href: "/ai-insight/deep-analytics", label: "Deep Analytics", icon: ScanSearch, accent: "var(--physics)" },
      { href: "/ai-insight/essay-checker", label: "Essay Checker", icon: PenSquare, accent: "var(--rose-bright)" },
    ],
  },
  {
    label: "GS Papers",
    items: [
      { href: "/study/general-studies-1", label: "GS 1 — Heritage", icon: BookOpen, accent: "var(--gs1, hsl(142,60%,48%))" },
      { href: "/study/general-studies-2", label: "GS 2 — Polity", icon: Compass, accent: "var(--gs2, hsl(218,84%,62%))" },
      { href: "/study/general-studies-3", label: "GS 3 — Economy", icon: BarChart3, accent: "var(--gs3, hsl(38,88%,54%))" },
      { href: "/study/general-studies-4", label: "GS 4 — Ethics", icon: Goal, accent: "var(--gs4, hsl(270,68%,62%))" },
    ],
  },
  {
    label: "Optional & More",
    items: [
      { href: "/study/psir", label: "PSIR Optional", icon: FileText, accent: "var(--psir, hsl(185,72%,50%))" },
      { href: "/study/csat", label: "CSAT Paper II", icon: Zap, accent: "var(--csat, hsl(352,60%,60%))" },
      { href: "/study/essay", label: "Essay Paper", icon: PenSquare, accent: "var(--gold)" },
      { href: "/study/current-affairs", label: "Current Affairs", icon: Newspaper, accent: "var(--lotus-bright)" },
    ],
  },
] as const;

export const primaryNavItems = navGroups[0].items;
