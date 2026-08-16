import curriculum from "@/data/curriculum-2026.json";
import { curriculumSupplement2026, type SupplementSubject } from "@/data/curriculum-supplement-2026";

export type CurriculumTopic = {
  sourceId: string;
  number: string;
  title: string;
};

export type CurriculumChapter = {
  sourceId: string;
  number: number;
  title: string;
  topics: CurriculumTopic[];
};

export type CurriculumPart = {
  sourceId: string;
  number: number;
  title: string;
  chapters: CurriculumChapter[];
};

export type CurriculumSubject = {
  sourceId: string;
  title: string;
  paper: string;
  declaredCounts: { parts: number; chapters: number; topics: number };
  parts: CurriculumPart[];
};

export type DesiredCurriculumNode = {
  key: string;
  title: string;
  curriculumTitle: string;
  slug: string;
  type: "PAPER" | "SUBJECT" | "MODULE";
  nodeKind: "PAPER" | "SUBJECT" | "PAPER_SECTION" | "PART" | "CHAPTER" | "TOPIC";
  parentKey: string | null;
  sortOrder: number;
  overview?: string | null;
  preferredSlugs?: string[];
  aliases?: string[];
};

type PaperDescriptor = {
  key: string;
  title: string;
  slug: string;
  overview: string;
};

const VERSION = curriculum.version;

const papers: Record<"gs1" | "gs2" | "gs3" | "gs4" | "csat" | "psir" | "essay", PaperDescriptor> = {
  gs1: {
    key: "cse:paper:gs1",
    title: "General Studies 1",
    slug: "general-studies-1",
    overview: "Indian heritage, history, geography and society.",
  },
  gs2: {
    key: "cse:paper:gs2",
    title: "General Studies 2",
    slug: "general-studies-2",
    overview: "Governance, Constitution, polity, social justice and international relations.",
  },
  gs3: {
    key: "cse:paper:gs3",
    title: "General Studies 3",
    slug: "general-studies-3",
    overview: "Economy, technology, environment, security and disaster management.",
  },
  gs4: {
    key: "cse:paper:gs4",
    title: "General Studies 4",
    slug: "general-studies-4",
    overview: "Ethics, integrity and aptitude.",
  },
  csat: {
    key: "cse:paper:csat",
    title: "CSAT",
    slug: "csat",
    overview: "Prelims General Studies Paper II - qualifying aptitude paper.",
  },
  psir: {
    key: "cse:paper:psir",
    title: "PSIR",
    slug: "psir",
    overview: "Political Science and International Relations Optional - Papers I and II.",
  },
  essay: {
    key: "cse:paper:essay",
    title: "Essay",
    slug: "essay",
    overview: "Essay method, theme mastery, enrichment, practice and evaluation.",
  },
};

const subjectPlacement: Record<string, { paper: keyof typeof papers; slug: string; title?: string }> = {
  modern_history: { paper: "gs1", slug: "modern-history" },
  medieval_history: { paper: "gs1", slug: "medieval-history" },
  art_culture: { paper: "gs1", slug: "art-culture" },
  indian_society: { paper: "gs1", slug: "indian-society" },
  social_justice: { paper: "gs2", slug: "social-justice" },
  governance: { paper: "gs2", slug: "governance" },
  international_relations: { paper: "gs2", slug: "international-relations" },
  disaster_management: { paper: "gs3", slug: "disaster-management" },
  internal_security: { paper: "gs3", slug: "internal-security" },
  environment_ecology: { paper: "gs3", slug: "environment", title: "Environment and Ecology" },
  science_technology: { paper: "gs3", slug: "science-technology" },
  indian_economy: { paper: "gs3", slug: "indian-economy" },
  gs4_ethics: { paper: "gs4", slug: "ethics", title: "Ethics, Integrity and Aptitude" },
};

const csatPartSlugs: Record<number, string[]> = {
  1: ["quantitative-aptitude"],
  2: ["data-interpretation-data-sufficiency"],
  3: ["logical-reasoning"],
  4: ["reading-comprehension"],
};

const psirSectionSlugs: Record<number, string[]> = {
  1: ["political-theories-and-ideologies"],
  2: ["indian-politics"],
  3: ["comparative-politics-analysis"],
  4: ["indian-foreign-policy"],
};

function sourceKey(sourceId: string) {
  return `cse:${sourceId}`;
}

