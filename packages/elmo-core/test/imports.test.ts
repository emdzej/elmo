import { describe, expect, it } from "vitest";
import { parse, netlist, mapResolver, type ImportResolver } from "../src/index.js";

// in-memory file system for resolver-driven tests
function resolver(files: Record<string, string>): ImportResolver {
  return (spec) => (spec in files ? { path: spec, source: files[spec]! } : null);
}

describe("imports", () => {
  it("flattens a default (unnamespaced) import", () => {
    const files = {
      "psu.elmo": "part U2 ic { right 1:OUT }\ngnd GND = U2.1",
    };
    const { schematic, diagnostics } = parse('import "psu.elmo"\npart R1 res 1k', { resolve: resolver(files) });
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(schematic.components.map((c) => c.ref).sort()).toEqual(["R1", "U2"]);
  });

  it("prefixes refs and signal nets in a named namespace, keeps rails global", () => {
    const files = {
      "amp.elmo": "part U1 opamp x\nnet fb = U1.out U1.-\ngnd GND = U1.V-",
    };
    const { schematic } = parse('import "amp.elmo" as amp\npart R1 res 1k', { resolve: resolver(files) });
    expect(schematic.components.map((c) => c.ref)).toContain("amp.U1");
    const netNames = schematic.nets.map((n) => n.name);
    expect(netNames).toContain("amp.fb"); // signal net namespaced
    expect(netNames).toContain("GND"); // rail stays global
  });

  it("resolves a cross-namespace pin reference (foo.R1.2)", () => {
    const files = { "sub.elmo": "part R1 res 1k" };
    const { schematic, diagnostics } = parse(
      'import "sub.elmo" as sub\npart U1 ic { right 1:o }\nwire U1.o -- sub.R1.2',
      { resolve: resolver(files) },
    );
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const w = schematic.nets.find((n) => n.synthetic)!;
    expect(w.members).toContainEqual({ ref: "sub.R1", pin: "2" });
  });

  it("last declaration wins with a warning on re-declared refs", () => {
    const files = { "a.elmo": "part R1 res 1k" };
    const { schematic, diagnostics } = parse('import "a.elmo"\npart R1 res 999k', { resolve: resolver(files) });
    expect(schematic.components.filter((c) => c.ref === "R1")).toHaveLength(1);
    expect(schematic.components.find((c) => c.ref === "R1")!.value).toBe("999k"); // local wins
    expect(diagnostics.some((d) => d.severity === "warning" && d.message.includes("redeclared"))).toBe(true);
  });

  it("flattens transitive imports", () => {
    const files = {
      "leaf.elmo": "part L1 led",
      "mid.elmo": 'import "leaf.elmo"\npart M1 res 1k',
    };
    const { schematic } = parse('import "mid.elmo"\npart T1 res 2k', { resolve: resolver(files) });
    expect(schematic.components.map((c) => c.ref).sort()).toEqual(["L1", "M1", "T1"]);
  });

  it("breaks import cycles with a warning", () => {
    const files = {
      "a.elmo": 'import "b.elmo"\npart A1 res 1k',
      "b.elmo": 'import "a.elmo"\npart B1 res 1k',
    };
    const { diagnostics } = parse('import "a.elmo"', { resolve: resolver(files) });
    expect(diagnostics.some((d) => d.message.includes("circular import"))).toBe(true);
  });

  it("errors on import without a resolver", () => {
    const { diagnostics } = parse('import "x.elmo"');
    expect(diagnostics.some((d) => d.severity === "error" && d.message.includes("no import resolver"))).toBe(true);
  });

  it("mapResolver resolves direct and relative keys", () => {
    const r = mapResolver({ "lib/psu.elmo": "part U1 res 1k", "a/b.elmo": "part X res 1k" });
    expect(r("lib/psu.elmo")?.source).toContain("U1");
    // relative to an importing file in a/
    expect(r("./b.elmo", "a/x.elmo")?.path).toBe("a/b.elmo");
    expect(r("nope.elmo")).toBeNull();
  });

  it("mapResolver drives imports via parse", () => {
    const { schematic, diagnostics } = parse('import "lib.elmo" as lib\npart R1 res 1k', {
      resolve: mapResolver({ "lib.elmo": "part U1 opamp x" }),
    });
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(schematic.components.map((c) => c.ref)).toContain("lib.U1");
  });

  it("merges into the netlist across namespaces", () => {
    const files = { "sub.elmo": "part R1 res 1k" };
    const { schematic } = parse(
      'import "sub.elmo" as sub\npart U1 ic { right 1:o }\nnet sig = U1.o sub.R1.1',
      { resolve: resolver(files) },
    );
    const sig = netlist(schematic).find((n) => n.name === "sig")!;
    expect(sig.connections.map((c) => c.ref).sort()).toEqual(["U1", "sub.R1"]);
  });
});
