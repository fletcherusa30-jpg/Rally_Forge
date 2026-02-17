import { AppError } from "../utils/errors.js";

const normalizeAuthorityInput = (value) =>
  String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();

const uniqueByKey = (items, keyFn) => {
  const seen = new Set();
  const output = [];
  items.forEach((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    output.push(item);
  });
  return output;
};

const SECTION_HEADER_PATTERNS = [
  /^\s*§+\s*([0-9]+\.[0-9A-Za-z\-]+)\s+(.+)$/,
  /^\s*Sec\.\s*([0-9]+\.[0-9A-Za-z\-]+)\s+(.+)$/i
];

const PART_HEADER_PATTERN = /^\s*PART\s+([0-9A-Za-z]+)\b(.+)?$/i;
const SUBPART_HEADER_PATTERN = /^\s*Subpart\s+([A-Z0-9]+)\b(.+)?$/i;

const getSectionHeaderMatch = (line) => {
  for (const pattern of SECTION_HEADER_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      return {
        sectionId: String(match[1] || "").trim(),
        title: String(match[2] || "").replace(/[\s\-–—:]+$/g, "").trim()
      };
    }
  }
  return null;
};

const parseAuthorityStructure = (text) => {
  const lines = normalizeAuthorityInput(text).split("\n");
  const parts = [];
  const subparts = [];
  const sections = [];

  let currentPart = "";
  let currentSubpart = "";
  let currentSection = null;

  const flushSection = () => {
    if (!currentSection) {
      return;
    }

    const content = currentSection.lines.join(" ").replace(/\s+/g, " ").trim();
    sections.push({
      sectionId: currentSection.sectionId,
      title: currentSection.title,
      part: currentSection.part,
      subpart: currentSection.subpart,
      startLine: currentSection.startLine,
      endLine: currentSection.endLine,
      content,
      preview: content.slice(0, 260)
    });

    currentSection = null;
  };

  lines.forEach((rawLine, idx) => {
    const lineNumber = idx + 1;
    const line = String(rawLine || "").trim();
    if (!line) {
      if (currentSection) {
        currentSection.lines.push("");
      }
      return;
    }

    const partMatch = line.match(PART_HEADER_PATTERN);
    if (partMatch) {
      currentPart = `PART ${String(partMatch[1] || "").trim()}`;
      parts.push({
        id: currentPart,
        title: line,
        line: lineNumber
      });
      return;
    }

    const subpartMatch = line.match(SUBPART_HEADER_PATTERN);
    if (subpartMatch) {
      currentSubpart = `Subpart ${String(subpartMatch[1] || "").trim()}`;
      subparts.push({
        id: currentSubpart,
        title: line,
        part: currentPart,
        line: lineNumber
      });
      return;
    }

    const sectionHeader = getSectionHeaderMatch(line);
    if (sectionHeader) {
      flushSection();
      currentSection = {
        sectionId: sectionHeader.sectionId,
        title: sectionHeader.title,
        part: currentPart,
        subpart: currentSubpart,
        startLine: lineNumber,
        endLine: lineNumber,
        lines: []
      };
      return;
    }

    if (currentSection) {
      currentSection.lines.push(line);
      currentSection.endLine = lineNumber;
    }
  });

  flushSection();

  const dedupedParts = uniqueByKey(parts, (item) => `${item.id}|${item.line}`);
  const dedupedSubparts = uniqueByKey(subparts, (item) => `${item.id}|${item.line}`);

  return {
    parts: dedupedParts,
    subparts: dedupedSubparts,
    sections
  };
};

const extractAuthorityCitations = (text) => {
  const normalized = normalizeAuthorityInput(text);
  const results = [];

  const patterns = [
    {
      type: "cfr",
      regex: /\b38\s+C\.?F\.?R\.?\s*(?:§{1,2}\s*)?([0-9]+\.[0-9A-Za-z\-]+)\b/gi,
      formatter: (value) => `38 C.F.R. § ${value}`
    },
    {
      type: "usc",
      regex: /\b38\s+U\.?S\.?C\.?\s*(?:§{1,2}\s*)?([0-9A-Za-z\-]+)\b/gi,
      formatter: (value) => `38 U.S.C. § ${value}`
    },
    {
      type: "section",
      regex: /§{1,2}\s*([0-9]+\.[0-9A-Za-z\-]+)\b/g,
      formatter: (value) => `§ ${value}`
    }
  ];

  patterns.forEach((patternDef) => {
    let match;
    while ((match = patternDef.regex.exec(normalized)) !== null) {
      const value = String(match[1] || "").trim();
      if (!value) {
        continue;
      }
      results.push({
        type: patternDef.type,
        value,
        citation: patternDef.formatter(value)
      });
    }
  });

  return uniqueByKey(results, (item) => `${item.type}|${item.value}`);
};

