"use client";

import type { CSSProperties } from "react";

type GuruVisualAccent = "gold" | "blue" | "sage" | "rose";
type GuruVisualTheme =
  | "generic"
  | "geopolitics"
  | "geography"
  | "polity"
  | "economy"
  | "science"
  | "history"
  | "society"
  | "environment"
  | "ethics";
type GuruVisualView = "chain" | "compare" | "cycle" | "layers";
type LegacyLayout = "flow" | "cycle" | "compare" | "stack";

type GuruVisualStep = {
  title: string;
  detail: string;
  accent?: GuruVisualAccent;
  cue?: string;
};

type GuruVisualNodeKind =
  | "actor"
  | "institution"
  | "region"
  | "pressure"
  | "input"
  | "output"
  | "process"
  | "outcome";

type GuruVisualNode = {
  id: string;
  label: string;
  detail?: string;
  kind?: GuruVisualNodeKind;
  accent?: GuruVisualAccent;
  zone?: string;
};

type GuruVisualEdge = {
  from: string;
  to: string;
  label?: string;
};

type GuruVisualSchema = {
  title: string;
  summary?: string;
  theme?: GuruVisualTheme;
  view?: GuruVisualView;
  layout?: LegacyLayout;
  focus?: string;
  highlights?: string[];
  nodes?: GuruVisualNode[];
  edges?: GuruVisualEdge[];
  steps: GuruVisualStep[];
};

type EnrichedGuruVisualStep = GuruVisualStep & {
  cue: string;
  accent: GuruVisualAccent;
  split: {
    cause: string;
    effect: string;
  };
  spanClass: string;
};

export type ParsedGuruMessage = {
  markdown: string;
  visual: GuruVisualSchema | null;
};

const VISUAL_TAG_PATTERN = /<guru_visual>\s*([\s\S]*?)\s*<\/guru_visual>/i;
const ALLOWED_ACCENTS: GuruVisualAccent[] = ["gold", "blue", "sage", "rose"];
const ALLOWED_THEMES: GuruVisualTheme[] = [
  "generic",
  "geopolitics",
  "geography",
  "polity",
  "economy",
  "science",
  "history",
  "society",
  "environment",
  "ethics",
];
const ALLOWED_VIEWS: GuruVisualView[] = ["chain", "compare", "cycle", "layers"];
const ALLOWED_NODE_KINDS: GuruVisualNodeKind[] = ["actor", "institution", "region", "pressure", "input", "output", "process", "outcome"];
const LEGACY_LAYOUT_MAP: Record<LegacyLayout, GuruVisualView> = {
  flow: "chain",
  compare: "compare",
  cycle: "cycle",
  stack: "layers",
};

function sanitizeAccent(value: unknown): GuruVisualAccent {
  return typeof value === "string" && ALLOWED_ACCENTS.includes(value as GuruVisualAccent)
    ? (value as GuruVisualAccent)
    : "gold";
}

function sanitizeTheme(value: unknown): GuruVisualTheme {
  return typeof value === "string" && ALLOWED_THEMES.includes(value as GuruVisualTheme)
    ? (value as GuruVisualTheme)
    : "generic";
}

function sanitizeView(value: unknown): GuruVisualView {
  return typeof value === "string" && ALLOWED_VIEWS.includes(value as GuruVisualView)
    ? (value as GuruVisualView)
    : "chain";
}

function sanitizeNodeKind(value: unknown): GuruVisualNodeKind {
  return typeof value === "string" && ALLOWED_NODE_KINDS.includes(value as GuruVisualNodeKind)
    ? (value as GuruVisualNodeKind)
    : "process";
}

function resolveView(view?: string, layout?: string): GuruVisualView {
  if (view && ALLOWED_VIEWS.includes(view as GuruVisualView)) {
    return view as GuruVisualView;
  }

  if (layout && Object.hasOwn(LEGACY_LAYOUT_MAP, layout)) {
    return LEGACY_LAYOUT_MAP[layout as LegacyLayout];
  }

  return "chain";
}

function titleCase(input: string) {
  return input
    .trim()
    .replace(/^[\d.\-\s]+/, "")
    .replace(/\s+/g, " ")
    .replace(/^[a-z]/, (char) => char.toUpperCase());
}

