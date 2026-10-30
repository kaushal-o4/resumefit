// Core scoring logic. Pure functions with no DOM access, so it runs in the
// browser and in Node (for tests) unchanged.
(function (root) {
  const SKILLS =
    typeof module !== "undefined" && module.exports ? require("./skills.js") : root.SKILLS;

  const STOPWORDS = new Set(
    ("a an the and or but if then of to in on at by for with from as is are was were be been being " +
      "this that these those it its we our you your they their he she i me my us will would can could " +
      "should must may might shall do does did have has had not no yes so than too very also about into " +
      "over under across within per via etc using use used able ability work working job role team teams " +
      "candidate candidates looking join company experience years year strong good great excellent " +
      "knowledge understanding skills skill required requirements preferred plus responsibilities " +
      "including include such other new well what who how why where when all any each more most " +
      "bonus basic hands-on familiarity fundamentals part take write build thousands")
      .split(/\s+/)
  );

  const ACTION_VERBS = [
    "built", "developed", "designed", "implemented", "created", "led", "launched", "optimized",
    "improved", "reduced", "increased", "automated", "deployed", "architected", "managed",
    "delivered", "analyzed", "engineered", "integrated", "migrated", "mentored", "streamlined",
  ];

  const SECTIONS = {
    Education: /\b(education|academic|qualification)/i,
    Experience: /\b(experience|internship|employment|work history)/i,
    Projects: /\bprojects?\b/i,
    Skills: /\b(skills|technical skills|technologies|tech stack)\b/i,
  };

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  }

  // Word-boundary match that also works for tokens like "c++", "c#" and "node.js",
  // and keeps "java" from matching inside "javascript".
  function aliasRegex(alias) {
    return new RegExp("(?<![a-z0-9+#])" + escapeRegex(alias) + "(?![a-z0-9+#])", "i");
  }

  const SKILL_INDEX = [];
  for (const [category, skills] of Object.entries(SKILLS)) {
    for (const [name, aliases] of Object.entries(skills)) {
      SKILL_INDEX.push({ name, category, patterns: aliases.map(aliasRegex) });
    }
  }

  // Every word that appears in a skill name or alias; excluded from generic keywords
  // so "react" or "apis" aren't double-counted.
  const SKILL_WORDS = new Set();
  for (const skills of Object.values(SKILLS)) {
    for (const [name, aliases] of Object.entries(skills)) {
      for (const phrase of [name, ...aliases]) tokenize(phrase).forEach((w) => SKILL_WORDS.add(w));
    }
  }

  function findSkills(text) {
    return SKILL_INDEX.filter((s) => s.patterns.some((p) => p.test(text)));
  }

  // Light stemming plus a 7-char prefix so "collaborate"/"collaborated"/"collaboration"
  // and "accessible"/"accessibility" are treated as the same keyword.
  function stem(word) {
    let w = word;
    if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
    else if (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
    return w.slice(0, 7);
  }

  function tokenize(text) {
    return (text.toLowerCase().match(/[a-z][a-z0-9+#.-]*/g) || [])
      .map((w) => w.replace(/[.-]+$/, ""))
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  }

  // Most frequent meaningful words in the job description that aren't already
  // covered by the skill dictionary (e.g. "scalable", "dashboard", "fintech").
  // Returns [{ key, word }]: key is the stem used for matching, word is shown in the UI.
  // Ranked by frequency, then by length (longer words tend to be more specific).
  function topKeywords(text, skillWords, limit = 12) {
    const skip = new Set([...skillWords].map(stem));
    const seen = new Map();
    for (const w of tokenize(text)) {
      const key = stem(w);
      if (skip.has(key)) continue;
      const entry = seen.get(key) || { key, word: w, count: 0 };
      entry.count++;
      if (w.length < entry.word.length) entry.word = w;
      seen.set(key, entry);
    }
    return [...seen.values()]
      .sort((a, b) => b.count - a.count || b.word.length - a.word.length || a.word.localeCompare(b.word))
      .slice(0, limit)
      .map(({ key, word }) => ({ key, word }));
  }

  function qualityChecks(resume) {
    const words = resume.trim().split(/\s+/).filter(Boolean).length;
    const lower = resume.toLowerCase();
    const verbsUsed = ACTION_VERBS.filter((v) => aliasRegex(v).test(lower));
    const missingSections = Object.keys(SECTIONS).filter((k) => !SECTIONS[k].test(resume));

    return [
      { id: "email", label: "Email address", ok: /[\w.+-]+@[\w-]+\.[\w.]+/.test(resume),
        tip: "Add a professional email address at the top." },
      { id: "phone", label: "Phone number", ok: /(\+?\d[\d\s-]{8,}\d)/.test(resume),
        tip: "Add a phone number recruiters can reach you on." },
      { id: "links", label: "LinkedIn / GitHub link", ok: /(linkedin\.com|github\.com)/i.test(resume),
        tip: "Link your LinkedIn and GitHub so recruiters can see your work." },
      { id: "sections", label: "Standard sections", ok: missingSections.length === 0,
        tip: "Add clearly titled sections: " + missingSections.join(", ") + "." },
      { id: "metrics", label: "Quantified impact", ok: (resume.match(/\d+\s?(%|\+|x\b|k\b|users|ms)/gi) || []).length >= 2,
        tip: "Quantify results, e.g. \"reduced load time by 40%\" or \"500+ users\"." },
      { id: "verbs", label: "Action verbs", ok: verbsUsed.length >= 4,
        tip: "Start bullet points with strong verbs like Built, Optimized, Led, Automated." },
      { id: "length", label: "Length (300–900 words)", ok: words >= 300 && words <= 900,
        tip: words < 300
          ? `Only ${words} words: add detail to projects and experience.`
          : `${words} words: trim to 1–2 pages; recruiters skim.` },
    ];
  }

  function analyze(resume, jobDescription) {
    const jdSkills = findSkills(jobDescription);
    const resumeSkillNames = new Set(findSkills(resume).map((s) => s.name));
    const matched = jdSkills.filter((s) => resumeSkillNames.has(s.name));
    const missing = jdSkills.filter((s) => !resumeSkillNames.has(s.name));

    const keywords = topKeywords(jobDescription, SKILL_WORDS);
    const resumeStems = new Set(tokenize(resume).map(stem));
    const keywordsFound = keywords.filter((k) => resumeStems.has(k.key)).map((k) => k.word);
    const keywordsMissing = keywords.filter((k) => !resumeStems.has(k.key)).map((k) => k.word);

    const checks = qualityChecks(resume);

    const pct = (a, b) => (b === 0 ? null : a / b);
    const skillPct = pct(matched.length, jdSkills.length);
    const keywordPct = pct(keywordsFound.length, keywords.length);
    const qualityPct = checks.filter((c) => c.ok).length / checks.length;

    // Weighted score; if the JD has no recognised skills, its weight moves to keywords.
    const parts = [
      [skillPct, 0.6],
      [keywordPct, 0.25],
      [qualityPct, 0.15],
    ].filter(([v]) => v !== null);
    const totalWeight = parts.reduce((sum, [, w]) => sum + w, 0);
    const score = Math.round((parts.reduce((sum, [v, w]) => sum + v * w, 0) / totalWeight) * 100);

    const byCategory = {};
    for (const s of jdSkills) {
      byCategory[s.category] ??= { matched: 0, total: 0 };
      byCategory[s.category].total++;
      if (resumeSkillNames.has(s.name)) byCategory[s.category].matched++;
    }

    return {
      score,
      verdict: score >= 75 ? "Strong match" : score >= 50 ? "Good, needs tuning" : "Weak match",
      breakdown: {
        skills: skillPct === null ? null : Math.round(skillPct * 100),
        keywords: keywordPct === null ? null : Math.round(keywordPct * 100),
        quality: Math.round(qualityPct * 100),
      },
      matchedSkills: matched.map((s) => s.name),
      missingSkills: missing.map((s) => s.name),
      keywordsFound,
      keywordsMissing,
      byCategory,
      checks,
      suggestions: buildSuggestions(missing, keywordsMissing, checks),
    };
  }

  function buildSuggestions(missing, keywordsMissing, checks) {
    const out = [];
    if (missing.length) {
      out.push(
        `Add the skills you genuinely have from: ${missing.slice(0, 6).map((s) => s.name).join(", ")}. ` +
          "Mention each one inside a project bullet, not only in the skills list."
      );
    }
    if (keywordsMissing.length) {
      out.push(`Mirror the job's wording where it's true for you: ${keywordsMissing.slice(0, 6).join(", ")}.`);
    }
    for (const c of checks) if (!c.ok) out.push(c.tip);
    if (!out.length) out.push("Your resume is well aligned. Tailor the summary line to this company and apply!");
    return out;
  }

  const api = { analyze, findSkills, topKeywords, tokenize, qualityChecks };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ResumeFit = api;
})(typeof window !== "undefined" ? window : globalThis);