const classifyAuthorityType = (text, sectionsCount) => {
  const normalized = normalizeAuthorityInput(text).toLowerCase();
  const hasCfrAuthority =
    /title\s+38\s+of\s+the\s+code\s+of\s+federal\s+regulations/.test(normalized) ||
    /\b38\s+c\.?f\.?r\.?\b/.test(normalized);

  if (hasCfrAuthority || sectionsCount >= 3) {
    return "authority_document";
  }
  return "reference_document";
};

const buildSearchExcerpt = (content, queryTokens) => {
  const normalized = String(content || "");
  if (!normalized) {
    return "";
  }
  const lowered = normalized.toLowerCase();

  let firstIndex = -1;
  queryTokens.forEach((token) => {
    const idx = lowered.indexOf(token.toLowerCase());
    if (idx >= 0 && (firstIndex === -1 || idx < firstIndex)) {
      firstIndex = idx;
    }
  });

  if (firstIndex === -1) {
    return normalized.slice(0, 240);
  }

  const start = Math.max(0, firstIndex - 90);
  const end = Math.min(normalized.length, firstIndex + 180);
  return normalized.slice(start, end).trim();
};

const scoreSectionForQuery = (section, queryTokens) => {
  const title = String(section.title || "").toLowerCase();
  const content = String(section.content || "").toLowerCase();

  let score = 0;
  queryTokens.forEach((token) => {
    if (!token) {
      return;
    }
    const safeToken = token.toLowerCase();
    if (section.sectionId === safeToken) {
      score += 12;
    }
    if (section.sectionId?.toLowerCase().includes(safeToken)) {
      score += 8;
    }
    if (title.includes(safeToken)) {
      score += 6;
    }
    if (content.includes(safeToken)) {
      score += 3;
    }
  });

  return score;
};

const tokenizeQuery = (query) =>
  String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

export const analyzeAuthorityText = (text) => {
  const normalizedText = normalizeAuthorityInput(text);
  if (!normalizedText) {
    throw new AppError("text is required", 400, "invalid_authority_input");
  }

  const structure = parseAuthorityStructure(normalizedText);
  const citations = extractAuthorityCitations(normalizedText);
  const documentType = classifyAuthorityType(normalizedText, structure.sections.length);

  return {
    source: "authority_live",
    documentType,
    summary: {
      totalLines: normalizedText.split("\n").length,
      parts: structure.parts.length,
      subparts: structure.subparts.length,
      sections: structure.sections.length,
      citations: citations.length
    },
    parts: structure.parts,
    subparts: structure.subparts,
    sections: structure.sections,
    citations
  };
};

export const searchAuthorityText = (text, query, maxResults = 10) => {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) {
    throw new AppError("query is required", 400, "invalid_authority_query");
  }

  const analysis = analyzeAuthorityText(text);
  const tokens = tokenizeQuery(normalizedQuery);
  if (!tokens.length) {
    throw new AppError("query must include searchable terms", 400, "invalid_authority_query");
  }

  const results = analysis.sections
    .map((section) => ({
      section,
      score: scoreSectionForQuery(section, tokens)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(50, Number(maxResults) || 10)))
    .map(({ section, score }) => ({
      sectionId: section.sectionId,
      title: section.title,
      part: section.part,
      subpart: section.subpart,
      startLine: section.startLine,
      endLine: section.endLine,
      score,
      excerpt: buildSearchExcerpt(section.content, tokens)
    }));

  const matchingCitations = analysis.citations.filter((citation) =>
    tokens.some((token) =>
      citation.citation.toLowerCase().includes(token) || citation.value.toLowerCase().includes(token)
    )
  );

  return {
    source: "authority_search",
    documentType: analysis.documentType,
    query: normalizedQuery,
    resultCount: results.length,
    citationMatches: matchingCitations,
    results
  };
};