function splitStepDetail(detail: string) {
  const normalized = detail
    .replace(/\s+/g, " ")
    .replace(/\u2192/g, "->")
    .trim();

  const delimited = normalized
    .split(/\s*;\s*|\s+therefore\s+|\s+so\s+|\s+hence\s+|\s+thus\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (delimited.length >= 2) {
    return {
      cause: delimited[0],
      effect: delimited.slice(1).join("; "),
    };
  }

  const arrowParts = normalized.split(/\s*->\s*/).map((part) => part.trim()).filter(Boolean);
  if (arrowParts.length >= 2) {
    return {
      cause: arrowParts[0],
      effect: arrowParts.slice(1).join(" -> "),
    };
  }

  return {
    cause: normalized,
    effect: "",
  };
}

function splitLineToStep(line: string, index: number): GuruVisualStep | null {
  const cleaned = line.trim().replace(/^[\d]+[.)]\s*/, "").replace(/^[-*]\s*/, "");
  if (cleaned.length < 12) return null;

  const [rawTitle, ...rest] = cleaned.split(/:\s+/);
  const detail = (rest.join(": ") || cleaned).trim();

  return {
    title: rawTitle && rest.length ? titleCase(rawTitle) : `Step ${index + 1}`,
    detail,
    accent: ALLOWED_ACCENTS[index % ALLOWED_ACCENTS.length],
  };
}

function inferTheme(visual: Pick<GuruVisualSchema, "title" | "summary" | "steps">): GuruVisualTheme {
  const corpus = `${visual.title} ${visual.summary ?? ""} ${visual.steps.map((step) => `${step.title} ${step.detail}`).join(" ")}`
    .toLowerCase()
    .normalize("NFKD");

  if (/\biran\b|\bisrael\b|\bhamas\b|\bhezbollah\b|\bwar\b|\bconflict\b|\bmediation\b|\bstrike\b|\bproxy\b|\balliance\b|\bsecurity\b/.test(corpus)) {
    return "geopolitics";
  }

  if (/\bmonsoon\b|\benso\b|\bel nino\b|\bla nina\b|\brainfall\b|\bplate\b|\batmosphere\b|\bocean\b|\bclimate\b|\bcyclone\b/.test(corpus)) {
    return "geography";
  }

  if (/\bconstitution\b|\bparliament\b|\bbill\b|\bpresident\b|\bgovernor\b|\bcabinet\b|\bjudiciary\b|\barticle\b|\bordinance\b/.test(corpus)) {
    return "polity";
  }

  if (/\binflation\b|\bgdp\b|\brepo\b|\bfiscal\b|\bmonetary\b|\bmarket\b|\bbanking\b|\beconomy\b|\bsubsidy\b|\btrade\b/.test(corpus)) {
    return "economy";
  }

  if (/\bhistory\b|\brevolt\b|\bfreedom struggle\b|\bmughal\b|\bmaurya\b|\bgupta\b|\bindus\b|\bmodern india\b|\btimeline\b|\bchronology\b/.test(corpus)) {
    return "history";
  }

  if (/\bsociety\b|\bcaste\b|\bgender\b|\bpoverty\b|\burbanization\b|\bmigration\b|\bcommunity\b|\bsocial justice\b|\bempowerment\b/.test(corpus)) {
    return "society";
  }

  if (/\benvironment\b|\bbiodiversity\b|\becosystem\b|\bforest\b|\bconservation\b|\bwetland\b|\bclimate action\b|\bpollution\b/.test(corpus)) {
    return "environment";
  }

  if (/\bethics\b|\bintegrity\b|\baptitude\b|\bvalue\b|\bdilemma\b|\baccountability\b|\bprobity\b|\bempathy\b/.test(corpus)) {
    return "ethics";
  }

  if (/\bdna\b|\bcell\b|\benzyme\b|\bphotosynthesis\b|\brespiration\b|\bbiology\b|\bphysics\b|\bchemistry\b|\bimmune\b/.test(corpus)) {
    return "science";
  }

  return "generic";
}

function getThemeMeta(theme: GuruVisualTheme) {
  switch (theme) {
    case "geopolitics":
      return {
        eyebrow: "Strategic theatre",
        focusLabel: "Conflict frame",
        causeLabel: "Strategic move",
        effectLabel: "Regional effect",
      };
    case "geography":
      return {
        eyebrow: "Physical process",
        focusLabel: "Core mechanism",
        causeLabel: "Physical shift",
        effectLabel: "Impact on India",
      };
    case "polity":
      return {
        eyebrow: "Institutional logic",
        focusLabel: "Decision path",
        causeLabel: "Institutional step",
        effectLabel: "Governance effect",
      };
    case "economy":
      return {
        eyebrow: "Economic chain",
        focusLabel: "Transmission path",
        causeLabel: "Economic shift",
        effectLabel: "Market or welfare effect",
      };
    case "science":
      return {
        eyebrow: "Scientific mechanism",
        focusLabel: "Operating principle",
        causeLabel: "What changes",
        effectLabel: "Scientific outcome",
      };
    case "history":
      return {
        eyebrow: "Historical sequence",
        focusLabel: "Chronology anchor",
        causeLabel: "Historical trigger",
        effectLabel: "Historical outcome",
      };
    case "society":
      return {
        eyebrow: "Social dynamics",
        focusLabel: "Social faultline",
        causeLabel: "Social driver",
        effectLabel: "Societal effect",
      };
    case "environment":
      return {
        eyebrow: "Ecology system",
        focusLabel: "Ecology mechanism",
        causeLabel: "Environmental driver",
        effectLabel: "Ecological effect",
      };
    case "ethics":
      return {
        eyebrow: "Ethics pathway",
        focusLabel: "Decision principle",
        causeLabel: "Value or dilemma",
        effectLabel: "Ethical outcome",
      };
    default:
      return {
        eyebrow: "Dynamic view",
        focusLabel: "Main focus",
        causeLabel: "What changes",
        effectLabel: "Main outcome",
      };
  }
}

