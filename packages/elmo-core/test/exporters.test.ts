import { describe, expect, it } from "vitest";
import { parse, netlist, netlistToText, bom, bomToCsv } from "../src/index.js";

const SRC = `
part U1 ic "NE555" pkg=DIP-8 { left 2:TRIG 6:THRES right 3:OUT top 8:VCC bottom 1:GND }
part R1 res 10k pkg=0603
part R2 res 10k pkg=0603
part C1 cap 100n pkg=0603 mpn=CL10B104
power VCC = U1.VCC
gnd GND = U1.GND C1.2
wire U1.TRIG -- R1.1
wire R1.1 -- R2.1
`;

describe("netlist", () => {
  const nets = netlist(parse(SRC).schematic);

  it("merges shared-pin wires into one net with all connections", () => {
    const trig = nets.find((n) => n.connections.some((c) => c.ref === "U1" && c.pinName === "TRIG"))!;
    const refs = trig.connections.map((c) => `${c.ref}.${c.pin}`).sort();
    expect(refs).toEqual(["R1.1", "R2.1", "U1.2"]); // U1.TRIG is pin 2
  });

  it("keeps power/gnd as classified nets", () => {
    expect(nets.find((n) => n.name === "VCC")?.kind).toBe("power");
    expect(nets.find((n) => n.name === "GND")?.kind).toBe("gnd");
  });

  it("formats a text netlist", () => {
    const txt = netlistToText(nets);
    expect(txt).toContain("GND (gnd):");
    expect(txt).toContain("U1.1");
  });
});

describe("bom", () => {
  const rows = bom(parse(SRC).schematic);

  it("groups identical parts and counts quantity", () => {
    const res = rows.find((r) => r.kind === "res" && r.value === "10k")!;
    expect(res.qty).toBe(2);
    expect(res.refs).toEqual(["R1", "R2"]);
    expect(res.footprint).toBe("0603");
  });

  it("emits CSV with a header and MPN column", () => {
    const csv = bomToCsv(rows);
    expect(csv.split("\n")[0]).toBe("Refs,Qty,Kind,Value,Footprint,MPN");
    expect(csv).toContain("CL10B104");
    expect(csv).toContain("R1 R2,2,res,10k,0603");
  });
});
