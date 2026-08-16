export type SupplementChapter = { title: string; topics: string[] };
export type SupplementSection = { title: string; chapters: SupplementChapter[] };
export type SupplementSubject = {
  sourceId: string;
  title: string;
  slug: string;
  paper: "gs1" | "gs2" | "essay";
  overview: string;
  sections: SupplementSection[];
};

export const curriculumSupplement2026: SupplementSubject[] = [
  {
    sourceId: "world_history",
    title: "World History",
    slug: "world-history",
    paper: "gs1",
    overview: "Revolutions, industrialization, nationalism, imperialism, world wars, decolonization and the post-war order.",
    sections: [
      {
        title: "Intellectual Foundations and Atlantic Revolutions",
        chapters: [
          { title: "Renaissance, Reformation and Scientific Revolution", topics: ["Humanism and the Renaissance worldview", "Printing revolution and circulation of ideas", "Protestant Reformation and Counter-Reformation", "Scientific method and challenges to inherited authority", "Long-term political and social consequences"] },
          { title: "The Enlightenment", topics: ["Reason, natural law and progress", "Hobbes, Locke and the social contract", "Montesquieu and separation of powers", "Rousseau, popular sovereignty and general will", "Enlightenment influence and internal contradictions"] },
          { title: "American Revolution", topics: ["Colonial background and causes", "Declaration of Independence and natural rights", "War, diplomacy and the international setting", "Constitution, federalism and republican government", "Global influence and limits of the revolution"] },
          { title: "French Revolution", topics: ["Old Regime and structural causes", "Estates-General and constitutional phase", "Republic, Jacobins and the Reign of Terror", "Social transformation and revolutionary political culture", "European and global legacy"] },
          { title: "Napoleon and the European Settlement", topics: ["Napoleon's rise and administrative reforms", "Continental system and military expansion", "Nationalism under Napoleonic rule", "Congress of Vienna and balance of power", "Metternich system and conservative restoration"] },
        ],
      },
      {
        title: "Industrialization and New Social Orders",
        chapters: [
          { title: "Industrial Revolution in Britain", topics: ["Agrarian change, capital and labour supply", "Coal, iron, steam and technological innovation", "Factory system and organization of production", "Transport and communications revolution", "Why industrialization began in Britain"] },
          { title: "Spread and Phases of Industrialization", topics: ["Industrialization in continental Europe", "United States and the second industrial revolution", "Late industrializers and state-led development", "Electricity, chemicals, steel and mass production", "Uneven development in the world economy"] },
          { title: "Capitalism, Urbanization and Class", topics: ["Rise of industrial capitalism", "Urban growth, housing and public health", "Formation of working and middle classes", "Women and children in industrial labour", "Social reform and welfare responses"] },
          { title: "Socialism and the Labour Movement", topics: ["Utopian socialism", "Marx and historical materialism", "Class struggle, surplus value and revolution", "Trade unions and socialist parties", "Revisionism, social democracy and welfare politics"] },
        ],
      },
      {
        title: "Nationalism and Nation-State Formation",
        chapters: [
          { title: "Nationalism in Nineteenth-Century Europe", topics: ["Cultural and political nationalism", "Liberalism and nationalism after 1815", "Revolutions of 1830 and 1848", "Romanticism, language and national identity", "Nationalism's inclusive and exclusionary forms"] },
          { title: "Italian Unification", topics: ["Fragmented Italy and foreign domination", "Mazzini and republican nationalism", "Cavour, Piedmont and diplomacy", "Garibaldi and popular mobilization", "Rome, consolidation and limits of unification"] },
          { title: "German Unification", topics: ["German Confederation and Zollverein", "Prussia and Bismarck's statecraft", "Wars of unification", "German Empire and balance of power", "Consequences for European politics"] },
          { title: "Nationalism Beyond Western Europe", topics: ["Eastern Question and Balkan nationalism", "Decline of multinational empires", "Pan-Slavism and competing national claims", "Nationalism in Latin America", "Nation-building, minorities and contested borders"] },
        ],
      },
      {
        title: "Imperialism, Colonialism and Asian Responses",
        chapters: [
          { title: "New Imperialism", topics: ["Economic explanations of imperialism", "Strategic rivalry and prestige", "Racial ideologies and civilizing claims", "Technology, medicine and imperial expansion", "Colonial state, extraction and resistance"] },
          { title: "Scramble for Africa", topics: ["Berlin Conference and partition", "Forms of colonial rule", "Economic and social transformation", "African resistance and accommodation", "Colonial boundaries and postcolonial consequences"] },
          { title: "Imperialism in China", topics: ["Opium Wars and unequal treaties", "Taiping and Boxer movements", "Self-Strengthening and reform", "1911 Revolution and fall of the Qing", "Nationalism, communism and civil conflict"] },
          { title: "Japan from Meiji Restoration to Militarism", topics: ["Tokugawa order and external pressure", "Meiji political and social reforms", "Industrialization and military modernization", "Japanese imperial expansion", "Militarism and road to the Pacific War"] },
        ],
      },
      {
        title: "World Wars and the Inter-War Crisis",
        chapters: [
          { title: "First World War", topics: ["Long-term causes and alliance systems", "Balkan crises and immediate trigger", "Total war, technology and society", "Colonial participation and global theatres", "Treaties and transformation of Europe"] },
          { title: "Russian Revolutions", topics: ["Tsarist crisis and Revolution of 1905", "February Revolution and dual power", "Bolsheviks and October Revolution", "Civil war, war communism and New Economic Policy", "Formation and significance of the Soviet Union"] },
          { title: "Great Depression", topics: ["Financial crash and structural causes", "Global transmission and collapse of trade", "Social and political consequences", "New Deal and alternative policy responses", "Depression's role in international instability"] },
          { title: "Fascism and Nazism", topics: ["Post-war crisis and mass politics", "Italian Fascism and the corporate state", "Nazi ideology and seizure of power", "Propaganda, repression and racial state", "Comparing fascism, Nazism and authoritarianism"] },
          { title: "Second World War", topics: ["Failure of collective security and appeasement", "Axis expansion and major theatres", "Home fronts, technology and total war", "Holocaust and crimes against humanity", "War settlement and creation of the United Nations"] },
        ],
      },
      {
        title: "Decolonization and the Cold War",
        chapters: [
          { title: "Decolonization in Asia", topics: ["Impact of world wars on colonial empires", "National movements and negotiated transfers", "Indonesia and armed decolonization", "Indochina and revolutionary struggle", "Partition, borders and state-building"] },
          { title: "Decolonization in Africa", topics: ["Pan-Africanism and nationalist leadership", "Ghana and negotiated independence", "Algerian liberation struggle", "Settler colonialism in southern Africa", "Postcolonial state and economic dependency"] },
          { title: "Origins and Structure of the Cold War", topics: ["Wartime alliance and post-war breakdown", "Containment, Truman Doctrine and Marshall Plan", "NATO, Warsaw Pact and divided Europe", "Nuclear deterrence and arms race", "Ideological, strategic and economic dimensions"] },
          { title: "Cold War Crises and Proxy Wars", topics: ["Berlin crises", "Korean War", "Cuban Missile Crisis", "Vietnam War", "Afghanistan and late Cold War conflict"] },
          { title: "Non-Alignment and the Third World", topics: ["Bandung Conference", "Principles and phases of non-alignment", "New International Economic Order", "Agency of postcolonial states", "Achievements, constraints and contemporary relevance"] },
        ],
      },
      {
        title: "Post-Cold War Transformation",
        chapters: [
          { title: "Collapse of the Soviet Union", topics: ["Structural weaknesses of the Soviet system", "Gorbachev's glasnost and perestroika", "Nationalities and republican movements", "1991 dissolution and successor states", "Consequences for the international order"] },
          { title: "European Integration", topics: ["Post-war reconciliation and functional cooperation", "European Coal and Steel Community", "Treaties and evolution of the European Union", "Single market, euro and enlargement", "Sovereignty, democratic deficit and Euroscepticism"] },
          { title: "Globalization after 1991", topics: ["Liberal international order", "Trade, finance and global production networks", "Technology and compression of time and space", "Inequality and anti-globalization responses", "Return of geopolitics and fragmented globalization"] },
          { title: "Using World History in GS Answers", topics: ["Chronology without narrative overload", "Comparative treatment of revolutions", "Linking ideology, economy and social change", "Maps, timelines and evidence", "Drawing cautious parallels with contemporary issues"] },
        ],
      },
    ],
  },
  {
    sourceId: "indian_polity_complete",
    title: "Indian Polity",
    slug: "indian-polity",
    paper: "gs2",
    overview: "Constitutional foundations, institutions, federalism, rights, representation and contemporary constitutional governance.",
    sections: [
      {
        title: "Constitutional Foundations",
        chapters: [
          { title: "Historical Evolution of the Constitution", topics: ["Regulating Act and early parliamentary control", "Charter Acts and administrative centralization", "Government of India Acts of 1858 and 1909", "Acts of 1919 and 1935", "Cabinet Mission, Independence Act and constitutional inheritance"] },
          { title: "Constituent Assembly", topics: ["Composition and representative character", "Committees and drafting process", "Objectives Resolution", "Major constitutional debates", "Adoption, enactment and continuing relevance"] },
          { title: "Constitutional Philosophy and Preamble", topics: ["Sovereign, socialist, secular and democratic republic", "Justice, liberty, equality and fraternity", "Preamble in constitutional interpretation", "Constitutionalism and limited government", "Constitutional morality and transformative constitutionalism"] },
          { title: "Salient Features and Constitutional Design", topics: ["Written and detailed Constitution", "Parliamentary government", "Federal system with unitary features", "Separation of powers and checks and balances", "Independent institutions and rule of law"] },
          { title: "Citizenship", topics: ["Citizenship at commencement", "Acquisition and termination", "Single citizenship", "Overseas citizenship and diaspora", "Citizenship, migration and constitutional rights"] },
        ],
      },
      {
        title: "Rights, Duties and Constitutional Change",
        chapters: [
          { title: "Fundamental Rights", topics: ["State and laws under Articles 12 and 13", "Right to equality", "Freedoms and reasonable restrictions", "Protection of life and personal liberty", "Religious, cultural and educational rights"] },
          { title: "Constitutional Remedies and Writs", topics: ["Article 32 and Article 226", "Habeas corpus, mandamus and prohibition", "Certiorari and quo warranto", "Public interest litigation", "Access to justice and judicial remedies"] },
          { title: "Directive Principles of State Policy", topics: ["Classification and constitutional purpose", "DPSP and Fundamental Rights", "Welfare state and socio-economic transformation", "Gandhian and liberal principles", "Implementation and contemporary relevance"] },
          { title: "Fundamental Duties", topics: ["Origin and constitutional status", "Scope and enforceability", "Duties in judicial interpretation", "Citizenship and civic responsibility", "Reform debates"] },
          { title: "Amendment and Basic Structure", topics: ["Article 368 procedure", "Types of constitutional amendment", "Evolution of the basic-structure doctrine", "Constitutional identity and parliamentary power", "Major amendment controversies"] },
          { title: "Emergency Provisions", topics: ["National emergency", "President's Rule", "Financial emergency", "Effects on rights and federalism", "Safeguards and lessons from the Emergency"] },
        ],
      },
      {
        title: "Union Institutions",
        chapters: [
          { title: "President and Vice-President", topics: ["Election, qualification and tenure", "Executive and legislative powers", "Discretion and constitutional conventions", "Ordinance and pardoning powers", "Impeachment and vacancy"] },
          { title: "Prime Minister and Council of Ministers", topics: ["Appointment and formation of government", "Collective and individual responsibility", "Cabinet system and cabinet committees", "Prime Minister's Office", "Coalition and majority governments"] },
          { title: "Parliament", topics: ["Composition and sessions", "Legislative procedure", "Money bills and financial control", "Privileges, immunities and accountability", "Disruption, deliberation and reform"] },
          { title: "Parliamentary Committees", topics: ["Public Accounts Committee", "Estimates and Public Undertakings Committees", "Department-related standing committees", "Select and joint committees", "Committee effectiveness and reform"] },
          { title: "Supreme Court", topics: ["Composition, appointment and tenure", "Original, appellate and advisory jurisdiction", "Judicial review", "Judicial independence and accountability", "Pendency, access and court administration"] },
          { title: "Judicial Review and Judicial Activism", topics: ["Constitutional basis of judicial review", "Public interest litigation", "Judicial activism and restraint", "Separation-of-powers concerns", "Tribunals and judicial governance"] },
        ],
      },
      {
        title: "States, Federalism and Local Government",
        chapters: [
          { title: "State Executive and Legislature", topics: ["Governor's appointment and role", "Chief Minister and Council of Ministers", "State legislative procedure", "Governor's discretion and federal controversy", "State accountability institutions"] },
          { title: "High Courts and Subordinate Judiciary", topics: ["High Court jurisdiction", "Appointment, transfer and independence", "Control over subordinate courts", "District judiciary and access to justice", "All India Judicial Service debate"] },
          { title: "Centre-State Legislative Relations", topics: ["Union, State and Concurrent Lists", "Residuary powers", "Repugnancy and parliamentary legislation on State subjects", "Intergovernmental consultation", "Federal disputes and judicial interpretation"] },
          { title: "Administrative and Financial Federalism", topics: ["Administrative coordination", "Inter-State Council and zonal councils", "Finance Commission", "GST Council", "Centrally sponsored schemes and fiscal autonomy"] },
          { title: "Inter-State Relations", topics: ["Inter-state water disputes", "River-water tribunals", "Boundary and resource disputes", "Inter-state trade and mobility", "Cooperative dispute resolution"] },
          { title: "Panchayati Raj", topics: ["73rd Amendment", "Gram Sabha and three-tier structure", "Devolution of functions, funds and functionaries", "Reservations and inclusive representation", "District planning and local accountability"] },
          { title: "Urban Local Government", topics: ["74th Amendment", "Municipal structures", "Metropolitan and district planning", "Municipal finance and service delivery", "Mayors, parastatals and urban governance reform"] },
        ],
      },
      {
        title: "Constitutional and Statutory Institutions",
        chapters: [
          { title: "Election Commission of India", topics: ["Constitutional status and composition", "Electoral-roll and election administration", "Model Code of Conduct", "Recognition of parties and symbols", "Independence, appointments and reform"] },
          { title: "Comptroller and Auditor General", topics: ["Constitutional independence", "Audit mandate", "Compliance and performance audit", "CAG and legislative financial control", "Audit modernization"] },
          { title: "Finance Commission and Fiscal Institutions", topics: ["Constitutional mandate", "Vertical and horizontal devolution", "Grants-in-aid", "Local-government finance", "Fiscal federalism challenges"] },
          { title: "UPSC and State Public Service Commissions", topics: ["Composition and independence", "Recruitment and advisory functions", "Limitations and accountability", "Public-service recruitment reform", "Institutional integrity"] },
          { title: "National Commissions", topics: ["SC and ST Commissions", "Backward Classes Commission", "Minorities Commission", "Women and child-rights institutions", "Human Rights Commission and enforcement gaps"] },
          { title: "Tribunals and Regulatory Bodies", topics: ["Constitutional basis of tribunals", "Administrative and specialized tribunals", "Independence and appointments", "Regulatory-state rationale", "Accountability and appellate oversight"] },
        ],
      },
      {
        title: "Elections, Representation and Political Process",
        chapters: [
          { title: "Electoral System", topics: ["First-past-the-post system", "Constituency delimitation", "Reserved constituencies", "Electoral rolls and voter participation", "Alternative electoral systems"] },
          { title: "Representation of the People Acts", topics: ["Qualifications and disqualifications", "Corrupt practices and electoral offences", "Election petitions", "Candidate disclosures", "Decriminalization of politics"] },
          { title: "Political Parties and Anti-Defection", topics: ["Recognition and regulation of parties", "Internal democracy", "Party finance", "Tenth Schedule", "Speaker's role and anti-defection reform"] },
          { title: "Electoral Reforms", topics: ["Campaign-finance transparency", "Criminalization and candidate accountability", "Simultaneous-elections debate", "Voting technology and trust", "Participation of women and marginalized groups"] },
          { title: "Pressure Groups and Civil Society", topics: ["Interest articulation", "Social movements", "Professional and business associations", "Media and digital mobilization", "Transparency and democratic accountability"] },
        ],
      },
      {
        title: "Constitutional Governance and Accountability",
        chapters: [
          { title: "Rule of Law and Due Process", topics: ["Formal and substantive rule of law", "Procedure established by law", "Natural justice", "Arbitrariness and proportionality", "Administrative discretion and judicial control"] },
          { title: "Transparency and Right to Information", topics: ["RTI framework", "Proactive disclosure", "Information commissions", "Exemptions, privacy and public interest", "Backlogs and institutional reform"] },
          { title: "Civil Services in a Democracy", topics: ["Political neutrality and anonymity", "Accountability and responsiveness", "Lateral entry and specialization", "Performance management", "Civil-service values and reform commissions"] },
          { title: "Digital Constitutionalism", topics: ["Privacy as a fundamental right", "Data protection", "Surveillance and proportionality", "Platform governance and free speech", "Algorithmic state and accountable automation"] },
          { title: "Criminal Justice and Police Reform", topics: ["Constitutional safeguards in criminal process", "Police accountability", "Prison reform", "Victim rights and legal aid", "Technology and forensic capacity"] },
          { title: "Comparative Constitutional Practices", topics: ["Indian and British parliamentary systems", "India and United States federalism", "Judicial review across systems", "Upper houses and bicameralism", "Borrowed provisions and Indian adaptation"] },
        ],
      },
      {
        title: "Contemporary Constitutional Debates",
        chapters: [
          { title: "Constitutional Morality and Institutional Balance", topics: ["Constitutional morality", "Institutional comity", "Checks and balances", "Majoritarianism and constitutional democracy", "Public trust in institutions"] },
          { title: "Federalism in Practice", topics: ["Cooperative and competitive federalism", "Role of governors", "Fiscal centralization", "Regional aspirations", "Asymmetric federal arrangements"] },
          { title: "Representation and Inclusion", topics: ["Reservation and substantive equality", "Women's political representation", "Representation of minorities", "Delimitation and federal balance", "Inclusive public institutions"] },
          { title: "Using Supreme Court Judgments in Answers", topics: ["Identifying the controlling constitutional principle", "Separating holding from observation", "Building balanced judgment-based arguments", "Avoiding case-name dumping", "Connecting doctrine with institutional consequences"] },
        ],
      },
    ],
  },
  {
    sourceId: "essay_mastery",
    title: "Essay Mastery",
    slug: "essay-mastery",
    paper: "essay",
    overview: "A complete method for philosophical and issue-based essays, enrichment, practice and evaluation.",
    sections: [
      {
        title: "Essay Method",
        chapters: [
          { title: "Decoding the Topic", topics: ["Identifying directive and core proposition", "Defining key terms without dictionary prose", "Recognizing hidden tensions and assumptions", "Setting the essay's scope", "Avoiding topic drift"] },
          { title: "Brainstorming and Dimensional Thinking", topics: ["Stakeholder mapping", "Temporal and spatial dimensions", "Individual, society, state and global lenses", "Ethical, economic, political and technological lenses", "Selecting depth over exhaustive listing"] },
          { title: "Thesis and Argument Architecture", topics: ["Formulating a defensible thesis", "Sequencing claims", "Claim-evidence-analysis-link paragraphs", "Counterargument and synthesis", "Maintaining a coherent argumentative arc"] },
          { title: "Introduction and Conclusion", topics: ["Anecdotal and conceptual openings", "Question and paradox openings", "Connecting the opening to the thesis", "Forward-looking conclusions", "Avoiding clichés and disconnected quotations"] },
          { title: "Language and Presentation", topics: ["Clarity, precision and sentence rhythm", "Transitions and paragraph unity", "Balanced tone", "Relevant quotations and examples", "Revision for concision and correctness"] },
        ],
      },
      {
        title: "Philosophical Essays",
        chapters: [
          { title: "Knowledge, Truth and Wisdom", topics: ["Knowledge and information", "Doubt and intellectual humility", "Science and ways of knowing", "Wisdom in public action", "Truth in the digital age"] },
          { title: "Freedom, Responsibility and Choice", topics: ["Negative and positive freedom", "Agency and structural constraints", "Responsibility for consequences", "Liberty and social order", "Freedom in technological systems"] },
          { title: "Justice, Equality and Compassion", topics: ["Formal and substantive equality", "Justice as fairness", "Recognition and dignity", "Compassion and public policy", "Balancing merit, need and historical disadvantage"] },
          { title: "Ethics, Means and Ends", topics: ["Moral limits of consequentialism", "Integrity of means", "Public and private morality", "Ethics under uncertainty", "Character and institutions"] },
          { title: "Humanity, Nature and Progress", topics: ["Meanings of progress", "Human exceptionalism", "Ecological limits", "Technology and human flourishing", "Intergenerational responsibility"] },
        ],
      },
      {
        title: "Society and Governance Themes",
        chapters: [
          { title: "Democracy and Citizenship", topics: ["Democratic culture beyond elections", "Rights and duties", "Dissent and dialogue", "Institutions and civic trust", "Digital citizenship"] },
          { title: "Education and Human Development", topics: ["Education as capability", "Equity and access", "Critical thinking and character", "Technology in education", "Learning society and lifelong education"] },
          { title: "Gender and Social Transformation", topics: ["Patriarchy and agency", "Care economy", "Representation and leadership", "Intersectionality", "Men and masculinities in gender justice"] },
          { title: "Diversity and Social Cohesion", topics: ["Unity and pluralism", "Identity and belonging", "Tolerance versus mutual respect", "Migration and multiculturalism", "Constitutional fraternity"] },
          { title: "Leadership and Public Service", topics: ["Power and responsibility", "Empathy in administration", "Courage and ethical leadership", "Institution-building", "Service before self"] },
        ],
      },
      {
        title: "Economy, Technology and Environment Themes",
        chapters: [
          { title: "Development and Inequality", topics: ["Growth and human well-being", "Opportunity and outcome", "Poverty and dignity", "Regional imbalance", "Inclusive and sustainable development"] },
          { title: "Work, Automation and Human Purpose", topics: ["Changing nature of work", "Automation and displacement", "Skills and social protection", "Meaningful work", "Human-machine complementarity"] },
          { title: "Science, Technology and Society", topics: ["Scientific temper", "Innovation and social purpose", "Technology and power", "Ethics of emerging technologies", "Democratizing technological benefits"] },
          { title: "Environment and Intergenerational Justice", topics: ["Ecological citizenship", "Climate responsibility", "Consumption and sufficiency", "Traditional knowledge", "Just transition"] },
          { title: "Globalization and Local Resilience", topics: ["Interdependence", "Cultural change", "Global markets and vulnerability", "Local capabilities", "Resilient and plural globalization"] },
        ],
      },
      {
        title: "Enrichment Bank",
        chapters: [
          { title: "Constitutional and Historical Examples", topics: ["Constitutional values", "Freedom movement", "Social reform movements", "Institutional successes and failures", "Using history without forced analogy"] },
          { title: "Thinkers and Ideas", topics: ["Gandhi", "Ambedkar", "Tagore", "Vivekananda", "Global thinkers and careful attribution"] },
          { title: "Contemporary Examples", topics: ["Selecting durable current examples", "Using data without overprecision", "Local and administrative innovations", "Scientific and social case studies", "Converting news into analytical evidence"] },
          { title: "Stories, Analogies and Quotations", topics: ["Choosing relevant anecdotes", "Building an analogy", "Testing the limits of analogy", "Accurate quotation practice", "Original insight over decorative material"] },
        ],
      },
      {
        title: "Practice and Evaluation",
        chapters: [
          { title: "Timed Essay Workflow", topics: ["Topic selection", "Twenty-minute planning", "Time allocation across sections", "Maintaining pace and legibility", "Final review protocol"] },
          { title: "Self-Evaluation Rubric", topics: ["Relevance and thesis", "Structure and coherence", "Depth and multidimensionality", "Examples and originality", "Language and conclusion"] },
          { title: "Error Log and Rewrite", topics: ["Diagnosing topic drift", "Fixing weak paragraph logic", "Removing repetition", "Improving transitions", "Rewriting introductions and conclusions"] },
          { title: "Essay Practice Cycle", topics: ["Weekly full-length essay", "Outline drills", "Introduction and conclusion drills", "Peer or mentor feedback", "Monthly portfolio review"] },
        ],
      },
    ],
  },
];
