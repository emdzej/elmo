import { describe, expect, it } from "vitest";
import { parse } from "../src/index.js";

const SRC = `
title "555 astable"

part U1 ic "NE555" pkg=DIP-8 {
  left  2:TRIG  6:THRES  7:DISCH
  right 3:OUT   4:~RESET
  top   8:VCC
  bottom 1:GND
}
part R1 res 10k tol=1%
part C1 cap 10u pol=yes

power VCC = U1.VCC U1.~RESET R1.1
gnd   GND = U1.GND C1.-
net n_thres = U1.THRES U1.TRIG C1.+
wire U1.OUT -> R1.1
`;

describe("parse", () => {
  const { schematic, diagnostics } = parse(SRC);

  it("has no parse errors", () => {
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("reads the title", () => {
    expect(schematic.title).toBe("555 astable");
  });

  it("parses components with kind and value", () => {
    expect(schematic.components.map((c) => c.ref)).toEqual(["U1", "R1", "C1"]);
    const u1 = schematic.components.find((c) => c.ref === "U1")!;
    expect(u1.kind).toBe("ic");
    expect(u1.value).toBe("NE555");
    expect(u1.attrs.pkg).toBe("DIP-8");
  });

  it("keeps pkg as opaque metadata", () => {
    const r1 = schematic.components.find((c) => c.ref === "R1")!;
    expect(r1.value).toBe("10k");
    expect(r1.attrs.tol).toBe("1%");
  });

  it("parses ic pins with number, name, and side", () => {
    const u1 = schematic.components.find((c) => c.ref === "U1")!;
    const trig = u1.pins.find((p) => p.name === "TRIG")!;
    expect(trig.number).toBe("2");
    expect(trig.side).toBe("left");
    expect(u1.pins.find((p) => p.name === "VCC")!.side).toBe("top");
    expect(u1.pins.find((p) => p.name === "GND")!.side).toBe("bottom");
  });

  it("gives two-terminal parts implicit pins with aliases", () => {
    const c1 = schematic.components.find((c) => c.ref === "C1")!;
    expect(c1.pins.map((p) => p.number)).toEqual(["1", "2"]);
    expect(c1.pins[0]!.aliases).toContain("+");
  });

  it("classifies net kinds", () => {
    const kinds = Object.fromEntries(schematic.nets.filter((n) => !n.synthetic).map((n) => [n.name, n.kind]));
    expect(kinds.VCC).toBe("power");
    expect(kinds.GND).toBe("gnd");
    expect(kinds.n_thres).toBe("signal");
  });

  it("parses a wire into a synthetic 2-member net", () => {
    const w = schematic.nets.find((n) => n.synthetic)!;
    expect(w.members).toEqual([
      { ref: "U1", pin: "OUT" },
      { ref: "R1", pin: "1" },
    ]);
  });
});
