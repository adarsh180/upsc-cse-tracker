/**
 * How much each syllabus subject is worth in the real exam, so coverage and
 * revision count by marks — not by how many topics a book splits a subject into.
 *
 * Prelims (GS Paper I, 100 questions): approximate questions per subject from
 * 2015–2025 papers, tilted toward 2023–25 (more IR / current-linked questions,
 * fewer direct static ones). Ranges move ±3 a year; these are planning priors.
 * Cut-off trend (General): 75.41 (2023) → 87.98 (2024) → 92.66 (2025) of 200.
 *
 * Mains (1,750 written marks): GS I–IV 250 each, Essay 250, Optional (PSIR)
 * 500 — split inside each GS paper by recent question patterns.
 * CSAT is qualifying (33%) and handled as its own gate, not as coverage.
 */

type Rule = { re: RegExp; w: number };

const PRELIMS: Rule[] = [
  { re: /polity|constitution/i, w: 15 },
  { re: /econom/i, w: 15 },
  { re: /environment|ecology/i, w: 14 },
  { re: /geograph/i, w: 12 },
  { re: /science|tech/i, w: 9 },
  { re: /international|relations/i, w: 8 },
  { re: /modern/i, w: 7 },
  { re: /art|culture/i, w: 6 },
  { re: /ancient/i, w: 4 },
  { re: /medieval/i, w: 3 },
  { re: /governance/i, w: 2 },
  { re: /social justice/i, w: 2 },
  { re: /society/i, w: 1 },
  { re: /internal security|security/i, w: 1 },
  { re: /disaster/i, w: 1 },
];

export const MAINS_PAPER_MARKS: Record<string, number> = {
  "general-studies-1": 250,
  "general-studies-2": 250,
  "general-studies-3": 250,
  "general-studies-4": 250,
  essay: 250,
  psir: 500,
};

const MAINS_SPLIT: Record<string, Rule[]> = {
  "general-studies-1": [
    { re: /geograph/i, w: 85 },
    { re: /modern/i, w: 50 },
    { re: /society/i, w: 45 },
    { re: /art|culture/i, w: 30 },
    { re: /world/i, w: 20 },
    { re: /ancient/i, w: 10 },
    { re: /medieval/i, w: 10 },
  ],
  "general-studies-2": [
    { re: /international|relations/i, w: 75 },
    { re: /polity|constitution/i, w: 70 },
    { re: /social justice/i, w: 55 },
    { re: /governance/i, w: 50 },
  ],
  "general-studies-3": [
    { re: /econom/i, w: 90 },
    { re: /internal security|security/i, w: 50 },
    { re: /science|tech/i, w: 45 },
    { re: /environment|ecology/i, w: 40 },
    { re: /disaster/i, w: 25 },
  ],
  psir: [
    { re: /paper\s*ii\b|paper 2/i, w: 250 },
    { re: /paper\s*i\b|paper 1/i, w: 230 },
    { re: /basic/i, w: 20 },
  ],
};

export const PRELIMS_PAPERS = ["general-studies-1", "general-studies-2", "general-studies-3"];

const ruleWeight = (rules: Rule[], title: string) => rules.find((r) => r.re.test(title))?.w ?? null;

export type SubjectWeight = { paper: string; title: string; prelims: number; mains: number };

/**
 * Weights for the subjects that actually exist in the syllabus tree. Mains
 * weights are re-normalised inside each paper so the paper still sums to its
 * marks even if subjects are renamed, merged or added; an unknown subject
 * takes the paper's average share.
 */
export function subjectWeights(subjects: Array<{ paper: string; title: string }>): SubjectWeight[] {
  const out = subjects.map((s) => ({
    paper: s.paper,
    title: s.title,
    prelims: PRELIMS_PAPERS.includes(s.paper) ? ruleWeight(PRELIMS, s.title) ?? 0 : 0,
    mains: 0,
  }));
  for (const [paper, total] of Object.entries(MAINS_PAPER_MARKS)) {
    const idx = out.map((s, i) => (s.paper === paper ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    const rules = MAINS_SPLIT[paper];
    const raw = idx.map((i) => (rules ? ruleWeight(rules, out[i].title) : 1));
    const known = raw.filter((x): x is number => x !== null);
    const fill = known.length ? known.reduce((s, x) => s + x, 0) / known.length : 1;
    const vals = raw.map((x) => x ?? fill);
    const sum = vals.reduce((s, x) => s + x, 0) || 1;
    idx.forEach((i, k) => (out[i].mains = (vals[k] / sum) * total));
  }
  return out;
}
