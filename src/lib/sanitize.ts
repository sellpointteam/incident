/**
 * Sanitization utilities. Use these for any string that originates from
 * outside our control — OSINT scrapers, AI extractions, user input.
 */
import DOMPurify from "dompurify";

/**
 * Strict HTML sanitizer. Allows a tiny whitelist of formatting tags only.
 * Strips all event handlers, scripts, iframes, and unknown attributes.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "br", "span", "p"],
    ALLOWED_ATTR: ["class"],
    KEEP_CONTENT: true,
  });
}

/**
 * Validate a URL for safe rendering. Returns the URL string if it is an
 * http(s) URL with a parseable host, otherwise null. Blocks javascript:,
 * data:, vbscript:, and other dangerous schemes.
 */
export function safeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname) return null;
  return url.toString();
}

/**
 * Display a hostname for a URL (for showing source attribution without the
 * full URL). Falls back to the original string if parsing fails.
 */
export function urlHostname(input: string | null | undefined): string {
  if (!input) return "";
  try {
    return new URL(input).hostname.replace(/^www\./, "");
  } catch {
    return input;
  }
}

/**
 * Escape a plain string for safe insertion into raw HTML. Prefer building
 * popups with React + sanitizeHtml — this is only for legacy template strings.
 * @deprecated Render popups as React trees and use sanitizeHtml instead.
 */
export function escapeHtmlText(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
