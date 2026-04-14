export type SyllabusNode = {
  title: string;
  slug: string;
  type: "paper" | "subject" | "module";
  overview: string;
  details?: string;
  accent?: string;
  children?: SyllabusNode[];
};

const details = {
  geography:
    "Physical geography, Indian geography, economic geography, human geography, world geography, map work and geophysical phenomena.",
  polity:
    "Historical background, salient features, rights, duties, Parliament, judiciary, federalism, local government, constitutional bodies, elections, governance and representation.",
  economy:
    "National income, inflation, banking, growth, budgeting, taxation, RBI, external sector, agriculture, industry, infrastructure and inclusive development.",
  modernHistory:
    "British expansion, 1857, reforms, rise of nationalism, Gandhian movements, partition, independence and post-independence consolidation.",
  environment:
    "Ecology, biodiversity, conservation, climate change, pollution, EIA, environmental law, conventions and sustainable development.",
  science:
    "Digital systems, AI, cybersecurity, semiconductors, space, biotech, robotics, nanotechnology, energy, IPR and innovation.",
  ethics:
    "Ethics and human interface, values, attitude, aptitude, emotional intelligence, thinkers, probity and case study frameworks.",
  ancient:
    "Sources, Indus Valley, Vedic age, Mahajanapadas, Buddhism, Jainism, Maurya, post-Maurya, Gupta and ancient culture.",
  medieval:
    "Early medieval states, Cholas, Vijayanagara, Delhi Sultanate, Mughals, Bhakti-Sufi movements, Marathas and cultural synthesis.",
  artCulture:
    "Architecture, sculpture, iconography, painting, performing arts, literature, heritage and conservation.",
  csat:
    "Comprehension, interpersonal communication, logical reasoning, analytical ability, decision-making, numeracy and data interpretation.",
  essay:
    "Essay theme domains, structure, brainstorming, enrichment material, self-evaluation and weekly practice.",
  psir:
    "Political theory, ideologies, Indian politics, comparative politics, IR theories, organizations and India’s foreign policy.",
  society:
    "Diversity, caste, class, tribe, gender, population, poverty, urbanization, globalization and identity issues.",
  socialJustice:
    "Vulnerable sections, schemes, health, education, hunger, institutions, delivery gaps and reform ideas.",
  internalSecurity:
    "Extremism, insurgency, terrorism, border management, cyber security, social media, organized crime and security architecture.",
  disaster:
    "Hazards, vulnerability, disaster cycle, India-specific risks, NDMA framework, preparedness, response, recovery and resilience.",
};

