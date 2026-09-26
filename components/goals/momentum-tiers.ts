/** Hour-grading ladder shared by the heatmap, the logging form and the masthead dial.
 *  8h+ is the first genuinely good day; 12h+ is peak. */

export type MomentumTier = {
  tier: number;
  emoji: string;
  label: string;
  min: number;
  accent: string;
  glow: string;
};

export const MOMENTUM_TIERS: MomentumTier[] = [
  { tier: 0, emoji: "·", label: "Rest", min: 0, accent: "rgba(255,255,255,0.18)", glow: "transparent" },
  { tier: 1, emoji: "🌱", label: "Drift", min: 0.01, accent: "hsl(210, 22%, 58%)", glow: "hsla(210,40%,60%,0.30)" },
  { tier: 2, emoji: "📖", label: "Warming", min: 4, accent: "hsl(199, 78%, 60%)", glow: "hsla(199,80%,58%,0.34)" },
  { tier: 3, emoji: "🔥", label: "Close", min: 6, accent: "hsl(28, 92%, 60%)", glow: "hsla(28,92%,58%,0.40)" },
  { tier: 4, emoji: "💪", label: "Good", min: 8, accent: "hsl(148, 62%, 52%)", glow: "hsla(148,70%,52%,0.46)" },
  { tier: 5, emoji: "🏆", label: "Strong", min: 10, accent: "hsl(168, 70%, 54%)", glow: "hsla(168,76%,52%,0.50)" },
  { tier: 6, emoji: "🚀", label: "Peak", min: 12, accent: "hsl(38, 96%, 60%)", glow: "hsla(38,96%,58%,0.62)" },
];

export function tierForHours(hours: number): number {
  if (hours <= 0) return 0;
  if (hours < 4) return 1;
  if (hours < 6) return 2;
  if (hours < 8) return 3;
  if (hours < 10) return 4;
  if (hours < 12) return 5;
  return 6;
}
