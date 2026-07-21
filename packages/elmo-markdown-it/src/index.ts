// markdown-it plugin: renders ```elmo fenced code blocks into inline SVG.
//
// elmo's layout runs on elkjs and is async, but markdown-it's render() is sync.
// So this is a two-phase plugin: call `renderElmo(md, src)` (async) — it
// pre-renders every elmo fence into an env cache, then runs md.render() whose
// fence rule reads the cache synchronously.
//
//   import MarkdownIt from "markdown-it";
//   import elmo, { renderElmo } from "@emdzej/elmo-markdown-it";
//   const md = new MarkdownIt().use(elmo);
//   const html = await renderElmo(md, markdownSource);
//
// A plain md.render() without the pre-pass emits a graceful placeholder.

import { render, mapResolver, escapeHtml, type ImportResolver } from "@emdzej/elmo-core";
import type MarkdownIt from "markdown-it";

export interface ElmoPluginOptions {
  language?: string; // fence info string that triggers rendering; default "elmo"
  wrapperClass?: string; // wrapper element class; default "elmo-diagram"
}

interface ElmoEnv {
  elmoSvgs?: Map<string, string>;
  elmoErrors?: Map<string, string>;
}

const fenceLang = (info: string): string => info.trim().split(/\s+/)[0] ?? "";

export default function elmoPlugin(md: MarkdownIt, options: ElmoPluginOptions = {}): void {
  const language = options.language ?? "elmo";
  const wrapperClass = options.wrapperClass ?? "elmo-diagram";
  const defaultFence = md.renderer.rules.fence?.bind(md.renderer);

  md.renderer.rules.fence = (tokens, idx, opts, env: ElmoEnv, self) => {
    const token = tokens[idx];
    if (!token || fenceLang(token.info) !== language) {
      return defaultFence ? defaultFence(tokens, idx, opts, env, self) : self.renderToken(tokens, idx, opts);
    }
    const svg = env?.elmoSvgs?.get(token.content);
    if (svg) return `<div class="${wrapperClass}">${svg}</div>\n`;
    const error = env?.elmoErrors?.get(token.content);
    if (error) return `<pre class="${wrapperClass}-error"><code>elmo error:\n${escapeHtml(error)}</code></pre>\n`;
    // not pre-rendered — caller used md.render() directly instead of renderElmo()
    return `<pre class="${wrapperClass}-pending"><code>${escapeHtml(token.content)}</code></pre>\n`;
  };
}

/**
 * Async render: pre-renders every ```elmo fence in `src`, then runs md.render().
 * Returns the final HTML with diagrams inlined as SVG.
 */
export async function renderElmo(
  md: MarkdownIt,
  src: string,
  opts: { language?: string; env?: ElmoEnv; resolve?: ImportResolver; files?: Record<string, string> } = {},
): Promise<string> {
  const language = opts.language ?? "elmo";
  const env: ElmoEnv = opts.env ?? {};
  const resolve = opts.resolve ?? (opts.files ? mapResolver(opts.files) : undefined);
  const tokens = md.parse(src, env);
  const svgs = new Map<string, string>();
  const errors = new Map<string, string>();

  await Promise.all(
    tokens
      .filter((t) => t.type === "fence" && fenceLang(t.info) === language)
      .map(async (t) => {
        try {
          const { svg } = await render(t.content, resolve ? { resolve } : {});
          svgs.set(t.content, svg);
        } catch (err) {
          errors.set(t.content, err instanceof Error ? err.message : String(err));
        }
      }),
  );

  env.elmoSvgs = svgs;
  env.elmoErrors = errors;
  return md.render(src, env);
}