function deriveHighlights(visual: GuruVisualSchema) {
  if (visual.highlights?.length) {
    return visual.highlights.map((item) => item.trim()).filter(Boolean).slice(0, 4);
  }

  return visual.steps.map((step) => step.title.trim()).filter(Boolean).slice(0, 4);
}

function deriveFocus(visual: GuruVisualSchema, themeMeta: ReturnType<typeof getThemeMeta>) {
  if (visual.focus?.trim()) return visual.focus.trim();
  if (visual.summary?.trim()) return visual.summary.trim();
  return `${themeMeta.focusLabel} from ${visual.title}`;
}

function inferCue(step: GuruVisualStep, view: GuruVisualView, index: number) {
  if (step.cue?.trim()) return step.cue.trim();

  const lower = step.title.toLowerCase();
  if (lower.includes("normal")) return "Baseline";
  if (lower.includes("el niño") || lower.includes("el nino")) return "Warm phase";
  if (lower.includes("la niña") || lower.includes("la nina")) return "Cold phase";
  if (view === "compare") return index === 0 ? "Side A" : "Side B";
  if (view === "cycle") return "Loop stage";
  if (view === "layers") return "Layer";
  return "Stage";
}

function inferSpanClass(view: GuruVisualView, step: GuruVisualStep, index: number) {
  const detailLength = `${step.title} ${step.detail}`.length;

  if (view === "compare") return "span-6";
  if (view === "cycle") return "span-6";
  if (view === "layers") return detailLength > 110 ? "span-12" : "span-6";
  if (index === 0 && detailLength > 95) return "span-8";
  if (detailLength > 135) return "span-8";
  return "span-4";
}

function buildNodeStyle(index: number, accent: GuruVisualAccent): CSSProperties {
  const glow =
    accent === "blue"
      ? "rgba(173,213,255,0.24)"
      : accent === "sage"
        ? "rgba(159,214,183,0.22)"
        : accent === "rose"
          ? "rgba(255,181,195,0.22)"
          : "rgba(248,226,168,0.24)";

  return {
    animationDelay: `${index * 90}ms`,
    ["--guru-node-glow" as string]: glow,
  } as CSSProperties;
}

function buildConnectorStyle(index: number): CSSProperties {
  return {
    animationDelay: `${index * 90 + 40}ms`,
  };
}

function enrichSteps(visual: GuruVisualSchema, view: GuruVisualView): EnrichedGuruVisualStep[] {
  return visual.steps.slice(0, 5).map((step, index) => ({
    ...step,
    accent: sanitizeAccent(step.accent),
    cue: inferCue(step, view, index),
    split: splitStepDetail(step.detail),
    spanClass: inferSpanClass(view, step, index),
  }));
}

function deriveVisualFromMarkdown(markdown: string): GuruVisualSchema | null {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const numberedLines = lines.filter((line) => /^(\d+[.)]\s+|[-*]\s+)/.test(line)).slice(0, 5);
  if (numberedLines.length < 3) return null;

  const steps = numberedLines
    .map((line, index) => splitLineToStep(line, index))
    .filter((step): step is GuruVisualStep => Boolean(step));

  if (steps.length < 3) return null;

  const titleSource =
    lines.find((line) => /^#{1,3}\s+/.test(line))?.replace(/^#{1,3}\s+/, "") ??
    lines.find((line) => line.length > 20 && !/^(\d+[.)]\s+|[-*]\s+)/.test(line)) ??
    "Topic breakdown";

  return {
    title: titleCase(titleSource).slice(0, 72),
    summary: "Structured from the explanation above.",
    theme: "generic",
    view: "chain",
    highlights: steps.map((step) => step.title).slice(0, 4),
    nodes: [],
    edges: [],
    steps,
  };
}