function addPaper(target: DesiredCurriculumNode[], descriptor: PaperDescriptor) {
  if (target.some((node) => node.key === descriptor.key)) return;
  target.push({
    key: descriptor.key,
    title: descriptor.title,
    curriculumTitle: descriptor.title,
    slug: descriptor.slug,
    type: "PAPER",
    nodeKind: "PAPER",
    parentKey: null,
    sortOrder: ["gs1", "gs2", "gs3", "gs4", "psir", "csat", "essay"].findIndex((key) => papers[key as keyof typeof papers].key === descriptor.key),
    overview: descriptor.overview,
    preferredSlugs: [descriptor.slug],
  });
}

function addChapterTree(
  target: DesiredCurriculumNode[],
  subject: CurriculumSubject,
  part: CurriculumPart,
  parentKey: string,
  slugPrefix: string,
) {
  for (const chapter of part.chapters) {
    const chapterKey = sourceKey(chapter.sourceId);
    target.push({
      key: chapterKey,
      title: chapter.title,
      curriculumTitle: chapter.title,
      slug: `${slugPrefix}-chapter-${chapter.number}`,
      type: "MODULE",
      nodeKind: "CHAPTER",
      parentKey,
      sortOrder: chapter.number,
    });

    for (const [topicIndex, topic] of chapter.topics.entries()) {
      target.push({
        key: sourceKey(topic.sourceId),
        title: topic.title,
        curriculumTitle: topic.title,
        slug: `${slugPrefix}-topic-${topic.number.replaceAll(".", "-")}`,
        type: "MODULE",
        nodeKind: "TOPIC",
        parentKey: chapterKey,
        sortOrder: topicIndex + 1,
      });
    }
  }
}

function addStandardSubject(target: DesiredCurriculumNode[], subject: CurriculumSubject) {
  const placement = subjectPlacement[subject.sourceId];
  if (!placement) throw new Error(`No placement configured for ${subject.sourceId}`);
  const paper = papers[placement.paper];
  addPaper(target, paper);

  const subjectKey = sourceKey(`subject:${subject.sourceId}`);
  const subjectTitle = placement.title ?? subject.title;
  target.push({
    key: subjectKey,
    title: subjectTitle,
    curriculumTitle: subject.title,
    slug: placement.slug,
    type: "SUBJECT",
    nodeKind: "SUBJECT",
    parentKey: paper.key,
    sortOrder: target.filter((node) => node.parentKey === paper.key).length,
    preferredSlugs: [placement.slug],
  });

  for (const part of subject.parts) {
    const partKey = sourceKey(part.sourceId);
    target.push({
      key: partKey,
      title: part.title,
      curriculumTitle: part.title,
      slug: `${placement.slug}-part-${part.number}`,
      type: "MODULE",
      nodeKind: "PART",
      parentKey: subjectKey,
      sortOrder: part.number,
    });
    addChapterTree(target, subject, part, partKey, placement.slug);
  }
}

function addCsat(target: DesiredCurriculumNode[], subject: CurriculumSubject) {
  const paper = papers.csat;
  addPaper(target, paper);
  for (const part of subject.parts) {
    const partKey = sourceKey(part.sourceId);
    const preferredSlugs = csatPartSlugs[part.number] ?? [];
    const slug = preferredSlugs[0] ?? `csat-section-${part.number}`;
    target.push({
      key: partKey,
      title: part.title,
      curriculumTitle: part.title,
      slug,
      type: "SUBJECT",
      nodeKind: "PAPER_SECTION",
      parentKey: paper.key,
      sortOrder: part.number,
      preferredSlugs,
      aliases: part.number === 3 ? ["Logical Reasoning"] : undefined,
    });
    addChapterTree(target, subject, part, partKey, `csat-${part.number}`);
  }
}

function romanPaper(number: 1 | 2) {
  return number === 1 ? "Paper I" : "Paper II";
}

function psirSectionTitle(part: CurriculumPart) {
  return part.title.replace(/^Paper [12] Section ([AB]) - /, "Section $1 · ");
}

