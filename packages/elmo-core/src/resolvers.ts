// Browser-safe import resolvers. The filesystem resolver lives in the CLI (it
// needs node:fs); here we provide a virtual-file-map resolver usable anywhere,
// including the browser and Markdown plugins where there is no real filesystem.

import type { ImportResolver } from "./types.js";

/** Normalize a POSIX-ish path: drop `.`/empty segments, collapse `..`. */
function normalize(p: string): string {
  const parts: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

/**
 * Resolve imports against an in-memory `{ path: source }` map. Keys may be
 * addressed directly or relative to the importing file, so `import "./b.elmo"`
 * from `a/x.elmo` finds `a/b.elmo`.
 */
export function mapResolver(files: Record<string, string>): ImportResolver {
  return (spec, fromPath) => {
    const baseDir = fromPath ? fromPath.split("/").slice(0, -1).join("/") : "";
    const candidates = [spec, normalize(spec), baseDir ? normalize(`${baseDir}/${spec}`) : ""];
    for (const c of candidates) {
      if (c && c in files) return { path: c, source: files[c]! };
      const n = c && normalize(c);
      if (n && n in files) return { path: n, source: files[n]! };
    }
    return null;
  };
}
