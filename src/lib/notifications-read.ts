const STORAGE_KEY = "lua.notifications-seen";
const MAX_TRACKED = 200;

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function isSeen(id: string): boolean {
  if (typeof window === "undefined") return true;
  return readSeen().has(id);
}

export function markSeen(id: string) {
  if (typeof window === "undefined") return;
  const seen = readSeen();
  seen.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seen).slice(-MAX_TRACKED)));
}

export function markAllSeen(ids: string[]) {
  if (typeof window === "undefined") return;
  const seen = readSeen();
  for (const id of ids) seen.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seen).slice(-MAX_TRACKED)));
}

// Candidate notifications aren't their own database rows — they're derived
// from real certificates/badges/requests (see notifications-feed.ts), so
// "deleting" one can't remove real data. This just hides it from the
// candidate's own view, same mechanism as read-tracking above.
const DISMISSED_KEY = "lua.notifications-dismissed";

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function isDismissed(id: string): boolean {
  if (typeof window === "undefined") return false;
  return readDismissed().has(id);
}

export function dismiss(ids: string[]) {
  if (typeof window === "undefined") return;
  const dismissed = readDismissed();
  for (const id of ids) dismissed.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(dismissed).slice(-MAX_TRACKED)));
}
