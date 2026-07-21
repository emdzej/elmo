// SVG emitter. Renders the placed schematic. M1 rendering rules:
//  - power nets  → power-rail flag at each member pin (never routed)
//  - gnd nets    → ground symbol at each member pin (never routed)
//  - signal nets → routed L-wire when 2 members, net labels when ≥3
//    (spec §5.1 fan-out rule); `as=wire|label` overrides.
// Iconic component symbols (resistor zig-zag, etc.) are M2 — here every part is
// a labeled box with pin stubs.

import type { Net, Schematic } from "./types.js";
import { layoutSchematic, placePins, resolvePin, sizeOf, type Layout, type PlacedComponent, type PlacedPin, type Vec } from "./layout.js";
import { netMode, labelThreshold } from "./nets.js";
import { normalizeNets } from "./normalize.js";
import { KINDS } from "./kinds.js";
import { SYMBOLS } from "./symbols.js";

export interface RenderOptions {
  /** Emitted as the root <svg> class; drives theming. Default "elmo". */
  className?: string;
  /** Force a palette ("light" | "dark" | "mono"); overrides the `theme` directive. */
  theme?: string;
  /** Fan-out at which a signal net renders as labels not a wire. Overrides the
   * `set labelThreshold=N` directive. Default 3. */
  labelThreshold?: number;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const n = (x: number): string => (Math.round(x * 100) / 100).toString();

function anchorFor(d: Vec): "start" | "end" | "middle" {
  if (d.x > 0.5) return "start";
  if (d.x < -0.5) return "end";
  return "middle";
}

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (v: Vec, k: number): Vec => ({ x: v.x * k, y: v.y * k });
const perp = (d: Vec): Vec => ({ x: -d.y, y: d.x });

function line(a: Vec, b: Vec, cls = "elmo-wire"): string {
  return `<line class="${cls}" x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}"/>`;
}

function text(s: string, p: Vec, cls: string, anchor: string): string {
  return `<text class="${cls}" x="${n(p.x)}" y="${n(p.y)}" text-anchor="${anchor}" dominant-baseline="middle">${esc(s)}</text>`;
}

/** Wrap the ref label in an SVG hyperlink when the part has a `link=` attribute. */
function linkWrap(attrs: Record<string, string>, inner: string): string {
  const href = attrs.link;
  return href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>` : inner;
}

function hAnchor(dir: Vec, pos: "in" | "out"): string {
  if (Math.abs(dir.x) <= Math.abs(dir.y)) return "middle";
  const outward = dir.x > 0;
  return pos === "in" ? (outward ? "end" : "start") : outward ? "start" : "end";
}

function renderComponent(pc: PlacedComponent): string {
  const isBox = KINDS[pc.comp.kind]?.explicitPins ?? false;
  const symbolFn = isBox ? undefined : SYMBOLS[pc.comp.kind];
  const hasTopVis = pc.pins.some((p) => p.dir.y < -0.5); // a pin pointing up (visually)

  // geometry is drawn in the local frame and mapped to world by pc.transform;
  // text is drawn upright in the world frame so it never rotates.
  const { w, h, sides } = sizeOf(pc.comp);
  const localPc: PlacedComponent = {
    comp: pc.comp,
    x: 0,
    y: 0,
    w,
    h,
    pins: placePins(pc.comp, 0, 0, w, h, sides),
    transform: "",
  };

  const world: string[] = [];
  let geometry: string;
  if (symbolFn) {
    geometry = symbolFn(localPc);
    // ref/value stacked just above the symbol (value nearest, ref above it). Parts
    // with a top-pointing pin (e.g. op-amp V+) get the block moved to the top-left.
    const anchor = hasTopVis ? "start" : "middle";
    const lx = hasTopVis ? pc.x : pc.x + pc.w / 2;
    const vy = pc.y - (hasTopVis ? 30 : 6);
    if (pc.comp.value) {
      world.push(linkWrap(pc.comp.attrs, text(pc.comp.ref, { x: lx, y: vy - 12 }, "elmo-ref", anchor)));
      world.push(text(pc.comp.value, { x: lx, y: vy }, "elmo-value", anchor));
    } else {
      world.push(linkWrap(pc.comp.attrs, text(pc.comp.ref, { x: lx, y: vy }, "elmo-ref", anchor)));
    }
  } else {
    geometry = `<rect class="elmo-body" x="0" y="0" width="${n(w)}" height="${n(h)}" rx="3"/>`;
    const ly = pc.y - (hasTopVis ? 48 : 8);
    world.push(linkWrap(pc.comp.attrs, text(pc.comp.ref, { x: pc.x, y: ly }, "elmo-ref", "start")));
    if (pc.comp.value) world.push(text(pc.comp.value, { x: pc.x + pc.comp.ref.length * 8 + 6, y: ly }, "elmo-value", "start"));
    for (const pp of pc.pins) {
      world.push(line(pp.edge, pp.stub, "elmo-pin"));
      world.push(text(pp.pin.name, add(pp.edge, scale(pp.dir, -5)), "elmo-pinname", hAnchor(pp.dir, "in")));
      if (pp.pin.number) {
        const numPos = add(add(pp.stub, scale(pp.dir, -3)), { x: 0, y: -6 });
        world.push(text(pp.pin.number, numPos, "elmo-pinnum", hAnchor(pp.dir, "out")));
      }
    }
  }
  return `<g class="elmo-part"><g transform="${pc.transform}">${geometry}</g>${world.join("")}</g>`;
}

function renderPower(pp: PlacedPin, name: string): string {
  const d = pp.dir;
  const pe = perp(d);
  const q = add(pp.stub, scale(d, 8));
  const barA = add(q, scale(pe, 9));
  const barB = add(q, scale(pe, -9));
  const labelPos = add(q, scale(d, 7));
  return [
    line(pp.stub, q, "elmo-net"),
    line(barA, barB, "elmo-net"),
    text(name, labelPos, "elmo-powerlabel", anchorFor(d)),
  ].join("");
}

function renderGnd(pp: PlacedPin, name: string, showLabel: boolean): string {
  const d = pp.dir;
  const pe = perp(d);
  const q = add(pp.stub, scale(d, 6));
  const bars = [16, 10, 4];
  const out: string[] = [line(pp.stub, q, "elmo-net")];
  bars.forEach((wdt, k) => {
    const c = add(q, scale(d, k * 4));
    out.push(line(add(c, scale(pe, wdt / 2)), add(c, scale(pe, -wdt / 2)), "elmo-net"));
  });
  if (showLabel) out.push(text(name, add(q, scale(d, 22)), "elmo-gndlabel", anchorFor(d)));
  return out.join("");
}

function renderNetLabel(pp: PlacedPin, name: string): string {
  const d = pp.dir;
  const q = add(pp.stub, scale(d, 6));
  const w = name.length * 6.5 + 12;
  const h = 15;
  // tag anchored so it grows outward from the pin
  const anchor = anchorFor(d);
  let boxX = q.x;
  if (anchor === "end") boxX = q.x - w;
  else if (anchor === "middle") boxX = q.x - w / 2;
  const boxY = q.y - h / 2;
  return [
    line(pp.stub, q, "elmo-net"),
    `<rect class="elmo-taglabel" x="${n(boxX)}" y="${n(boxY)}" width="${n(w)}" height="${n(h)}" rx="7"/>`,
    text(name, { x: boxX + w / 2, y: q.y }, "elmo-nettext", "middle"),
  ].join("");
}

function renderRoute(poly: Vec[]): string {
  const pts = poly.map((p) => `${n(p.x)},${n(p.y)}`).join(" ");
  return `<polyline class="elmo-wire" fill="none" points="${pts}"/>`;
}

/** Fallback L-route between two pins when ELK produced no route (e.g. same node). */
function fallbackWire(a: PlacedPin, b: PlacedPin): string {
  const pts = [a.stub, { x: b.stub.x, y: a.stub.y }, b.stub].map((p) => `${n(p.x)},${n(p.y)}`).join(" ");
  return `<polyline class="elmo-wire" fill="none" points="${pts}"/>`;
}

/** Routed wire segments for a wire-mode net (drawn first, under components). */
function renderWireNet(net: Net, lyt: Layout, routes: Map<Net, Vec[][]>): string {
  const rs = routes.get(net);
  if (rs && rs.length) return rs.map(renderRoute).join("");
  const pins = net.members
    .map((m) => resolvePin(lyt, m.ref, m.pin))
    .filter((p): p is PlacedPin => p !== undefined);
  return pins.length >= 2 ? fallbackWire(pins[0]!, pins[1]!) : "";
}

/** Power/ground symbols and net labels (drawn after components, at pins). */
function renderNetDecoration(net: Net, lyt: Layout, threshold: number): string {
  const pins = net.members
    .map((m) => resolvePin(lyt, m.ref, m.pin))
    .filter((p): p is PlacedPin => p !== undefined);
  if (pins.length === 0) return "";
  switch (netMode(net, threshold)) {
    case "power":
      return pins.map((p) => renderPower(p, net.name)).join("");
    case "gnd":
      return pins.map((p) => renderGnd(p, net.name, net.name.toUpperCase() !== "GND")).join("");
    case "label":
      return pins.map((p) => renderNetLabel(p, net.name)).join("");
    default:
      return "";
  }
}

/** Solid dots where wires electrically tee: ELK branch points + cross-net shared pins. */
function renderJunctions(junctions: Vec[], routes: Map<Net, Vec[][]>): string {
  const key = (p: Vec) => `${Math.round(p.x)},${Math.round(p.y)}`;
  const dots = new Map<string, Vec>();
  for (const j of junctions) dots.set(key(j), j);
  // a point shared by endpoints of routes from ≥2 distinct nets is a junction too
  const netsAt = new Map<string, Set<Net>>();
  for (const [net, polys] of routes) {
    for (const poly of polys) {
      for (const end of [poly[0], poly[poly.length - 1]]) {
        if (!end) continue;
        const k = key(end);
        (netsAt.get(k) ?? netsAt.set(k, new Set()).get(k)!).add(net);
      }
    }
  }
  for (const [k, nets] of netsAt) {
    if (nets.size >= 2) {
      const [x, y] = k.split(",").map(Number);
      dots.set(k, { x: x!, y: y! });
    }
  }
  return [...dots.values()].map((p) => `<circle class="elmo-junction" cx="${n(p.x)}" cy="${n(p.y)}" r="2.6"/>`).join("");
}

const STYLE = `
.elmo{--elmo-fg:#1c1c1c;--elmo-bg:#ffffff;--elmo-accent:#b23b2e;--elmo-muted:#666;--elmo-tag:#f3f3f3;}
@media (prefers-color-scheme: dark){.elmo{--elmo-fg:#e6e6e6;--elmo-bg:#1e1e1e;--elmo-accent:#ff7a6e;--elmo-muted:#9a9a9a;--elmo-tag:#2a2a2a;}}
:root[data-theme="dark"] .elmo{--elmo-fg:#e6e6e6;--elmo-bg:#1e1e1e;--elmo-accent:#ff7a6e;--elmo-muted:#9a9a9a;--elmo-tag:#2a2a2a;}
:root[data-theme="light"] .elmo{--elmo-fg:#1c1c1c;--elmo-bg:#ffffff;--elmo-accent:#b23b2e;--elmo-muted:#666;--elmo-tag:#f3f3f3;}
.elmo.elmo-theme-light{--elmo-fg:#1c1c1c;--elmo-bg:#ffffff;--elmo-accent:#b23b2e;--elmo-muted:#666;--elmo-tag:#f3f3f3;}
.elmo.elmo-theme-dark{--elmo-fg:#e6e6e6;--elmo-bg:#1e1e1e;--elmo-accent:#ff7a6e;--elmo-muted:#9a9a9a;--elmo-tag:#2a2a2a;}
.elmo.elmo-theme-mono{--elmo-fg:#111;--elmo-bg:#fff;--elmo-accent:#111;--elmo-muted:#555;--elmo-tag:#fff;}
.elmo .elmo-body{fill:var(--elmo-bg);stroke:var(--elmo-fg);stroke-width:1.5;}
.elmo .elmo-pin,.elmo .elmo-net,.elmo .elmo-wire{stroke:var(--elmo-fg);stroke-width:1.2;fill:none;}
.elmo .elmo-sym{stroke:var(--elmo-fg);stroke-width:1.5;fill:none;stroke-linejoin:round;stroke-linecap:round;}
.elmo .elmo-sym-fill{stroke:var(--elmo-fg);stroke-width:1;fill:var(--elmo-fg);}
.elmo .elmo-symtext{fill:var(--elmo-fg);font:600 10px ui-sans-serif,system-ui,sans-serif;dominant-baseline:middle;}
.elmo .elmo-dash{stroke:var(--elmo-muted);stroke-width:1;stroke-dasharray:2 2;}
.elmo .elmo-ref{fill:var(--elmo-fg);font:700 12px ui-sans-serif,system-ui,sans-serif;}
.elmo .elmo-value{fill:var(--elmo-muted);font:400 10px ui-sans-serif,system-ui,sans-serif;}
.elmo .elmo-pinname{fill:var(--elmo-fg);font:400 10px ui-monospace,monospace;}
.elmo .elmo-pinnum{fill:var(--elmo-muted);font:400 8px ui-monospace,monospace;}
.elmo .elmo-powerlabel,.elmo .elmo-gndlabel{fill:var(--elmo-accent);font:600 9px ui-monospace,monospace;}
.elmo .elmo-taglabel{fill:var(--elmo-tag);stroke:var(--elmo-accent);stroke-width:1;}
.elmo .elmo-nettext{fill:var(--elmo-accent);font:600 9px ui-monospace,monospace;}
.elmo .elmo-title{fill:var(--elmo-fg);font:700 15px ui-sans-serif,system-ui,sans-serif;}
.elmo .elmo-junction{fill:var(--elmo-fg);stroke:none;}
.elmo .elmo-group{fill:none;stroke:var(--elmo-muted);stroke-width:1;stroke-dasharray:5 4;}
.elmo .elmo-grouplabel{fill:var(--elmo-muted);font:600 11px ui-sans-serif,system-ui,sans-serif;}
.elmo a text{fill:var(--elmo-accent);text-decoration:underline;cursor:pointer;}
.elmo text{paint-order:stroke;stroke:var(--elmo-bg);stroke-width:3px;stroke-linejoin:round;}
`.trim();

const PAD = 56; // outer margin, leaves room for overhanging labels/power/gnd glyphs

export async function renderSchematic(input: Schematic, opts: RenderOptions = {}): Promise<string> {
  const schematic = normalizeNets(input); // merge shared-pin nets before layout
  const T = labelThreshold(schematic.settings, opts.labelThreshold);
  const { layout: lyt, routes, junctions, groups } = await layoutSchematic(schematic, { labelThreshold: T });
  const base = opts.className ?? "elmo";
  // `theme dark|light|mono` forces palette regardless of viewer preference
  const theme = opts.theme ?? schematic.theme;
  const cls = theme && ["light", "dark", "mono"].includes(theme) ? `${base} elmo-theme-${theme}` : base;
  const titleH = schematic.title ? 30 : 0;
  const width = Math.max(lyt.width + PAD * 2, 120);
  const height = lyt.height + PAD * 2 + titleH;

  const body: string[] = [];
  if (schematic.title) {
    body.push(text(schematic.title, { x: PAD, y: 20 }, "elmo-title", "start"));
  }
  body.push(`<g transform="translate(${n(PAD)} ${n(titleH + PAD)})">`);
  // z-order: group boxes (background), wires, components (opaque bodies hide
  // crossings), power/gnd/label decorations, junction dots on top.
  for (const g of groups) {
    body.push(`<rect class="elmo-group" x="${n(g.x)}" y="${n(g.y)}" width="${n(g.w)}" height="${n(g.h)}" rx="6"/>`);
    if (g.label) body.push(text(g.label, { x: g.x + 8, y: g.y + 15 }, "elmo-grouplabel", "start"));
  }
  for (const net of schematic.nets) if (netMode(net, T) === "wire") body.push(renderWireNet(net, lyt, routes));
  for (const pc of lyt.components) body.push(renderComponent(pc));
  for (const net of schematic.nets) if (netMode(net, T) !== "wire") body.push(renderNetDecoration(net, lyt, T));
  body.push(renderJunctions(junctions, routes));
  body.push(`</g>`);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}" font-family="sans-serif">`,
    `<style>${STYLE}</style>`,
    `<rect x="0" y="0" width="${n(width)}" height="${n(height)}" fill="var(--elmo-bg)"/>`,
    body.join(""),
    `</svg>`,
  ].join("");
}
