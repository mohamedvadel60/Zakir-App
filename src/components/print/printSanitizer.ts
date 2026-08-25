// Zakir Institutional Print Sanitizer Module
// Removes raw AI system prompts, tool instructions, internal reasoning, and diagnostic messages before rendering reports.

const LEAK_PATTERNS = [
  /You are the\b/i,
  /System prompt\b/i,
  /Assistant\b/i,
  /Heuristic analysis - AI unavailable/i,
  /Heuristic analysis\b/i,
  /AI unavailable\b/i,
  /Correlate this global economic data/i,
  /Generate a\b/i,
  /Instructions:\s*/i,
  /Developer instruction/i,
  /Tool execution/i,
  /internal reasoning/i,
  /raw model metadata/i,
  /fallback diagnostic message/i,
];

export function sanitizeText(text: string | undefined | null, lang: "ar" | "en" | "fr" = "ar"): string {
  if (!text || typeof text !== "string") return "";

  const trimmed = text.trim();
  if (!trimmed) return "";

  // Check if the entire string is an internal diagnostic error message
  const lower = trimmed.toLowerCase();
  if (
    lower === "heuristic analysis - ai unavailable" ||
    lower === "heuristic analysis" ||
    lower === "ai unavailable" ||
    lower === "fallback diagnostic message"
  ) {
    if (lang === "ar") return "التحليل غير متاح حالياً.";
    if (lang === "fr") return "Analyse indisponible.";
    return "Analysis unavailable.";
  }

  // Check if string is a raw system prompt or developer instruction block
  if (
    trimmed.toLowerCase().startsWith("you are") ||
    trimmed.toLowerCase().startsWith("system prompt") ||
    trimmed.toLowerCase().startsWith("instructions:")
  ) {
    return "";
  }

  // Check if raw JSON error object
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.error || parsed.message) {
        if (lang === "ar") return "البيانات غير متاحة حالياً.";
        if (lang === "fr") return "Données indisponibles.";
        return "Data unavailable.";
      }
    } catch {
      // Not JSON
    }
  }

  // Sanitize line-by-line for leaked lines inside valid text
  const lines = trimmed.split("\n");
  const cleanedLines = lines.filter((line) => {
    const lowerLine = line.toLowerCase();
    for (const pattern of LEAK_PATTERNS) {
      if (pattern.test(lowerLine)) {
        return false;
      }
    }
    return true;
  });

  return cleanedLines.join("\n").trim();
}
