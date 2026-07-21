// Shared low-level helpers: HTML escaping, URL sanitizing, number rounding,
// vector math, and text-metric constants. Kept in one place so rendering,
// symbols, layout, and the plugins agree (and don't drift).

export interface Vec {
  x: number;
  y: number;
}

/** Escape text/attribute content for HTML/SVG. Escapes & < > " '. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/**
 * Sanitize a URL for use in an `href`. Returns the URL if it is scheme-relative,
 * relative, a fragment, or uses an allowed scheme (http/https/mailto); otherwise
 * returns null (rejecting `javascript:`, `data:`, `vbscript:`, …). This is the
 * guard for the `link=` attribute — untrusted `.elmo` can be rendered inline.
 */
export function safeHref(url: string): string | null {
  const u = url.trim();
  if (u === "") return null;
  // relative path, fragment, or protocol-relative → safe (no scheme)
  if (/^(?![a-z][a-z0-9+.-]*:)/i.test(u)) return u;
  try {
    const scheme = new URL(u, "https://x.invalid").protocol;
    return SAFE_SCHEMES.has(scheme) ? u : null;
  } catch {
    return null;
  }
}

/** Round to 2 decimal places, as a string (SVG coordinate precision). */
export function round2(x: number): string {
  return (Math.round(x * 100) / 100).toString();
}

// ── vector helpers ──
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (v: Vec, k: number): Vec => ({ x: v.x * k, y: v.y * k });
export const neg = (v: Vec): Vec => ({ x: -v.x, y: -v.y });
export const perp = (v: Vec): Vec => ({ x: -v.y, y: v.x });
export const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const norm = (v: Vec): Vec => {
  const m = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / m, y: v.y / m };
};

/** Approximate glyph advance for label/box sizing at the UI font size. */
export const CHAR = 6.5;
