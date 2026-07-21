// remark (unified) plugin: renders ```elmo fenced code blocks into inline SVG.
//
//   import { unified } from "unified";
//   import remarkParse from "remark-parse";
//   import remarkRehype from "remark-rehype";
//   import rehypeStringify from "rehype-stringify";
//   import remarkElmo from "@emdzej/elmo-remark";
//
//   const html = await unified()
//     .use(remarkParse)
//     .use(remarkElmo)
//     .use(remarkRehype, { allowDangerousHtml: true })
//     .use(rehypeStringify, { allowDangerousHtml: true })
//     .process(markdownSource);
//
// elmo's layout is async; remark transformers may be async, so each elmo code
// node is replaced in place with an mdast `html` node holding the rendered SVG.

import { render, mapResolver, escapeHtml, type ImportResolver } from "@emdzej/elmo-core";
import { visit } from "unist-util-visit";
import type { Code, Html, Root } from "mdast";

export interface RemarkElmoOptions {
  language?: string; // fenced code lang that triggers rendering; default "elmo"
  wrapperClass?: string; // wrapper element class; default "elmo-diagram"
  resolve?: ImportResolver; // resolve `import` statements
  files?: Record<string, string>; // virtual file map (sugar for a mapResolver)
}

export default function remarkElmo(options: RemarkElmoOptions = {}) {
  const language = options.language ?? "elmo";
  const wrapperClass = options.wrapperClass ?? "elmo-diagram";
  const resolve = options.resolve ?? (options.files ? mapResolver(options.files) : undefined);

  return async (tree: Root): Promise<void> => {
    const targets: Code[] = [];
    visit(tree, "code", (node: Code) => {
      if ((node.lang ?? "") === language) targets.push(node);
    });

    await Promise.all(
      targets.map(async (node) => {
        const html = node as unknown as Html;
        try {
          const { svg } = await render(node.value, resolve ? { resolve } : {});
          html.type = "html";
          html.value = `<div class="${wrapperClass}">${svg}</div>`;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          html.type = "html";
          html.value = `<pre class="${wrapperClass}-error"><code>elmo error:\n${escapeHtml(message)}</code></pre>`;
        }
        delete (node as Partial<Code>).lang;
        delete (node as Partial<Code>).meta;
      }),
    );
  };
}
