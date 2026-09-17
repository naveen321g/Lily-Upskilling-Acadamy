/**
 * Robust JSON extraction from an LLM response. Models occasionally wrap JSON
 * in prose or ```json fences despite instructions; this recovers the object.
 */
export function parseJsonObject<T>(raw: string): T {
  const cleaned = stripFences(raw).trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall through to brace-matching extraction.
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = cleaned.slice(start, end + 1);
    return JSON.parse(candidate) as T;
  }
  throw new Error(`Could not parse JSON from model response: ${raw.slice(0, 200)}`);
}

function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}
