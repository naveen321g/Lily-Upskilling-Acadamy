/**
 * Security & integrity heuristics that run locally (cheaply) alongside the
 * LLM's own semantic cheat-signal judgement.
 *
 * Session replay/attempt-cap protection is handled by the DB-backed
 * `interview_sessions` row and its RLS policies instead of the in-memory
 * session-token scheme the original engine used for an untrusted mobile
 * client — this engine only ever runs authoritatively on the server here.
 */

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(the\s+)?(system|previous)\s+prompt/i,
  /you\s+are\s+now\s+(a|an)\b/i,
  /act\s+as\s+(if\s+you\s+are\s+)?(the\s+)?(system|developer|admin)/i,
  /reveal\s+(your\s+)?(system\s+prompt|instructions|rubric|score)/i,
  /print\s+(your\s+)?(prompt|instructions)/i,
  /\bsystem\s*:/i,
  /\bassistant\s*:/i,
];

export interface SanitizeResult {
  text: string;
  injectionDetected: boolean;
}

/**
 * Neutralise prompt-injection attempts inside a candidate answer before it is
 * ever placed into an LLM message. Content is not deleted (that would hide
 * genuine answers) — directive phrasing is defanged and flagged.
 */
export function sanitizeCandidateInput(raw: string): SanitizeResult {
  let injectionDetected = false;
  let text = raw;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      injectionDetected = true;
      text = text.replace(pattern, "[redacted-directive]");
    }
  }
  // Strip role markers a candidate might use to fake a transcript.
  text = text.replace(/^\s*(system|assistant|developer)\s*:/gim, "");
  return { text: text.trim(), injectionDetected };
}

/** Cheap local check: is this answer near-identical to a previous one? */
export function isLocallyRepeated(answer: string, priorAnswers: string[]): boolean {
  const norm = normalise(answer);
  if (norm.length < 12) return false;
  return priorAnswers.some((p) => {
    const pn = normalise(p);
    if (pn.length < 12) return false;
    return pn === norm || jaccard(tokenSet(pn), tokenSet(norm)) > 0.85;
  });
}

/** Cheap local check: is the answer generic filler with no substance? */
export function isLocallyGeneric(answer: string): boolean {
  const norm = normalise(answer);
  const words = norm.split(/\s+/).filter(Boolean);
  if (words.length < 4) return true;
  const unique = new Set(words);
  return unique.size / words.length < 0.5 && words.length < 12;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(s.split(" ").filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
