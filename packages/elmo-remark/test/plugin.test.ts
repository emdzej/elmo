import { describe, expect, it } from "vitest";
import type { Root } from "mdast";
import remarkElmo from "../src/index.js";

// Build a minimal mdast tree with a code node and run the transformer directly,
// avoiding a full unified stringify chain.
function tree(lang: string, value: string): Root {
  return { type: "root", children: [{ type: "code", lang, meta: null, value }] };
}

describe("remark plugin", () => {
  it("replaces an elmo code node with an inline-svg html node", async () => {
    const root = tree("elmo", "part R1 res 10k\npart R2 res 4k7\nnet s = R1.2 R2.1");
    await remarkElmo()(root);
    const node = root.children[0]!;
    expect(node.type).toBe("html");
    expect((node as { value: string }).value).toContain('<div class="elmo-diagram">');
    expect((node as { value: string }).value).toContain("<svg");
  });

  it("leaves non-elmo code nodes untouched", async () => {
    const root = tree("js", "const x = 1;");
    await remarkElmo()(root);
    expect(root.children[0]!.type).toBe("code");
  });

  it("emits an error html node for invalid elmo", async () => {
    const root = tree("elmo", "net x = R1.1 U9.2");
    await remarkElmo()(root);
    const node = root.children[0] as { type: string; value: string };
    expect(node.type).toBe("html");
    expect(node.value).toContain("elmo-diagram-error");
    expect(node.value).toContain("unknown component");
  });

  it("honours a custom language", async () => {
    const root = tree("circuit", "part R1 res 10k\npart R2 res 1k\nnet s = R1.2 R2.1");
    await remarkElmo({ language: "circuit" })(root);
    expect(root.children[0]!.type).toBe("html");
  });

  it("resolves imports from a virtual files map", async () => {
    const root = tree("elmo", 'import "psu.elmo" as psu\npart R1 res 1k\nnet n = psu.U1.1 R1.1');
    await remarkElmo({ files: { "psu.elmo": "part U1 res 4k7" } })(root);
    const node = root.children[0] as { type: string; value: string };
    expect(node.type).toBe("html");
    expect(node.value).toContain("<svg");
    expect(node.value).not.toContain("elmo-diagram-error");
  });
});
