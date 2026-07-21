import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { render, mapResolver } from "@emdzej/elmo-core";
import ElmoPlayground from "./ElmoPlayground.vue";
import "./elmo.css";

// Decode a UTF-8 base64 string in the browser.
function decodeB64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Render every elmo block (a <div class="elmo-diagram" data-elmo-src="…base64…">)
// to SVG in the browser. Runs after each route change; each block renders once.
async function renderElmoBlocks(): Promise<void> {
  if (typeof document === "undefined") return;
  // page-scoped virtual files from `elmo-file <path>` blocks, so `import`
  // statements in examples resolve live
  const files: Record<string, string> = {};
  for (const ex of Array.from(document.querySelectorAll<HTMLElement>(".elmo-example[data-elmo-path]"))) {
    const path = ex.getAttribute("data-elmo-path");
    const b64 = ex.querySelector(".elmo-diagram")?.getAttribute("data-elmo-src");
    if (path && b64) files[path] = decodeB64(b64);
  }
  const resolve = Object.keys(files).length ? mapResolver(files) : undefined;

  const hosts = Array.from(document.querySelectorAll<HTMLElement>(".elmo-diagram[data-elmo-src]"));
  await Promise.all(
    hosts.map(async (host) => {
      if (host.getAttribute("data-elmo-done") === "1") return;
      host.setAttribute("data-elmo-done", "1");
      try {
        const source = decodeB64(host.getAttribute("data-elmo-src") ?? "");
        const { svg } = await render(source, resolve ? { resolve } : {});
        host.innerHTML = svg;
      } catch (err) {
        const pre = document.createElement("pre");
        pre.className = "elmo-diagram-error";
        pre.textContent = `elmo error:\n${err instanceof Error ? err.message : String(err)}`;
        host.innerHTML = "";
        host.appendChild(pre);
      }
    }),
  );
}

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app, router }) {
    app.component("ElmoPlayground", ElmoPlayground);
    if (typeof window === "undefined") return;
    const rerender = () => window.setTimeout(renderElmoBlocks, 0);
    const prev = router.onAfterRouteChanged;
    router.onAfterRouteChanged = (to) => {
      prev?.(to);
      rerender();
    };
    rerender();
  },
};

export default theme;
