import { describe, expect, it } from "vitest";
import MarkdownIt from "markdown-it";
import elmo, { renderElmo } from "../src/index.js";

const md = new MarkdownIt().use(elmo);

describe("markdown-it plugin", () => {
  it("renders an elmo fence into an inline svg (async two-phase)", async () => {
    const src = ["```elmo", "part R1 res 10k", "part R2 res 4k7", "net s = R1.2 R2.1", "```"].join("\n");
    const out = await renderElmo(md, src);
    expect(out).toContain('<div class="elmo-diagram">');
    expect(out).toContain("<svg");
    expect(out).toContain("</svg>");
  });

  it("leaves other fenced code blocks untouched", async () => {
    const out = await renderElmo(md, "```js\nconst x = 1;\n```");
    expect(out).toContain("<code");
    expect(out).not.toContain("elmo-diagram");
  });

  it("emits an error block for invalid elmo", async () => {
    const out = await renderElmo(md, "```elmo\nnet x = R1.1 U9.2\n```");
    expect(out).toContain("elmo-diagram-error");
    expect(out).toContain("unknown component");
  });

  it("emits a pending placeholder if md.render is called without the async pre-pass", () => {
    const out = md.render("```elmo\npart R1 res 10k\n```");
    expect(out).toContain("elmo-diagram-pending");
  });

  it("resolves imports from a virtual files map", async () => {
    const src = ["```elmo", 'import "psu.elmo" as psu', "part R1 res 1k", "net n = psu.U1.1 R1.1", "```"].join("\n");
    const out = await renderElmo(md, src, { files: { "psu.elmo": "part U1 res 4k7" } });
    expect(out).toContain("<svg");
    expect(out).not.toContain("elmo-diagram-error");
  });
});
