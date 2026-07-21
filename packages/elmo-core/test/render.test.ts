import { describe, expect, it } from "vitest";
import { render, parse, validate, layoutSchematic } from "../src/index.js";

const SRC = `
title "divider"
part U1 ic "MCU" { left 1:A right 2:B top 3:VCC bottom 4:GND }
part R1 res 10k
power VCC = U1.VCC R1.1
gnd GND = U1.GND
net sig = U1.A R1.2
`;

describe("render", () => {
  it("produces a well-formed svg with a viewBox and no NaN", async () => {
    const { svg } = await render(SRC);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain("viewBox=");
    expect(svg).not.toContain("NaN");
    expect(svg).toContain("U1");
    expect(svg).toContain("VCC");
  });

  it("draws a 2-member signal net as a routed wire (polyline)", async () => {
    const { svg } = await render(SRC);
    expect(svg).toContain("<polyline");
  });

  it("rejects with ElmoError on an unknown component reference", async () => {
    await expect(render("part R1 res 10k\nnet x = R1.1 U9.2")).rejects.toThrow(/unknown component 'U9'/);
  });

  it("warns on an unknown kind (typo'd or out-of-scope template)", () => {
    const { schematic } = parse('part U5 NE555 show="TRIG OUT"'); // no def NE555 in scope
    const warnings = validate(schematic).filter((d) => d.message.includes("unknown kind"));
    expect(warnings.some((w) => w.message.includes("NE555"))).toBe(true);
  });

  it("reports net diagnostics at the offending source line (not line 0)", () => {
    const src = "part R1 res 10k\npart R2 res 10k\n\nnet bad = R1.9 R2.1";
    const errs = validate(parse(src).schematic).filter((d) => d.severity === "error");
    const e = errs.find((d) => d.message.includes("no pin"))!;
    expect(e.line).toBe(4); // the `net bad` line
    expect(e.col).toBeGreaterThan(0);
  });

  it("warns on a single-member net", () => {
    const { schematic } = parse("part R1 res 10k\nnet lonely = R1.1");
    const warnings = validate(schematic).filter((d) => d.severity === "warning");
    expect(warnings.some((w) => w.message.includes("single member"))).toBe(true);
  });

  it("renders `mod`/`module` as an ic-style box", async () => {
    const { svg } = await render('part U1 mod "Pi Pico" { left 1:GP0 right 2:VBUS }');
    expect(svg).toContain('class="elmo-body"');
    expect(svg).toContain("Pi Pico");
  });

  it("draws a junction dot where a routed net tees (3+ members as=wire)", async () => {
    const src = [
      "part A ic { right 1:o }",
      "part B ic { left 1:i }",
      "part C ic { left 1:i }",
      "net n = A.1 B.1 C.1 as=wire",
    ].join("\n");
    const { svg } = await render(src);
    expect(svg).toContain('class="elmo-junction"');
  });

  it("merges wires that share a pin into one net (single junction, not two)", async () => {
    const src = [
      "part A ic { right 1:o }",
      "part B ic { left 1:i }",
      "part C ic { left 1:i }",
      "wire A.1 -- B.1",
      "wire A.1 -- C.1",
    ].join("\n");
    const { svg } = await render(src);
    const dots = (svg.match(/class="elmo-junction"/g) ?? []).length;
    expect(dots).toBe(1);
  });

  it("applies rotate and mirror via an affine transform, keeping unrotated identical", async () => {
    const plain = (await render("part R1 res 10k")).svg;
    const rot = (await render("part R1 res 10k\nrotate R1 90")).svg;
    const mir = (await render("part U1 opamp x\nmirror U1")).svg;
    expect(plain).toContain('transform="matrix(1 0 0 1'); // identity + translate
    expect(rot).toContain("matrix(0 1 -1 0"); // 90° rotation
    expect(mir).toContain("matrix(-1 0 0 1"); // horizontal mirror
  });

  it("honours the theme directive and the theme option", async () => {
    expect((await render("theme dark\npart R1 res 1k")).svg).toContain('class="elmo elmo-theme-dark"');
    expect((await render("part R1 res 1k", { theme: "mono" })).svg).toContain('class="elmo elmo-theme-mono"');
    expect((await render("part R1 res 1k")).svg).toContain('class="elmo" viewBox');
  });

  it("draws a group box with its label", async () => {
    const src = [
      "part U1 ic { right 1:o }",
      "part C1 cap 1u",
      "part R1 res 1k",
      "net n = U1.1 C1.1",
      "net m = U1.1 R1.1",
      'group "psu" { U1 C1 }',
    ].join("\n");
    const { svg } = await render(src);
    expect(svg).toContain('class="elmo-group"');
    expect(svg).toContain(">psu<");
  });

  it("makes the wire/label fan-out threshold configurable", async () => {
    // 3 members: label by default, but a wire when the threshold is raised
    const tag = 'class="elmo-taglabel"'; // the label element, not the CSS rule
    const src = "part A ic { right 1:o }\npart B ic { left 1:i }\npart C ic { left 1:i }\nnet n = A.1 B.1 C.1";
    expect((await render(src)).svg).toContain(tag); // default 3 → labels
    expect((await render(src, { labelThreshold: 4 })).svg).not.toContain(tag); // raised → wire
    // via the `set` directive
    expect((await render(`set labelThreshold=4\n${src}`)).svg).not.toContain(tag);
    // lowered so even a 2-member net becomes a label
    expect((await render("part A ic { right 1:o }\npart B ic { left 1:i }\nnet n = A.1 B.1", { labelThreshold: 2 })).svg).toContain(tag);
  });

  it("renders the ref as a hyperlink when link= is set (before or after pin block)", async () => {
    const a = (await render('part R1 res 10k link="http://foo.bar"')).svg;
    expect(a).toContain('<a href="http://foo.bar" target="_blank"');
    const b = (await render('part U1 ic { right 1:o } link=http://x.y')).svg;
    expect(b).toContain('<a href="http://x.y"');
  });

  it("rejects unsafe link schemes (no javascript:/data: href, no <a>)", async () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "vbscript:x"]) {
      const { svg } = await render(`part R1 res 10k link="${bad}"`);
      expect(svg).not.toContain("<a ");
      expect(svg).not.toContain(bad);
    }
    // relative and mailto links are allowed
    expect((await render('part R1 res 10k link="./ds.pdf"')).svg).toContain('<a href="./ds.pdf"');
    expect((await render('part R1 res 10k link="mailto:a@b.co"')).svg).toContain("mailto:a@b.co");
  });

  it("warns (not errors) on a malformed `set` token", async () => {
    const { schematic, diagnostics } = parse("set foo\npart R1 res 1k");
    const all = [...diagnostics];
    expect(all.some((d) => d.severity === "warning" && d.message.includes("set:"))).toBe(true);
    expect(all.some((d) => d.severity === "error")).toBe(false);
    expect(schematic.components).toHaveLength(1); // still parses the rest
  });

  it("honours a `place right-of` hint", async () => {
    const { schematic } = parse(
      "part U1 ic { right 1:o }\npart J1 connector { 1:a }\nnet n = U1.1 J1.1\nplace J1 right-of U1",
    );
    const { layout } = await layoutSchematic(schematic);
    expect(layout.byRef.get("J1")!.x).toBeGreaterThan(layout.byRef.get("U1")!.x);
  });

  it("honours a `place above` hint", async () => {
    const { schematic } = parse(
      "part U1 ic { right 1:o }\npart J1 connector { 1:a }\nnet n = U1.1 J1.1\nplace J1 above U1",
    );
    const { layout } = await layoutSchematic(schematic);
    expect(layout.byRef.get("J1")!.y).toBeLessThan(layout.byRef.get("U1")!.y);
  });
});
