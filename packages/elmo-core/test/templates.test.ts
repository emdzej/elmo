import { describe, expect, it } from "vitest";
import { parse, render, mapResolver } from "../src/index.js";

const LIB = `
def NE555 ic pkg=DIP-8 {
  left 2:TRIG 6:THRES 7:DISCH
  right 3:OUT 4:~RESET
  top 8:VCC
  bottom 1:GND
}
`;

describe("part templates (def)", () => {
  it("instantiates a template, inheriting pins/attrs and defaulting the label to the name", () => {
    const { schematic, diagnostics } = parse(`${LIB}\npart U1 NE555`);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const u1 = schematic.components.find((c) => c.ref === "U1")!;
    expect(u1.kind).toBe("ic"); // resolved to the base built-in kind
    expect(u1.value).toBe("NE555"); // template name is the default label
    expect(u1.attrs.pkg).toBe("DIP-8"); // inherited attr
    expect(u1.pins).toHaveLength(7); // inherited pins
  });

  it("instances override attrs and label", () => {
    const { schematic } = parse(`${LIB}\npart U2 NE555 pkg=SOIC-8 "timer"`);
    const u2 = schematic.components.find((c) => c.ref === "U2")!;
    expect(u2.attrs.pkg).toBe("SOIC-8");
    expect(u2.value).toBe("timer");
  });

  it("reuses a template many times without repetition", () => {
    const { schematic } = parse(`${LIB}\npart U1 NE555\npart U2 NE555\npart U3 NE555`);
    const ics = schematic.components.filter((c) => c.kind === "ic");
    expect(ics).toHaveLength(3);
    expect(ics.every((c) => c.pins.length === 7)).toBe(true);
  });

  it("resolves templates from an imported, namespaced library", () => {
    const files = { "lib.elmo": `def REG ic "AMS1117" pkg=SOT-223 { left 3:IN right 2:OUT bottom 1:GND }` };
    const { schematic, diagnostics } = parse('import "lib.elmo" as lib\npart U9 lib.REG', { resolve: mapResolver(files) });
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const u9 = schematic.components.find((c) => c.ref === "U9")!;
    expect(u9.kind).toBe("ic");
    expect(u9.value).toBe("AMS1117"); // def's explicit value
    expect(u9.pins).toHaveLength(3);
  });

  it("errors when a def shadows a built-in kind", () => {
    const { diagnostics } = parse("def res ic { left 1:A }");
    expect(diagnostics.some((d) => d.severity === "error" && d.message.includes("shadows a built-in"))).toBe(true);
  });

  it("renders template instances end-to-end", async () => {
    const { svg } = await render(`${LIB}\npart U1 NE555\npart R1 res 1k\nnet n = U1.OUT R1.1`);
    expect(svg).not.toContain("NaN");
    expect(svg).toContain("NE555");
  });
});
