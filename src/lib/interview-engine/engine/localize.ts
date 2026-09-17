import type { LocalizedText } from "../types";

/**
 * Build the candidate-facing text from a per-language map, stacking each
 * configured language in order (e.g. English then Malayalam) separated by a
 * blank line. Falls back to the primary text when only one language is
 * configured or translations are missing.
 */
export function formatLocalized(
  languages: string[],
  map: LocalizedText,
  fallbackPrimary?: string,
): string {
  const parts: string[] = [];
  languages.forEach((lang, i) => {
    const text = (map[lang] ?? (i === 0 ? (fallbackPrimary ?? "") : "")).trim();
    if (text) parts.push(text);
  });
  return parts.join("\n\n") || (fallbackPrimary ?? "").trim();
}

/** The primary (first) language; used for internal reasoning/evaluation. */
export function primaryLanguage(languages: string[]): string {
  return languages[0] ?? "English";
}

/** True when the interview is multilingual. */
export function isMultilingual(languages: string[]): boolean {
  return languages.length > 1;
}
