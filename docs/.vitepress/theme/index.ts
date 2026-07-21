import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { render } from "@emdzej/elmo-core";
import "./elmo.css";

// Render every elmo block (an inert <script type="application/elmo">) to SVG in
// the browser. Runs after each route change; each block renders once.
async function renderElmoBlocks(): Promise<void> {
  if (typeof document === "undefined") return;
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/elmo"]'));
  await Promise.all(
    scripts.map(async (script) => {
      const host = script.parentElement;
      if (!host || host.getAttribute("data-elmo-done") === "1") return;
      host.setAttribute("data-elmo-done", "1");
      try {
        const { svg } = await render(script.textContent ?? "");
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
  enhanceApp({ router }) {
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
