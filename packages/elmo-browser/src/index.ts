// Client-side entry: bundle with esbuild into a global `elmo` and drop on a page.
//
//   <script src="elmo.min.js"></script>
//   <pre class="elmo">part R1 res 10k ...</pre>
//
// On load it renders every elmo block in place. Call elmo.run() again after
// injecting more blocks dynamically.
//
// Imports: define reusable library files inline and `import` them —
//   <script type="text/elmo-file" data-path="psu.elmo">part U1 ic { ... }</script>
//   <pre class="elmo">import "psu.elmo" as psu
//   ...</pre>
// or pass a { files } / { resolve } map to run()/renderToSvg().

import { render, mapResolver, type ImportResolver } from "@emdzej/elmo-core";

const SELECTOR = "[data-elmo], pre.elmo, pre > code.language-elmo, code.language-elmo";

export interface RunOptions {
  resolve?: ImportResolver;
  files?: Record<string, string>;
}

/** Collect inline <script type="text/elmo-file" data-path="…"> library files. */
function collectFiles(root: ParentNode): Record<string, string> {
  const files: Record<string, string> = {};
  for (const s of Array.from(root.querySelectorAll<HTMLScriptElement>('script[type="text/elmo-file"][data-path]'))) {
    const path = s.getAttribute("data-path");
    if (path) files[path] = s.textContent ?? "";
  }
  return files;
}

function resolverFrom(opts: RunOptions, extra: Record<string, string>): ImportResolver | undefined {
  if (opts.resolve) return opts.resolve;
  const files = { ...extra, ...(opts.files ?? {}) };
  return Object.keys(files).length ? mapResolver(files) : undefined;
}

/** Render a source string to an SVG string. */
export async function renderToSvg(source: string, opts: RunOptions = {}): Promise<string> {
  const resolve = resolverFrom(opts, {});
  const { svg } = await render(source, resolve ? { resolve } : {});
  return svg;
}

/** Find and render every un-rendered elmo block under `root`. */
export async function run(root: ParentNode = document, opts: RunOptions = {}): Promise<void> {
  const resolve = resolverFrom(opts, collectFiles(root));
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(SELECTOR));
  await Promise.all(
    blocks.map(async (el) => {
      // a code inside pre: operate on the pre
      const target = el.tagName === "CODE" && el.parentElement?.tagName === "PRE" ? el.parentElement : el;
      if (target.getAttribute("data-elmo-done") === "1") return;
      target.setAttribute("data-elmo-done", "1");
      const source = el.textContent ?? "";
      const container = document.createElement("div");
      container.className = "elmo-diagram";
      try {
        container.innerHTML = await renderToSvg(source, resolve ? { resolve } : {});
      } catch (err) {
        const pre = document.createElement("pre");
        pre.className = "elmo-diagram-error";
        pre.textContent = `elmo error:\n${err instanceof Error ? err.message : String(err)}`;
        container.appendChild(pre);
      }
      target.replaceWith(container);
    }),
  );
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void run());
  else void run();
}
