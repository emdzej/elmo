import { defineConfig } from "vitepress";

// elmo fenced blocks are emitted as an inert <script> holding the source; the
// theme renders them to SVG in the browser (elmo's layout is async).
export default defineConfig({
  title: "elmo",
  description: "Electronics modeling, schematics as code — a text DSL that renders as schematics.",
  cleanUrls: true,
  head: [["link", { rel: "icon", href: "/favicon.svg" }]],
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Language", link: "/language-spec" },
      { text: "Symbols", link: "/symbols" },
      { text: "Examples", link: "/examples" },
    ],
    sidebar: {
      "/": [
        {
          text: "Guide",
          items: [
            { text: "Introduction", link: "/guide/introduction" },
            { text: "Install", link: "/guide/install" },
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "How-to", link: "/guide/how-to" },
          ],
        },
        {
          text: "Reference",
          items: [
            { text: "Language spec", link: "/language-spec" },
            { text: "Symbol catalogue", link: "/symbols" },
            { text: "Examples", link: "/examples" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: "https://github.com/emdzej/elmo" }],
    search: { provider: "local" },
  },
  markdown: {
    config(md) {
      const fence = md.renderer.rules.fence!;
      md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
        const token = tokens[idx];
        if (token && (token.info ?? "").trim().split(/\s+/)[0] === "elmo") {
          // Base64 the source into a data attribute — its charset (A-Za-z0-9+/=)
          // survives VitePress/Vue HTML escaping intact, unlike raw quotes/angle
          // brackets which get entity-encoded. The theme decodes and renders it.
          const b64 = Buffer.from(token.content, "utf8").toString("base64");
          // highlight the source as plain text (shiki has no `elmo` grammar)
          token.info = "text";
          const source = fence(tokens, idx, opts, env, self);
          token.info = "elmo";
          return `<div class="elmo-example"><div class="elmo-source">${source}</div><div class="elmo-diagram" data-elmo-src="${b64}"></div></div>\n`;
        }
        return fence(tokens, idx, opts, env, self);
      };
    },
  },
});
