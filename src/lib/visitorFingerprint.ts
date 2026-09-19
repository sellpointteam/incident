// Stable anonymous visitor fingerprint stored in localStorage.
const STORAGE_KEY = "pct:visitor_hash";

export function getVisitorHash(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const hash =
      (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) +
      "-" +
      Math.random().toString(36).slice(2, 10);
    localStorage.setItem(STORAGE_KEY, hash);
    return hash;
  } catch {
    // Fallback for environments without localStorage
    return `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