function sanitizeSchema(input: unknown): GuruVisualSchema | null {
  if (!input || typeof input !== "object") return null;

  const candidate = input as {
    title?: unknown;
    summary?: unknown;
    theme?: unknown;
    view?: unknown;
    layout?: unknown;
    focus?: unknown;
    highlights?: unknown;
    nodes?: unknown;
    edges?: unknown;
    steps?: unknown;
  };

  if (typeof candidate.title !== "string" || !Array.isArray(candidate.steps)) {
    return null;
  }

  const steps = candidate.steps
    .map((step) => {
      if (!step || typeof step !== "object") return null;
      const current = step as { title?: unknown; detail?: unknown; accent?: unknown; cue?: unknown };
      if (typeof current.title !== "string" || typeof current.detail !== "string") return null;

      return {
        title: current.title.trim(),
        detail: current.detail.trim(),
        accent: sanitizeAccent(current.accent),
        cue: typeof current.cue === "string" ? current.cue.trim() : undefined,
      };
    })
    .filter((step): step is NonNullable<typeof step> => Boolean(step?.title && step?.detail))
    .slice(0, 5);

  if (steps.length < 2) return null;

  const highlights = Array.isArray(candidate.highlights)
    ? candidate.highlights.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 4)
    : [];

  const nodes = Array.isArray(candidate.nodes)
    ? candidate.nodes
        .map((node) => {
          if (!node || typeof node !== "object") return null;
          const current = node as {
            id?: unknown;
            label?: unknown;
            detail?: unknown;
            kind?: unknown;
            accent?: unknown;
            zone?: unknown;
          };

          if (typeof current.id !== "string" || typeof current.label !== "string") return null;

          return {
            id: current.id.trim(),
            label: current.label.trim(),
            detail: typeof current.detail === "string" ? current.detail.trim() : "",
            kind: sanitizeNodeKind(current.kind),
            accent: sanitizeAccent(current.accent),
            zone: typeof current.zone === "string" ? current.zone.trim() : "",
          };
        })
        .filter((node): node is NonNullable<typeof node> => Boolean(node?.id && node?.label))
        .slice(0, 8)
    : [];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(candidate.edges)
    ? candidate.edges
        .map((edge) => {
          if (!edge || typeof edge !== "object") return null;
          const current = edge as { from?: unknown; to?: unknown; label?: unknown };
          if (typeof current.from !== "string" || typeof current.to !== "string") return null;
          if (!nodeIds.has(current.from.trim()) || !nodeIds.has(current.to.trim())) return null;

          return {
            from: current.from.trim(),
            to: current.to.trim(),
            label: typeof current.label === "string" ? current.label.trim() : "",
          };
        })
        .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge?.from && edge?.to))
        .slice(0, 12)
    : [];

  return {
    title: candidate.title.trim(),
    summary: typeof candidate.summary === "string" ? candidate.summary.trim() : "",
    theme: sanitizeTheme(candidate.theme),
    view: resolveView(typeof candidate.view === "string" ? candidate.view : undefined, typeof candidate.layout === "string" ? candidate.layout : undefined),
    focus: typeof candidate.focus === "string" ? candidate.focus.trim() : "",
    highlights,
    nodes,
    edges,
    steps,
  };
}

function hasSemanticScene(visual: GuruVisualSchema) {
  return Boolean(visual.nodes?.length && visual.edges?.length);
}

export function parseGuruMessage(content: string): ParsedGuruMessage {
  const match = content.match(VISUAL_TAG_PATTERN);
  if (!match) {
    return { markdown: content.trim(), visual: null };
  }

  let visual: GuruVisualSchema | null = null;

  try {
    visual = sanitizeSchema(JSON.parse(match[1]));
  } catch {
    visual = null;
  }

  const markdown = content.replace(VISUAL_TAG_PATTERN, "").trim();
  return { markdown, visual: visual ?? deriveVisualFromMarkdown(markdown) };
}

