import { describe, expect, it } from "vitest";
import { renderToSvg } from "../src/index.js";

describe("browser entry", () => {
  it("renderToSvg returns an SVG string", async () => {
    const svg = await renderToSvg("part R1 res 10k\npart R2 res 4k7\nnet s = R1.2 R2.1");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toContain("NaN");
  });

  it("resolves imports from a files map", async () => {
    const svg = await renderToSvg('import "lib.elmo" as lib\npart R1 res 1k\nnet n = lib.U1.1 R1.1', {
      files: { "lib.elmo": "part U1 res 4k7" },
    });
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("elmo error");
  });

  it("rejects an unsafe link scheme end-to-end", async () => {
    const svg = await renderToSvg('part R1 res 10k link="javascript:alert(1)"');
    expect(svg).not.toContain("<a ");
    expect(svg).not.toContain("javascript:");
  });
});
