import { describe, expect, it } from "vitest";
import { render } from "../src/index.js";

describe("symbol rendering", () => {
  it("draws two-terminal parts as symbols (no box, no pin-name labels)", async () => {
    const { svg } = await render("part R1 res 10k\npart C1 cap 100n\nnet a = R1.2 C1.1");
    expect(svg).toContain("elmo-sym");
    // resistor is a polyline symbol, not a rect body
    expect(svg).toContain('class="elmo-part"');
    // pin-name clutter ("1"/"2" text) suppressed for symbol kinds
    expect(svg).not.toContain(">1<");
    expect(svg).toContain("R1");
    expect(svg).toContain("10k");
  });

  it("keeps ic/connector as boxes", async () => {
    const { svg } = await render('part U1 ic "MCU" { left 1:A right 2:B }');
    expect(svg).toContain('class="elmo-body"');
  });

  it("uses the polarized cap variant when pol=yes", async () => {
    const plain = (await render("part C1 cap 100n\npart R1 res 1k\nnet a = C1.1 R1.1")).svg;
    const polar = (await render("part C1 cap 10u pol=yes\npart R1 res 1k\nnet a = C1.1 R1.1")).svg;
    // polarized variant adds a "+" marker
    expect(polar).toContain("+");
    expect(polar.length).not.toBe(plain.length);
  });

  it("renders every discrete kind without NaN", async () => {
    const src = [
      "part Q1 npn 2N3904",
      "part Q2 pnp 2N3906",
      "part M1 nmos 2N7000",
      "part D1 diode 1N4148",
      "part D2 led red",
      "part L1 ind 4u7",
      "part U1 opamp LM358",
      "net a = Q1.C Q2.C M1.D D1.anode D2.anode L1.1 U1.out",
    ].join("\n");
    const { svg } = await render(src);
    expect(svg).not.toContain("NaN");
    expect(svg).toContain("elmo-sym");
  });

  const ALL_KINDS = [
    "res", "cap", "ind", "ferrite", "fuse", "crystal", "thermistor", "varistor",
    "rheostat", "pot", "transformer", "diode", "led", "zener", "schottky", "tvs",
    "photodiode", "varactor", "bridge", "npn", "pnp", "darlington", "phototransistor",
    "igbt", "nmos", "pmos", "nmos_dep", "pmos_dep", "njfet", "pjfet", "opamp",
    "vsource", "isource", "acsource", "battery", "lamp", "motor", "speaker", "buzzer",
    "switch_spst", "switch_spdt", "pushbutton", "relay", "antenna",
  ];

  it.each(ALL_KINDS)("renders %s as a symbol (no box, no NaN)", async (kind) => {
    const { svg } = await render(`part X1 ${kind}`);
    expect(svg).not.toContain("NaN");
    expect(svg).toContain("elmo-sym");
    expect(svg).not.toContain('class="elmo-body"'); // symbol kinds never draw the box rect
  });

  it("resolves kind aliases", async () => {
    const a = (await render("part X1 spst")).svg;
    const b = (await render("part X1 switch_spst")).svg;
    // both produce the SPST symbol (same drawing)
    expect(a.length).toBe(b.length);
  });
});