export const syllabusTree: SyllabusNode[] = [
  {
    title: "General Studies 1",
    slug: "general-studies-1",
    type: "paper",
    accent: "blue",
    overview: "History, geography, culture and society for GS Paper I.",
    children: [
      {
        title: "Geography",
        slug: "geography",
        type: "subject",
        accent: "blue",
        overview: "Physical, Indian, economic, human and world geography.",
        details: details.geography,
        children: [
          { title: "Physical Geography", slug: "physical-geography", type: "module", overview: "Earth, landforms, climate, oceans and soils." },
          { title: "Indian Geography", slug: "indian-geography", type: "module", overview: "Physiography, monsoon, drainage, resources and agriculture." },
          { title: "Economic Geography", slug: "economic-geography", type: "module", overview: "Resources, industries, logistics and regional development." },
          { title: "Human Geography", slug: "human-geography", type: "module", overview: "Population, migration, settlements and regional inequality." }
        ]
      },
      {
        title: "Modern History",
        slug: "modern-history",
        type: "subject",
        accent: "amber",
        overview: "Mid-18th century onward, freedom struggle and personalities.",
        details: details.modernHistory,
        children: [
          { title: "British Expansion", slug: "british-expansion", type: "module", overview: "Entry, conquest and administrative changes." },
          { title: "Resistance and 1857", slug: "resistance-and-1857", type: "module", overview: "Early uprisings and the Revolt of 1857." },
          { title: "Rise of Nationalism", slug: "rise-of-nationalism", type: "module", overview: "Moderates, extremists and reform movements." },
          { title: "Mass Movements", slug: "mass-movements", type: "module", overview: "Gandhian movements, partition and transfer of power." }
        ]
      },
      {
        title: "Ancient History",
        slug: "ancient-history",
        type: "subject",
        accent: "rose",
        overview: "Ancient India through sources, state formation and culture.",
        details: details.ancient,
        children: [
          { title: "Sources and Civilization", slug: "sources-and-civilization", type: "module", overview: "Sources, prehistory and Indus Valley Civilization." },
          { title: "Vedic Age", slug: "vedic-age", type: "module", overview: "Early and later Vedic society, polity and religion." },
          { title: "Maurya to Gupta", slug: "maurya-to-gupta", type: "module", overview: "Mauryan administration, trade and Gupta culture." },
          { title: "Religion and Philosophy", slug: "religion-and-philosophy", type: "module", overview: "Buddhism, Jainism and philosophical schools." }
        ]
      },
      {
        title: "Medieval History",
        slug: "medieval-history",
        type: "subject",
        accent: "orange",
        overview: "Regional states, Sultanate, Mughal and cultural synthesis.",
        details: details.medieval,
        children: [
          { title: "Early Medieval States", slug: "early-medieval-states", type: "module", overview: "Regional powers and social change." },
          { title: "Delhi Sultanate", slug: "delhi-sultanate", type: "module", overview: "Dynasties, iqta, economy and culture." },
          { title: "Mughal Empire", slug: "mughal-empire", type: "module", overview: "Administration, economy and culture." },
          { title: "Bhakti and Sufi", slug: "bhakti-and-sufi", type: "module", overview: "Religious movements and social impact." }
        ]
      },
      {
        title: "Art and Culture",
        slug: "art-culture",
        type: "subject",
        accent: "violet",
        overview: "Indian art forms, architecture, literature and heritage.",
        details: details.artCulture,
        children: [
          { title: "Architecture", slug: "architecture", type: "module", overview: "Temple, Buddhist, Jain, Indo-Islamic and colonial architecture." },
          { title: "Painting and Sculpture", slug: "painting-and-sculpture", type: "module", overview: "Murals, miniatures, folk painting and sculpture." },
          { title: "Performing Arts", slug: "performing-arts", type: "module", overview: "Dance, music, theatre and puppetry." },
          { title: "Heritage", slug: "heritage", type: "module", overview: "Conservation, UNESCO and cultural institutions." }
        ]
      },
      {
        title: "Indian Society",
        slug: "indian-society",
        type: "subject",
        accent: "emerald",
        overview: "Diversity, social structure, gender and globalization.",
        details: details.society,
        children: [
          { title: "Social Structure", slug: "social-structure", type: "module", overview: "Caste, class, tribe and inequality." },
          { title: "Family and Gender", slug: "family-and-gender", type: "module", overview: "Family, marriage, patriarchy and women’s issues." },
          { title: "Population and Urbanization", slug: "population-and-urbanization", type: "module", overview: "Population, migration, poverty and urban change." },
          { title: "Identity and Integration", slug: "identity-and-integration", type: "module", overview: "Communalism, regionalism and secularism." }
        ]
      }
    ]
  },
  {
    title: "General Studies 2",
    slug: "general-studies-2",
    type: "paper",
    accent: "teal",
    overview: "Polity, governance, social justice and IR for GS Paper II.",
    children: [
      {
        title: "Indian Polity",
        slug: "indian-polity",
        type: "subject",
        accent: "cyan",
        overview: "Constitution, institutions, rights, federalism and representation.",
        details: details.polity,
        children: [
          { title: "Constitution Foundations", slug: "constitution-foundations", type: "module", overview: "Historical background, salient features and preamble." },
          { title: "Rights and Duties", slug: "rights-and-duties", type: "module", overview: "FR, DPSP, FD, amendments and doctrines." },
          { title: "Union and State", slug: "union-and-state", type: "module", overview: "Executive, legislature, judiciary and federal relations." },
          { title: "Bodies and Governance", slug: "bodies-and-governance", type: "module", overview: "Constitutional bodies, elections and governance." }
        ]
      },
      {
        title: "Governance",
        slug: "governance",
        type: "subject",
        accent: "blue",
        overview: "Transparency, accountability, public policy and delivery.",
        details: "Citizen charter, RTI, e-governance, SHGs, NGOs, grievance redress and public service delivery.",
        children: [
          { title: "Transparency", slug: "governance-transparency", type: "module", overview: "RTI, social audits, accountability and ethics in delivery." },
          { title: "Public Policy", slug: "governance-policy", type: "module", overview: "Policy design, implementation gaps and reform." }
        ]
      },
      {
        title: "International Relations",
        slug: "international-relations",
        type: "subject",
        accent: "violet",
        overview: "India’s diplomacy, institutions, neighbourhood and major powers.",
        details: "Neighbourhood, Indo-Pacific, global governance, major powers, regional groupings and strategic autonomy.",
        children: [
          { title: "Neighbourhood", slug: "neighbourhood", type: "module", overview: "Pakistan, China, Nepal, Bhutan, Bangladesh, Sri Lanka and Maldives." },
          { title: "Global Platforms", slug: "global-platforms", type: "module", overview: "UN, WTO, BRICS, G20, QUAD and BIMSTEC." }
        ]
      },
      {
        title: "Social Justice",
        slug: "social-justice",
        type: "subject",
        accent: "pink",
        overview: "Schemes, rights, inclusion and vulnerable sections.",
        details: details.socialJustice,
        children: [
          { title: "Vulnerable Sections", slug: "vulnerable-sections", type: "module", overview: "SC, ST, OBC, women, children, elderly and disabled groups." },
          { title: "Social Sector", slug: "social-sector", type: "module", overview: "Health, education, hunger, nutrition and social infrastructure." },
          { title: "Institutions and Delivery", slug: "institutions-and-delivery", type: "module", overview: "Schemes, laws, bodies and last-mile reform." }
        ]
      }
    ]
  },
  {
    title: "General Studies 3",
    slug: "general-studies-3",
    type: "paper",
    accent: "emerald",
    overview: "Economy, science, environment, security and resilience for GS III.",
    children: [
      {
        title: "Indian Economy",
        slug: "indian-economy",
        type: "subject",
        accent: "green",
        overview: "Macro basics, fiscal and monetary systems, external sector and growth.",
        details: details.economy,
        children: [
          { title: "Macro Basics", slug: "macro-basics", type: "module", overview: "GDP, inflation, money, banking and growth." },
          { title: "Fiscal and Monetary", slug: "fiscal-and-monetary", type: "module", overview: "Budgeting, taxation, RBI and markets." },
          { title: "Agriculture and Industry", slug: "agriculture-and-industry", type: "module", overview: "Agriculture, food economy, infrastructure and investment." },
          { title: "External Sector", slug: "external-sector", type: "module", overview: "BoP, forex, trade and capital flows." }
        ]
      },
      {
        title: "Science and Technology",
        slug: "science-technology",
        type: "subject",
        accent: "cyan",
        overview: "Applied science, tech governance and innovation.",
        details: details.science,
        children: [
          { title: "Digital Tech", slug: "digital-tech", type: "module", overview: "Computing, AI, semiconductors and cyber." },
          { title: "Space and Biotech", slug: "space-and-biotech", type: "module", overview: "ISRO, space applications, genetics and biotech." },
          { title: "Advanced Manufacturing", slug: "advanced-manufacturing", type: "module", overview: "Robotics, drones, nano-tech and automation." },
          { title: "Energy and IPR", slug: "energy-and-ipr", type: "module", overview: "Energy tech, nuclear tech and intellectual property." }
        ]
      },
      {
        title: "Disaster Management",
        slug: "disaster-management",
        type: "subject",
        accent: "amber",
        overview: "Preparedness, mitigation, recovery and resilience.",
        details: details.disaster,
        children: [
          { title: "Disaster Basics", slug: "disaster-basics", type: "module", overview: "Hazard, vulnerability, risk and disaster cycle." },
          { title: "India Vulnerability", slug: "india-vulnerability", type: "module", overview: "Floods, cyclones, heatwaves, mountains and urban risk." },
          { title: "Institutional Framework", slug: "institutional-framework", type: "module", overview: "NDMA, NDRF, DM Act and Sendai." },
          { title: "Recovery and Resilience", slug: "recovery-and-resilience", type: "module", overview: "Preparedness, response, recovery and technology." }
        ]
      },
      {
        title: "Internal Security",
        slug: "internal-security",
        type: "subject",
        accent: "red",
        overview: "Extremism, border challenges, cyber security and agencies.",
        details: details.internalSecurity,
        children: [
          { title: "Extremism and Terror", slug: "extremism-and-terror", type: "module", overview: "LWE, insurgency, terrorism and radicalization." },
          { title: "Border and Coastal Security", slug: "border-and-coastal-security", type: "module", overview: "Borders, surveillance and coastal security." },
          { title: "Cyber and Media", slug: "cyber-and-media", type: "module", overview: "Cyber security, misinformation and networks." },
          { title: "Agencies and Reform", slug: "agencies-and-reform", type: "module", overview: "Security forces, policing and reform." }
        ]
      },
      {
        title: "Environment",
        slug: "environment",
        type: "subject",
        accent: "lime",
        overview: "Ecology, biodiversity, climate and environmental governance.",
        details: details.environment,
        children: [
          { title: "Ecology and Biodiversity", slug: "ecology-and-biodiversity", type: "module", overview: "Ecosystems, hotspots, species and conservation." },
          { title: "Climate and Pollution", slug: "climate-and-pollution", type: "module", overview: "Climate change and pollution control." },
          { title: "Law and Governance", slug: "law-and-governance", type: "module", overview: "EIA, institutions, laws and conventions." },
          { title: "Sustainable Development", slug: "sustainable-development", type: "module", overview: "Livelihoods, forests, agriculture and sustainability." }
        ]
      }
    ]
  },
  {
    title: "General Studies 4",
    slug: "general-studies-4",
    type: "paper",
    accent: "purple",
    overview: "Ethics, integrity and aptitude.",
    children: [
      {
        title: "Ethics, Integrity and Aptitude",
        slug: "ethics",
        type: "subject",
        accent: "purple",
        overview: "Values, probity, thinkers and case studies.",
        details: details.ethics,
        children: [
          { title: "Ethics Basics", slug: "ethics-basics", type: "module", overview: "Nature, scope, morality and public ethics." },
          { title: "Attitude and Aptitude", slug: "attitude-and-aptitude", type: "module", overview: "Attitude, EI, aptitude and civil service values." },
          { title: "Thinkers and Public Service", slug: "thinkers-and-public-service", type: "module", overview: "Thinkers, public service ethics and probity." },
          { title: "Case Study Practice", slug: "case-study-practice", type: "module", overview: "Stakeholders, options and reform-oriented solving." }
        ]
      }
    ]
  },
  {
    title: "PSIR",
    slug: "psir",
    type: "paper",
    accent: "violet",
    overview: "Political Science and International Relations optional.",
    details: details.psir,
    children: [
      { title: "International Relations", slug: "psir-international-relations", type: "subject", overview: "IR theories, organizations, India and the world." },
      { title: "Political Theories and Ideologies", slug: "political-theories-and-ideologies", type: "subject", overview: "Justice, equality, rights, democracy, power and ideologies." },
      { title: "Indian Politics", slug: "indian-politics", type: "subject", overview: "Constitution, party system, social movements and federalism." },
      { title: "Comparative Politics and Analysis", slug: "comparative-politics-analysis", type: "subject", overview: "Comparative method, globalization and the state." }
    ]
  },
  {
    title: "CSAT",
    slug: "csat",
    type: "paper",
    accent: "orange",
    overview: "Prelims GS Paper II with qualifying focus.",
    details: details.csat,
    children: [
      { title: "Logical Reasoning", slug: "logical-reasoning", type: "subject", overview: "Statements, syllogism, puzzles and decisions." },
      { title: "Reading Comprehension", slug: "reading-comprehension", type: "subject", overview: "Theme, tone, inference and elimination." },
      { title: "Quantitative Aptitude", slug: "quantitative-aptitude", type: "subject", overview: "Arithmetic, numeracy and DI." }
    ]
  },
  {
    title: "Essay",
    slug: "essay",
    type: "paper",
    accent: "amber",
    overview: "Essay preparation with theme clusters and structure.",
    details: details.essay
  },
  {
    title: "Current Affairs",
    slug: "current-affairs",
    type: "paper",
    accent: "slate",
    overview: "Dynamic issue tracker for your own current affairs notes.",
    details: "Add issues, editorial notes, revision tags, briefs and topic clusters as your live current affairs system."
  }
];