export function GuruVisualExplainer({ visual }: { visual: GuruVisualSchema }) {
  const theme = visual.theme === "generic" ? inferTheme(visual) : (visual.theme ?? inferTheme(visual));
  const view = resolveView(visual.view, visual.layout);
  const themeMeta = getThemeMeta(theme);
  const focus = deriveFocus(visual, themeMeta);
  const highlights = deriveHighlights(visual);
  const steps = enrichSteps(visual, view);
  const semantic = hasSemanticScene(visual);

  return (
    <section className={`guru-scene-card theme-${theme} view-${view}`} aria-label={`${visual.title} dynamic view`}>
      <div className="guru-scene-head">
        <div className="guru-scene-kicker">{themeMeta.eyebrow}</div>
        <h3 className="guru-scene-title">{visual.title}</h3>
        {visual.summary ? <p className="guru-scene-summary">{visual.summary}</p> : null}

        <div className="guru-scene-meta">
          <div className="guru-scene-focus">
            <span className="guru-scene-focus-label">{themeMeta.focusLabel}</span>
            <span className="guru-scene-focus-value">{focus}</span>
          </div>

          {highlights.length ? (
            <div className="guru-scene-highlights" role="list" aria-label="Visual highlights">
              {highlights.map((item) => (
                <span key={item} className="guru-scene-chip" role="listitem">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="guru-scene-stage">
        <div className="guru-scene-backdrop guru-scene-backdrop-a" />
        <div className="guru-scene-backdrop guru-scene-backdrop-b" />
        {semantic && theme === "economy" ? (
          <EconomySemanticScene visual={visual} />
        ) : semantic && theme === "geography" ? (
          <GeographySemanticScene visual={visual} />
        ) : semantic && theme === "polity" ? (
          <PolitySemanticScene visual={visual} />
        ) : semantic && theme === "history" ? (
          <HistorySemanticScene visual={visual} />
        ) : semantic && theme === "society" ? (
          <SocietySemanticScene visual={visual} />
        ) : semantic && theme === "environment" ? (
          <EnvironmentSemanticScene visual={visual} />
        ) : semantic && theme === "ethics" ? (
          <EthicsSemanticScene visual={visual} />
        ) : theme === "economy" ? (
          <EconomyScene steps={steps} themeMeta={themeMeta} />
        ) : theme === "geography" ? (
          <GeographyScene steps={steps} themeMeta={themeMeta} />
        ) : theme === "geopolitics" ? (
          <GeopoliticsScene steps={steps} themeMeta={themeMeta} />
        ) : theme === "polity" ? (
          <PolityScene steps={steps} themeMeta={themeMeta} />
        ) : theme === "science" ? (
          <ScienceScene steps={steps} themeMeta={themeMeta} />
        ) : theme === "history" ? (
          <HistoryScene steps={steps} themeMeta={themeMeta} />
        ) : theme === "society" ? (
          <SocietyScene steps={steps} themeMeta={themeMeta} />
        ) : theme === "environment" ? (
          <EnvironmentScene steps={steps} themeMeta={themeMeta} />
        ) : theme === "ethics" ? (
          <EthicsScene steps={steps} themeMeta={themeMeta} />
        ) : (
          <GenericScene steps={steps} themeMeta={themeMeta} />
        )}
      </div>
    </section>
  );
}

function getNodeToneClass(kind: GuruVisualNodeKind) {
  switch (kind) {
    case "actor":
      return "tone-actor";
    case "institution":
      return "tone-institution";
    case "region":
      return "tone-region";
    case "pressure":
      return "tone-pressure";
    case "input":
      return "tone-input";
    case "output":
      return "tone-output";
    case "outcome":
      return "tone-outcome";
    default:
      return "tone-process";
  }
}

function getNodeKindLabel(kind: GuruVisualNodeKind) {
  switch (kind) {
    case "actor":
      return "Actor";
    case "institution":
      return "Institution";
    case "region":
      return "Region";
    case "pressure":
      return "Pressure";
    case "input":
      return "Input";
    case "output":
      return "Output";
    case "outcome":
      return "Outcome";
    default:
      return "Process";
  }
}

function SemanticNode({
  node,
}: {
  node: GuruVisualNode;
}) {
  return (
    <article className={`guru-semantic-node ${getNodeToneClass(node.kind ?? "process")} accent-${sanitizeAccent(node.accent)}`}>
      <div className="guru-semantic-node-top">
        <div className="guru-semantic-node-kind">{getNodeKindLabel(node.kind ?? "process")}</div>
        {node.zone ? <div className="guru-semantic-node-zone">{node.zone}</div> : null}
      </div>
      <div className="guru-semantic-node-label">{node.label}</div>
      {node.detail ? <p className="guru-semantic-node-detail">{node.detail}</p> : null}
    </article>
  );
}

function EconomySemanticScene({ visual }: { visual: GuruVisualSchema }) {
  const nodes = visual.nodes ?? [];
  const edges = visual.edges ?? [];

  return (
    <div className="guru-semantic guru-semantic-economy">
      <div className="guru-semantic-lane" role="list">
        {nodes.map((node, index) => (
          <div key={node.id} className="guru-semantic-lane-item" role="listitem">
            <SemanticNode node={node} />
            {index < nodes.length - 1 ? (
              <div className="guru-semantic-link guru-semantic-link-horizontal" aria-hidden="true">
                <span />
                <small>{edges[index]?.label || ""}</small>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function GeographySemanticScene({ visual }: { visual: GuruVisualSchema }) {
  const nodes = visual.nodes ?? [];
  const processNodes = nodes.filter((node) => (node.kind ?? "process") !== "region");
  const regionNodes = nodes.filter((node) => (node.kind ?? "process") === "region");

  return (
    <div className="guru-semantic guru-semantic-geography">
      <div className="guru-semantic-process-column" role="list">
        {processNodes.map((node, index) => (
          <div key={node.id} className="guru-semantic-process-item" role="listitem">
            <SemanticNode node={node} />
            {index < processNodes.length - 1 ? (
              <div className="guru-semantic-link guru-semantic-link-vertical" aria-hidden="true">
                <span />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="guru-semantic-impact-column">
        <div className="guru-semantic-impact-title">India Impact Zones</div>
        <div className="guru-semantic-impact-grid" role="list">
          {regionNodes.map((node) => (
            <div key={node.id} role="listitem">
              <SemanticNode node={node} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PolitySemanticScene({ visual }: { visual: GuruVisualSchema }) {
  const nodes = visual.nodes ?? [];
  const actors = nodes.filter((node) => (node.kind ?? "process") === "actor");
  const institutions = nodes.filter((node) => (node.kind ?? "process") === "institution");
  const outputs = nodes.filter((node) => {
    const kind = node.kind ?? "process";
    return kind === "output" || kind === "outcome" || kind === "process";
  });

  return (
    <div className="guru-semantic guru-semantic-polity">
      <div className="guru-semantic-column">
        <div className="guru-semantic-column-title">Actors</div>
        <div className="guru-semantic-stack" role="list">
          {actors.map((node) => (
            <div key={node.id} role="listitem">
              <SemanticNode node={node} />
            </div>
          ))}
        </div>
      </div>

      <div className="guru-semantic-route" aria-hidden="true">
        <span />
      </div>

      <div className="guru-semantic-column">
        <div className="guru-semantic-column-title">Institutions</div>
        <div className="guru-semantic-stack" role="list">
          {institutions.map((node) => (
            <div key={node.id} role="listitem">
              <SemanticNode node={node} />
            </div>
          ))}
        </div>
      </div>

      <div className="guru-semantic-route" aria-hidden="true">
        <span />
      </div>

      <div className="guru-semantic-column">
        <div className="guru-semantic-column-title">Outputs</div>
        <div className="guru-semantic-stack" role="list">
          {outputs.map((node) => (
            <div key={node.id} role="listitem">
              <SemanticNode node={node} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HistorySemanticScene({ visual }: { visual: GuruVisualSchema }) {
  const nodes = visual.nodes ?? [];

  return (
    <div className="guru-semantic guru-semantic-history">
      <div className="guru-semantic-history-line" role="list">
        {nodes.map((node, index) => (
          <div key={node.id} className="guru-semantic-history-item" role="listitem">
            <SemanticNode node={node} />
            {index < nodes.length - 1 ? (
              <div className="guru-semantic-link guru-semantic-link-horizontal" aria-hidden="true">
                <span />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SocietySemanticScene({ visual }: { visual: GuruVisualSchema }) {
  const nodes = visual.nodes ?? [];
  const actors = nodes.filter((node) => ["actor", "region", "institution"].includes(node.kind ?? "process"));
  const pressures = nodes.filter((node) => (node.kind ?? "process") === "pressure");
  const outcomes = nodes.filter((node) => ["output", "outcome", "process"].includes(node.kind ?? "process"));

  return (
    <div className="guru-semantic guru-semantic-triad">
      <SemanticColumn title="Social actors" nodes={actors} />
      <SemanticDivider />
      <SemanticColumn title="Drivers" nodes={pressures} />
      <SemanticDivider />
      <SemanticColumn title="Effects" nodes={outcomes} />
    </div>
  );
}

function EnvironmentSemanticScene({ visual }: { visual: GuruVisualSchema }) {
  const nodes = visual.nodes ?? [];
  const drivers = nodes.filter((node) => ["input", "pressure", "process"].includes(node.kind ?? "process"));
  const zones = nodes.filter((node) => (node.kind ?? "process") === "region");
  const outcomes = nodes.filter((node) => ["outcome", "output"].includes(node.kind ?? "process"));

  return (
    <div className="guru-semantic guru-semantic-environment">
      <div className="guru-semantic-process-column">
        <div className="guru-semantic-column-title">Drivers</div>
        <div className="guru-semantic-stack" role="list">
          {drivers.map((node) => (
            <div key={node.id} role="listitem">
              <SemanticNode node={node} />
            </div>
          ))}
        </div>
      </div>
      <div className="guru-semantic-route" aria-hidden="true">
        <span />
      </div>
      <div className="guru-semantic-column">
        <div className="guru-semantic-column-title">Zones</div>
        <div className="guru-semantic-stack" role="list">
          {zones.map((node) => (
            <div key={node.id} role="listitem">
              <SemanticNode node={node} />
            </div>
          ))}
        </div>
      </div>
      <div className="guru-semantic-route" aria-hidden="true">
        <span />
      </div>
      <div className="guru-semantic-column">
        <div className="guru-semantic-column-title">Outcomes</div>
        <div className="guru-semantic-stack" role="list">
          {outcomes.map((node) => (
            <div key={node.id} role="listitem">
              <SemanticNode node={node} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EthicsSemanticScene({ visual }: { visual: GuruVisualSchema }) {
  const nodes = visual.nodes ?? [];

  return (
    <div className="guru-semantic guru-semantic-ethics" role="list">
      {nodes.map((node, index) => (
        <div key={node.id} className="guru-semantic-process-item" role="listitem">
          <SemanticNode node={node} />
          {index < nodes.length - 1 ? (
            <div className="guru-semantic-link guru-semantic-link-vertical" aria-hidden="true">
              <span />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SemanticColumn({ title, nodes }: { title: string; nodes: GuruVisualNode[] }) {
  return (
    <div className="guru-semantic-column">
      <div className="guru-semantic-column-title">{title}</div>
      <div className="guru-semantic-stack" role="list">
        {nodes.map((node) => (
          <div key={node.id} role="listitem">
            <SemanticNode node={node} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SemanticDivider() {
  return (
    <div className="guru-semantic-route" aria-hidden="true">
      <span />
    </div>
  );
}

function SceneNode({
  step,
  index,
  themeMeta,
  className = "",
}: {
  step: EnrichedGuruVisualStep;
  index: number;
  themeMeta: ReturnType<typeof getThemeMeta>;
  className?: string;
}) {
  return (
    <article
      className={`guru-scene-node ${step.spanClass} accent-${step.accent}${className ? ` ${className}` : ""}`}
      style={buildNodeStyle(index, step.accent)}
      role="listitem"
    >
      <div className="guru-scene-node-top">
        <div className="guru-scene-node-index">{index + 1}</div>
        <div className="guru-scene-node-cue">{step.cue}</div>
      </div>

      <div className="guru-scene-node-title">{step.title}</div>

      {step.split.effect ? (
        <div className="guru-scene-node-panels">
          <div className="guru-scene-panel">
            <div className="guru-scene-panel-label">{themeMeta.causeLabel}</div>
            <p className="guru-scene-panel-text">{step.split.cause}</p>
          </div>

          <div className="guru-scene-panel-connector" aria-hidden="true">
            <span />
          </div>

          <div className="guru-scene-panel">
            <div className="guru-scene-panel-label">{themeMeta.effectLabel}</div>
            <p className="guru-scene-panel-text">{step.split.effect}</p>
          </div>
        </div>
      ) : (
        <p className="guru-scene-node-text">{step.detail}</p>
      )}
    </article>
  );
}

function GenericScene({
  steps,
  themeMeta,
}: {
  steps: EnrichedGuruVisualStep[];
  themeMeta: ReturnType<typeof getThemeMeta>;
}) {
  return (
    <div className="guru-scene-grid" role="list">
      {steps.map((step, index) => (
        <SceneNode key={`${step.title}-${index}`} step={step} index={index} themeMeta={themeMeta} />
      ))}
    </div>
  );
}

function EconomyScene({
  steps,
  themeMeta,
}: {
  steps: EnrichedGuruVisualStep[];
  themeMeta: ReturnType<typeof getThemeMeta>;
}) {
  return (
    <div className="guru-scene-economy" role="list">
      {steps.map((step, index) => (
        <div key={`${step.title}-${index}`} className="guru-scene-economy-item">
          <SceneNode step={step} index={index} themeMeta={themeMeta} className="span-12 is-horizontal" />
          {index < steps.length - 1 ? (
            <div className="guru-scene-connector guru-scene-connector-vertical guru-scene-connector-economy-vertical" style={buildConnectorStyle(index)} aria-hidden="true">
              <span />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function GeographyScene({
  steps,
  themeMeta,
}: {
  steps: EnrichedGuruVisualStep[];
  themeMeta: ReturnType<typeof getThemeMeta>;
}) {
  const [hero, ...rest] = steps;

  return (
    <div className="guru-scene-geography">
      {hero ? (
        <div className="guru-scene-geography-hero">
          <SceneNode step={hero} index={0} themeMeta={themeMeta} className="span-12 is-hero" />
        </div>
      ) : null}

      {rest.length ? (
        <div className="guru-scene-geography-grid" role="list">
          {rest.map((step, index) => (
            <SceneNode key={`${step.title}-${index + 1}`} step={step} index={index + 1} themeMeta={themeMeta} className="span-4" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GeopoliticsScene({
  steps,
  themeMeta,
}: {
  steps: EnrichedGuruVisualStep[];
  themeMeta: ReturnType<typeof getThemeMeta>;
}) {
  return (
    <div className="guru-scene-geopolitics" role="list">
      {steps.map((step, index) => (
        <div key={`${step.title}-${index}`} className="guru-scene-geopolitics-row">
          <SceneNode
            step={step}
            index={index}
            themeMeta={themeMeta}
            className={`span-12 ${index % 2 === 0 ? "is-left-lean" : "is-right-lean"}`}
          />
          {index < steps.length - 1 ? (
            <div className="guru-scene-connector guru-scene-connector-vertical" style={buildConnectorStyle(index)} aria-hidden="true">
              <span />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PolityScene({
  steps,
  themeMeta,
}: {
  steps: EnrichedGuruVisualStep[];
  themeMeta: ReturnType<typeof getThemeMeta>;
}) {
  return (
    <div className="guru-scene-polity" role="list">
      {steps.map((step, index) => (
        <div key={`${step.title}-${index}`} className="guru-scene-polity-step">
          <div className="guru-scene-polity-rail" aria-hidden="true">
            <span />
          </div>
          <SceneNode step={step} index={index} themeMeta={themeMeta} className="span-12 is-process" />
        </div>
      ))}
    </div>
  );
}

function ScienceScene({
  steps,
  themeMeta,
}: {
  steps: EnrichedGuruVisualStep[];
  themeMeta: ReturnType<typeof getThemeMeta>;
}) {
  return (
    <div className="guru-scene-science" role="list">
      {steps.map((step, index) => (
        <div key={`${step.title}-${index}`} className="guru-scene-science-item">
          <SceneNode step={step} index={index} themeMeta={themeMeta} className={`${index === 0 ? "span-8 is-hero" : "span-6"} is-science`} />
          {index < steps.length - 1 ? (
            <div className="guru-scene-connector guru-scene-connector-diagonal" style={buildConnectorStyle(index)} aria-hidden="true">
              <span />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function HistoryScene({
  steps,
  themeMeta,
}: {
  steps: EnrichedGuruVisualStep[];
  themeMeta: ReturnType<typeof getThemeMeta>;
}) {
  return (
    <div className="guru-scene-history" role="list">
      {steps.map((step, index) => (
        <div key={`${step.title}-${index}`} className="guru-scene-history-item">
          <SceneNode step={step} index={index} themeMeta={themeMeta} className="span-12 is-process" />
          {index < steps.length - 1 ? (
            <div className="guru-scene-connector guru-scene-connector-economy-vertical" style={buildConnectorStyle(index)} aria-hidden="true">
              <span />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SocietyScene({
  steps,
  themeMeta,
}: {
  steps: EnrichedGuruVisualStep[];
  themeMeta: ReturnType<typeof getThemeMeta>;
}) {
  return (
    <div className="guru-scene-grid" role="list">
      {steps.map((step, index) => (
        <SceneNode key={`${step.title}-${index}`} step={step} index={index} themeMeta={themeMeta} className="span-6" />
      ))}
    </div>
  );
}

function EnvironmentScene({
  steps,
  themeMeta,
}: {
  steps: EnrichedGuruVisualStep[];
  themeMeta: ReturnType<typeof getThemeMeta>;
}) {
  return (
    <div className="guru-scene-geography">
      <div className="guru-scene-geography-grid" role="list">
        {steps.map((step, index) => (
          <SceneNode key={`${step.title}-${index}`} step={step} index={index} themeMeta={themeMeta} className="span-6" />
        ))}
      </div>
    </div>
  );
}

function EthicsScene({
  steps,
  themeMeta,
}: {
  steps: EnrichedGuruVisualStep[];
  themeMeta: ReturnType<typeof getThemeMeta>;
}) {
  return (
    <div className="guru-scene-polity" role="list">
      {steps.map((step, index) => (
        <div key={`${step.title}-${index}`} className="guru-scene-polity-step">
          <div className="guru-scene-polity-rail" aria-hidden="true">
            <span />
          </div>
          <SceneNode step={step} index={index} themeMeta={themeMeta} className="span-12 is-process" />
        </div>
      ))}
    </div>
  );
}