function addPsir(target: DesiredCurriculumNode[], subject: CurriculumSubject) {
  const paper = papers.psir;
  addPaper(target, paper);

  for (const paperNumber of [1, 2] as const) {
    const paperKey = `cse:psir:paper:${paperNumber}`;
    target.push({
      key: paperKey,
      title: romanPaper(paperNumber),
      curriculumTitle: `PSIR Optional ${romanPaper(paperNumber)}`,
      slug: `psir-paper-${paperNumber}`,
      type: "SUBJECT",
      nodeKind: "SUBJECT",
      parentKey: paper.key,
      sortOrder: paperNumber,
      overview: paperNumber === 1
        ? "Political theory, Indian political thought, government and politics."
        : "Comparative politics, international relations and India and the world.",
    });
  }

  for (const part of subject.parts) {
    const paperNumber = part.number <= 2 ? 1 : 2;
    const partKey = sourceKey(part.sourceId);
    target.push({
      key: partKey,
      title: psirSectionTitle(part),
      curriculumTitle: part.title,
      slug: `psir-paper-${paperNumber}-section-${part.number % 2 === 1 ? "a" : "b"}`,
      type: "MODULE",
      nodeKind: "PAPER_SECTION",
      parentKey: `cse:psir:paper:${paperNumber}`,
      sortOrder: part.number % 2 === 1 ? 1 : 2,
      preferredSlugs: psirSectionSlugs[part.number],
    });
    addChapterTree(target, subject, part, partKey, "psir");
  }
}

function addSupplementSubject(target: DesiredCurriculumNode[], subject: SupplementSubject) {
  const paper = papers[subject.paper];
  addPaper(target, paper);
  const subjectKey = `cse:supplement:${subject.sourceId}:subject`;
  target.push({
    key: subjectKey,
    title: subject.title,
    curriculumTitle: subject.title,
    slug: subject.slug,
    type: "SUBJECT",
    nodeKind: "SUBJECT",
    parentKey: paper.key,
    sortOrder: target.filter((node) => node.parentKey === paper.key).length,
    overview: subject.overview,
    preferredSlugs: [subject.slug],
  });

  for (const [sectionIndex, section] of subject.sections.entries()) {
    const sectionNumber = sectionIndex + 1;
    const sectionKey = `cse:supplement:${subject.sourceId}:section:${sectionNumber}`;
    target.push({
      key: sectionKey,
      title: section.title,
      curriculumTitle: section.title,
      slug: `${subject.slug}-section-${sectionNumber}`,
      type: "MODULE",
      nodeKind: "PART",
      parentKey: subjectKey,
      sortOrder: sectionNumber,
    });

    for (const [chapterIndex, chapter] of section.chapters.entries()) {
      const chapterNumber = chapterIndex + 1;
      const chapterKey = `${sectionKey}:chapter:${chapterNumber}`;
      target.push({
        key: chapterKey,
        title: chapter.title,
        curriculumTitle: chapter.title,
        slug: `${subject.slug}-s${sectionNumber}-chapter-${chapterNumber}`,
        type: "MODULE",
        nodeKind: "CHAPTER",
        parentKey: sectionKey,
        sortOrder: chapterNumber,
      });
      for (const [topicIndex, topic] of chapter.topics.entries()) {
        target.push({
          key: `${chapterKey}:topic:${topicIndex + 1}`,
          title: topic,
          curriculumTitle: topic,
          slug: `${subject.slug}-s${sectionNumber}-c${chapterNumber}-topic-${topicIndex + 1}`,
          type: "MODULE",
          nodeKind: "TOPIC",
          parentKey: chapterKey,
          sortOrder: topicIndex + 1,
        });
      }
    }
  }
}

export function buildDesiredCurriculum() {
  const target: DesiredCurriculumNode[] = [];
  const manifest = curriculum as { version: string; subjects: CurriculumSubject[] };

  for (const subject of manifest.subjects) {
    if (subject.sourceId === "csat") addCsat(target, subject);
    else if (subject.sourceId === "psir_optional") addPsir(target, subject);
    else addStandardSubject(target, subject);
  }

  for (const subject of curriculumSupplement2026) addSupplementSubject(target, subject);

  const seenKeys = new Set<string>();
  const seenSlugs = new Set<string>();
  for (const node of target) {
    if (seenKeys.has(node.key)) throw new Error(`Duplicate desired curriculum key: ${node.key}`);
    if (seenSlugs.has(node.slug)) throw new Error(`Duplicate desired curriculum slug: ${node.slug}`);
    seenKeys.add(node.key);
    seenSlugs.add(node.slug);
    if (node.parentKey && !seenKeys.has(node.parentKey)) {
      throw new Error(`Parent ${node.parentKey} must appear before child ${node.key}`);
    }
  }

  return { version: VERSION, nodes: target };
}
