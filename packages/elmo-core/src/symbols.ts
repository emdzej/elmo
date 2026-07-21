// Iconic component symbols. Each function draws the symbol body plus the leads
// out to each pin's stub, given the already-placed component. Nets attach at
// pin.stub, so connectivity is unaffected.
//
// Two-terminal parts are drawn horizontally (pin 1 left, pin 2 right) to match
// the grid layout; connection-aware auto-rotation is M3. Everything is stroked
// with currentColor-driven classes defined in render.ts.

import type { PlacedComponent, PlacedPin, Vec } from "./layout.js";

const n = (x: number): string => (Math.round(x * 100) / 100).toString();

function L(a: Vec, b: Vec, cls = "elmo-pin"): string {
  return `<line class="${cls}" x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}"/>`;
}
function P(d: string, cls = "elmo-sym"): string {
  return `<path class="${cls}" d="${d}"/>`;
}
function poly(pts: Vec[], cls = "elmo-sym"): string {
  return `<polyline class="${cls}" fill="none" points="${pts.map((p) => `${n(p.x)},${n(p.y)}`).join(" ")}"/>`;
}
function circle(cx: number, cy: number, r: number, cls = "elmo-sym"): string {
  return `<circle class="${cls}" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/>`;
}
function rect(x: number, y: number, w: number, h: number, rx = 0, cls = "elmo-sym"): string {
  return `<rect class="${cls}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(rx)}"/>`;
}
function txt(s: string, x: number, y: number): string {
  return `<text class="elmo-symtext" x="${n(x)}" y="${n(y)}" text-anchor="middle">${s}</text>`;
}
/** Filled arrowhead with its tip at `tip`, pointing along unit vector `dir`. */
function arrow(tip: Vec, dir: Vec, size = 5): string {
  const pe = { x: -dir.y, y: dir.x };
  const b = { x: tip.x - dir.x * size, y: tip.y - dir.y * size };
  const c1 = { x: b.x + pe.x * size * 0.6, y: b.y + pe.y * size * 0.6 };
  const c2 = { x: b.x - pe.x * size * 0.6, y: b.y - pe.y * size * 0.6 };
  return P(`M ${n(tip.x)},${n(tip.y)} L ${n(c1.x)},${n(c1.y)} L ${n(c2.x)},${n(c2.y)} Z`, "elmo-sym-fill");
}

const norm = (v: Vec): Vec => {
  const m = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / m, y: v.y / m };
};
const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const neg = (v: Vec): Vec => ({ x: -v.x, y: -v.y });

function sidep(pc: PlacedComponent, side: string): PlacedPin | undefined {
  return pc.pins.find((p) => p.pin.side === side);
}
function named(pc: PlacedComponent, name: string): PlacedPin | undefined {
  return pc.pins.find((p) => p.pin.name === name || p.pin.aliases?.includes(name));
}

interface TT {
  a: PlacedPin;
  b: PlacedPin;
  y: number;
  cx: number;
  leads: string;
}
/** Horizontal 2-terminal frame: outer leads from each stub to an icon of half-width `half`. */
function twoTerminal(pc: PlacedComponent, half: number): TT | null {
  const a = sidep(pc, "left");
  const b = sidep(pc, "right");
  if (!a || !b) return null;
  const y = a.edge.y;
  const cx = (a.edge.x + b.edge.x) / 2;
  const leads = L(a.stub, { x: cx - half, y }) + L({ x: cx + half, y }, b.stub);
  return { a, b, y, cx, leads };
}

// ── passives ────────────────────────────────────────────────────────────

function zigzag(cx: number, y: number, half = 18, amp = 6): string {
  const x0 = cx - half;
  const step = (half * 2) / 6;
  const pts: Vec[] = [{ x: x0, y }];
  for (let i = 1; i <= 5; i++) pts.push({ x: x0 + step * i, y: y + (i % 2 ? -amp : amp) });
  pts.push({ x: cx + half, y });
  return poly(pts);
}

function resistor(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 18);
  return t ? t.leads + zigzag(t.cx, t.y) : "";
}

function capacitor(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 5);
  if (!t) return "";
  const plate = (px: number) => L({ x: px, y: t.y - 9 }, { x: px, y: t.y + 9 }, "elmo-sym");
  return t.leads + plate(t.cx - 4) + plate(t.cx + 4);
}

function capacitorPolar(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 6);
  if (!t) return "";
  const { cx, y } = t;
  const straight = L({ x: cx - 4, y: y - 9 }, { x: cx - 4, y: y + 9 }, "elmo-sym");
  const curved = P(`M ${n(cx + 6)},${n(y - 9)} Q ${n(cx + 1)},${n(y)} ${n(cx + 6)},${n(y + 9)}`);
  return t.leads + straight + curved + txt("+", cx - 12, y - 11);
}

function inductor(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 16);
  if (!t) return "";
  let d = `M ${n(t.cx - 16)},${n(t.y)}`;
  for (let i = 0; i < 4; i++) d += ` a 4,4 0 0 1 8,0`;
  return t.leads + P(d);
}

function ferrite(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 12);
  return t ? t.leads + rect(t.cx - 12, t.y - 5, 24, 10, 5) : "";
}

function fuse(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 13);
  if (!t) return "";
  return t.leads + rect(t.cx - 13, t.y - 6, 26, 12, 6) + L({ x: t.cx - 13, y: t.y }, { x: t.cx + 13, y: t.y }, "elmo-sym");
}

function crystal(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 7);
  if (!t) return "";
  const { cx, y } = t;
  const plate = (px: number) => L({ x: px, y: y - 9 }, { x: px, y: y + 9 }, "elmo-sym");
  return t.leads + plate(cx - 6) + plate(cx + 6) + rect(cx - 3, y - 7, 6, 14);
}

function resistorBox(cx: number, y: number): string {
  return rect(cx - 16, y - 6, 32, 12);
}

function thermistor(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 16);
  if (!t) return "";
  const { cx, y } = t;
  // diagonal with a foot, the IEC θ-dependent marker
  const diag = poly([{ x: cx - 16, y: y + 12 }, { x: cx - 10, y: y + 12 }, { x: cx + 14, y: y - 12 }]);
  return t.leads + resistorBox(cx, y) + diag;
}

function varistor(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 16);
  if (!t) return "";
  const { cx, y } = t;
  const diag = poly([{ x: cx - 14, y: y + 12 }, { x: cx + 14, y: y - 12 }]);
  return t.leads + resistorBox(cx, y) + diag + txt("U", cx - 9, y - 11);
}

function rheostat(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 18);
  if (!t) return "";
  const { cx, y } = t;
  const tip = { x: cx + 14, y: y - 13 };
  return t.leads + zigzag(cx, y) + L({ x: cx - 12, y: y + 13 }, tip, "elmo-sym") + arrow(tip, { x: 0.73, y: -0.68 });
}

function pot(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 18);
  const w = named(pc, "W");
  if (!t || !w) return "";
  const { cx, y } = t;
  const tip = { x: cx, y: y - 4 };
  return t.leads + zigzag(cx, y) + L(w.stub, { x: cx, y: y - 14 }, "elmo-sym") + L({ x: cx, y: y - 14 }, tip, "elmo-sym") + arrow(tip, { x: 0, y: 1 });
}

function transformer(pc: PlacedComponent): string {
  const p1 = named(pc, "P1");
  const p2 = named(pc, "P2");
  const s1 = named(pc, "S1");
  const s2 = named(pc, "S2");
  if (!p1 || !p2 || !s1 || !s2) return "";
  const cx = (p1.edge.x + s1.edge.x) / 2;
  const coilTop = Math.min(p1.edge.y, s1.edge.y);
  const coilBot = Math.max(p2.edge.y, s2.edge.y);
  const h = coilBot - coilTop;
  const bumps = 3;
  const bh = h / bumps;
  const coil = (x: number, sweep: number): string => {
    let d = `M ${n(x)},${n(coilTop)}`;
    for (let i = 0; i < bumps; i++) d += ` a ${bh / 2},${bh / 2} 0 0 ${sweep} 0,${bh}`;
    return P(d);
  };
  const leads =
    L(p1.stub, { x: cx - 8, y: coilTop }) +
    L(p2.stub, { x: cx - 8, y: coilBot }) +
    L(s1.stub, { x: cx + 8, y: coilTop }) +
    L(s2.stub, { x: cx + 8, y: coilBot });
  const core = L({ x: cx - 1, y: coilTop }, { x: cx - 1, y: coilBot }, "elmo-sym") + L({ x: cx + 1, y: coilTop }, { x: cx + 1, y: coilBot }, "elmo-sym");
  return leads + coil(cx - 8, 1) + coil(cx + 8, 0) + core;
}

// ── diode family ──────────────────────────────────────────────────────────

interface DB {
  t: TT;
  cx: number;
  y: number;
  tri: string;
}
function diodeBase(pc: PlacedComponent, half = 8): DB | null {
  const t = twoTerminal(pc, half);
  if (!t) return null;
  const { cx, y } = t;
  const tri = P(`M ${n(cx - 8)},${n(y - 8)} L ${n(cx - 8)},${n(y + 8)} L ${n(cx + 8)},${n(y)} Z`, "elmo-sym-fill");
  return { t, cx, y, tri };
}
const vbar = (x: number, y: number, hh = 8): string => L({ x, y: y - hh }, { x, y: y + hh }, "elmo-sym");

function diode(pc: PlacedComponent): string {
  const b = diodeBase(pc);
  return b ? b.t.leads + b.tri + vbar(b.cx + 8, b.y) : "";
}

function zener(pc: PlacedComponent): string {
  const b = diodeBase(pc);
  if (!b) return "";
  const { cx, y } = b;
  const ticks = L({ x: cx + 8, y: y - 8 }, { x: cx + 4, y: y - 11 }, "elmo-sym") + L({ x: cx + 8, y: y + 8 }, { x: cx + 12, y: y + 11 }, "elmo-sym");
  return b.t.leads + b.tri + vbar(cx + 8, y) + ticks;
}

function schottky(pc: PlacedComponent): string {
  const b = diodeBase(pc);
  if (!b) return "";
  const { cx, y } = b;
  const top = poly([{ x: cx + 4, y: y - 5 }, { x: cx + 4, y: y - 8 }, { x: cx + 8, y: y - 8 }]);
  const bot = poly([{ x: cx + 12, y: y + 5 }, { x: cx + 12, y: y + 8 }, { x: cx + 8, y: y + 8 }]);
  return b.t.leads + b.tri + vbar(cx + 8, y) + top + bot;
}

function varactor(pc: PlacedComponent): string {
  const b = diodeBase(pc);
  if (!b) return "";
  return b.t.leads + b.tri + vbar(b.cx + 8, b.y) + vbar(b.cx + 11, b.y);
}

function tvs(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 11);
  if (!t) return "";
  const { cx, y } = t;
  const left = P(`M ${n(cx - 10)},${n(y - 8)} L ${n(cx - 10)},${n(y + 8)} L ${n(cx - 1)},${n(y)} Z`, "elmo-sym-fill");
  const right = P(`M ${n(cx + 10)},${n(y - 8)} L ${n(cx + 10)},${n(y + 8)} L ${n(cx + 1)},${n(y)} Z`, "elmo-sym-fill");
  return t.leads + left + right + vbar(cx, y);
}

function photodiode(pc: PlacedComponent): string {
  const b = diodeBase(pc);
  if (!b) return "";
  const { cx, y } = b;
  // light coming IN: two parallel arrows whose heads point toward the diode body
  const toward = norm({ x: -1, y: 1 });
  const beam = (ox: number): string => {
    const tip = { x: cx - 1 + ox, y: y - 11 };
    const start = { x: tip.x + 8, y: tip.y - 8 };
    return L(start, tip, "elmo-sym") + arrow(tip, toward, 4);
  };
  return b.t.leads + b.tri + vbar(cx + 8, y) + beam(0) + beam(6);
}

function led(pc: PlacedComponent): string {
  const b = diodeBase(pc);
  if (!b) return "";
  const { cx, y } = b;
  const dir = { x: 0.7, y: -0.7 };
  const beam = (ox: number): string => {
    const s = { x: cx + ox, y: y - 10 };
    const tip = { x: cx + ox + 6, y: y - 17 };
    return L(s, tip, "elmo-sym") + arrow(tip, dir, 4);
  };
  return b.t.leads + b.tri + vbar(cx + 8, y) + beam(0) + beam(6);
}

function bridge(pc: PlacedComponent): string {
  const ac1 = named(pc, "AC1");
  const ac2 = named(pc, "AC2");
  const dcp = named(pc, "+");
  const dcn = named(pc, "-");
  if (!ac1 || !ac2 || !dcp || !dcn) return "";
  const cx = pc.x + pc.w / 2;
  const cy = pc.y + pc.h / 2;
  const r = Math.min(pc.w, pc.h) / 2 - 8;
  const top = { x: cx, y: cy - r };
  const bot = { x: cx, y: cy + r };
  const lft = { x: cx - r, y: cy };
  const rgt = { x: cx + r, y: cy };
  const diamond = poly([top, rgt, bot, lft, top]);
  const leads = L(ac1.stub, top) + L(ac2.stub, bot) + L(dcp.stub, rgt) + L(dcn.stub, lft);
  // small diode markers on each edge pointing toward the + (right) node
  const d = (a: Vec, b: Vec): string => {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    return arrow({ x: mx, y: my }, { x: (b.x - a.x) / (2 * r), y: (b.y - a.y) / (2 * r) }, 5);
  };
  return leads + diamond + d(lft, top) + d(bot, rgt) + d(lft, bot) + d(top, rgt) + txt("+", cx + r - 6, cy - 4) + txt("~", cx - 3, cy - r + 8);
}

// ── transistors / FETs ──────────────────────────────────────────────────

function bjt(pc: PlacedComponent, npn: boolean): string {
  const base = named(pc, "B");
  const col = named(pc, "C");
  const emi = named(pc, "E");
  if (!base || !col || !emi) return "";
  const barX = base.edge.x + 26;
  const cy = base.edge.y;
  const cJoin = { x: barX, y: cy - 6 };
  const eJoin = { x: barX, y: cy + 6 };
  const cOut = { x: barX + 14, y: col.edge.y };
  const eOut = { x: barX + 14, y: emi.edge.y };
  const parts = [
    L(base.stub, { x: barX, y: cy }),
    L({ x: barX, y: cy - 11 }, { x: barX, y: cy + 11 }, "elmo-sym"),
    poly([cJoin, cOut, col.stub], "elmo-sym"),
    poly([eJoin, eOut, emi.stub], "elmo-sym"),
  ];
  // arrowhead sits ON the emitter leg: npn points out (toward emitter), pnp in (toward base)
  const u = norm({ x: eOut.x - eJoin.x, y: eOut.y - eJoin.y });
  const tip = npn ? lerp(eJoin, eOut, 0.7) : lerp(eJoin, eOut, 0.34);
  parts.push(arrow(tip, npn ? u : neg(u)));
  return parts.join("");
}

function darlington(pc: PlacedComponent): string {
  // approximate: a BJT with a second base tick to suggest two stages
  const base = named(pc, "B");
  if (!base) return bjt(pc, true);
  const barX = base.edge.x + 26;
  const cy = base.edge.y;
  return bjt(pc, true) + L({ x: barX - 5, y: cy - 7 }, { x: barX - 5, y: cy + 7 }, "elmo-sym");
}

function phototransistor(pc: PlacedComponent): string {
  const base = named(pc, "B");
  if (!base) return bjt(pc, true);
  const barX = base.edge.x + 26;
  const cy = base.edge.y;
  // light coming IN: heads point toward the base bar
  const toward = norm({ x: -1, y: 1 });
  const beam = (oy: number): string => {
    const tip = { x: barX - 4, y: cy - 13 + oy };
    const s = { x: tip.x + 8, y: tip.y - 8 };
    return L(s, tip, "elmo-sym") + arrow(tip, toward, 4);
  };
  return bjt(pc, true) + beam(0) + beam(6);
}

interface FetOpts {
  insulated: boolean; // MOSFET (gate separated from channel) vs JFET (gate touches)
  depletion: boolean; // solid channel vs broken (enhancement)
  nType: boolean; // arrow direction
}
function drawFet(pc: PlacedComponent, o: FetOpts): string {
  const g = named(pc, "G");
  const d = named(pc, "D");
  const s = named(pc, "S");
  if (!g || !d || !s) return "";
  const cy = g.edge.y;
  const gateX = g.edge.x + 24;
  const chanX = gateX + (o.insulated ? 6 : 0);
  const parts: string[] = [L(g.stub, { x: gateX, y: cy })];
  if (o.insulated) parts.push(L({ x: gateX, y: cy - 11 }, { x: gateX, y: cy + 11 }, "elmo-sym"));
  // channel
  if (o.insulated && !o.depletion) {
    for (const seg of [[-11, -4], [-2, 2], [4, 11]]) parts.push(L({ x: chanX, y: cy + seg[0]! }, { x: chanX, y: cy + seg[1]! }, "elmo-sym"));
  } else {
    parts.push(L({ x: chanX, y: cy - 11 }, { x: chanX, y: cy + 11 }, "elmo-sym"));
  }
  parts.push(poly([d.stub, { x: chanX + 12, y: d.edge.y }, { x: chanX, y: cy - 7 }], "elmo-sym"));
  parts.push(poly([s.stub, { x: chanX + 12, y: s.edge.y }, { x: chanX, y: cy + 7 }], "elmo-sym"));
  // channel/gate arrow: n points toward channel (right), p away (left)
  const dir = o.nType ? { x: 1, y: 0 } : { x: -1, y: 0 };
  if (o.insulated) {
    const tip = o.nType ? { x: chanX, y: cy } : { x: chanX - 5, y: cy };
    parts.push(arrow(tip, dir, 4.5));
  } else {
    const tip = o.nType ? { x: chanX, y: cy } : { x: gateX, y: cy };
    parts.push(arrow(tip, dir, 4.5));
  }
  return parts.join("");
}

function igbt(pc: PlacedComponent): string {
  const g = named(pc, "G");
  const c = named(pc, "C");
  const e = named(pc, "E");
  if (!g || !c || !e) return "";
  const cy = g.edge.y;
  const gateX = g.edge.x + 22;
  const chanX = gateX + 6;
  const eJoin = { x: chanX, y: cy + 7 };
  const eOut = { x: chanX + 14, y: e.edge.y };
  const u = norm({ x: eOut.x - eJoin.x, y: eOut.y - eJoin.y });
  return [
    L(g.stub, { x: gateX, y: cy }),
    L({ x: gateX, y: cy - 11 }, { x: gateX, y: cy + 11 }, "elmo-sym"),
    L({ x: chanX, y: cy - 11 }, { x: chanX, y: cy + 11 }, "elmo-sym"),
    poly([{ x: chanX, y: cy - 7 }, { x: chanX + 14, y: c.edge.y }, c.stub], "elmo-sym"),
    poly([eJoin, eOut, e.stub], "elmo-sym"),
    arrow(lerp(eJoin, eOut, 0.6), u),
  ].join("");
}

// ── op-amp ────────────────────────────────────────────────────────────────

function opamp(pc: PlacedComponent): string {
  const plus = named(pc, "+");
  const minus = named(pc, "-");
  const out = named(pc, "out");
  const vp = named(pc, "V+");
  const vm = named(pc, "V-");
  if (!plus || !minus || !out) return "";
  const tx0 = pc.x + 16;
  const tx1 = pc.x + pc.w - 6;
  const top = Math.min(plus.edge.y, minus.edge.y) - 8;
  const bot = Math.max(plus.edge.y, minus.edge.y) + 8;
  const apexY = out.edge.y;
  const inPlus = plus.edge.y < minus.edge.y ? plus : minus;
  const inMinus = inPlus === plus ? minus : plus;
  const parts = [
    P(`M ${n(tx0)},${n(top)} L ${n(tx0)},${n(bot)} L ${n(tx1)},${n(apexY)} Z`, "elmo-sym"),
    L(plus.stub, { x: tx0, y: plus.edge.y }),
    L(minus.stub, { x: tx0, y: minus.edge.y }),
    L({ x: tx1, y: apexY }, out.stub),
    txt("+", tx0 + 7, inPlus.edge.y),
    txt("−", tx0 + 7, inMinus.edge.y),
  ];
  // supply legs run straight down/up onto the triangle's sloped edges
  const clampX = (x: number) => Math.min(Math.max(x, tx0 + 4), tx1 - 8);
  if (vp) {
    const x = clampX(vp.edge.x);
    const yEdge = top + ((apexY - top) * (x - tx0)) / (tx1 - tx0);
    parts.push(L({ x, y: vp.stub.y }, { x, y: yEdge }));
  }
  if (vm) {
    const x = clampX(vm.edge.x);
    const yEdge = bot + ((apexY - bot) * (x - tx0)) / (tx1 - tx0);
    parts.push(L({ x, y: vm.stub.y }, { x, y: yEdge }));
  }
  return parts.join("");
}

// ── sources ───────────────────────────────────────────────────────────────

function sourceCircle(pc: PlacedComponent): { t: TT; cx: number; cy: number; r: number } | null {
  const t = twoTerminal(pc, 13);
  if (!t) return null;
  return { t, cx: t.cx, cy: t.y, r: 13 };
}

function vsource(pc: PlacedComponent): string {
  const s = sourceCircle(pc);
  if (!s) return "";
  return s.t.leads + circle(s.cx, s.cy, s.r) + txt("+", s.cx - 5, s.cy - 3) + txt("−", s.cx + 5, s.cy - 3);
}

function isource(pc: PlacedComponent): string {
  const s = sourceCircle(pc);
  if (!s) return "";
  const tip = { x: s.cx, y: s.cy - 7 };
  return s.t.leads + circle(s.cx, s.cy, s.r) + L({ x: s.cx, y: s.cy + 7 }, tip, "elmo-sym") + arrow(tip, { x: 0, y: -1 });
}

function acsource(pc: PlacedComponent): string {
  const s = sourceCircle(pc);
  if (!s) return "";
  const { cx, cy } = s;
  const sine = P(`M ${n(cx - 7)},${n(cy)} Q ${n(cx - 3.5)},${n(cy - 7)} ${n(cx)},${n(cy)} T ${n(cx + 7)},${n(cy)}`);
  return s.t.leads + circle(cx, cy, s.r) + sine;
}

function battery(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 9);
  if (!t) return "";
  const { cx, y } = t;
  const long = (x: number) => L({ x, y: y - 9 }, { x, y: y + 9 }, "elmo-sym");
  const short = (x: number) => L({ x, y: y - 5 }, { x, y: y + 5 }, "elmo-sym");
  return t.leads + long(cx - 9) + short(cx - 3) + long(cx + 3) + short(cx + 9);
}

function lamp(pc: PlacedComponent): string {
  const s = sourceCircle(pc);
  if (!s) return "";
  const { cx, cy, r } = s;
  const d = r * 0.7;
  const x = L({ x: cx - d, y: cy - d }, { x: cx + d, y: cy + d }, "elmo-sym") + L({ x: cx - d, y: cy + d }, { x: cx + d, y: cy - d }, "elmo-sym");
  return s.t.leads + circle(cx, cy, r) + x;
}

function motor(pc: PlacedComponent): string {
  const s = sourceCircle(pc);
  return s ? s.t.leads + circle(s.cx, s.cy, s.r) + txt("M", s.cx, s.cy) : "";
}

function speaker(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 10);
  if (!t) return "";
  const { cx, y } = t;
  const box = rect(cx - 8, y - 6, 8, 12);
  const cone = P(`M ${n(cx)},${n(y - 6)} L ${n(cx + 10)},${n(y - 12)} L ${n(cx + 10)},${n(y + 12)} L ${n(cx)},${n(y + 6)} Z`, "elmo-sym");
  return t.leads + box + cone;
}

function buzzer(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 11);
  if (!t) return "";
  const { cx, y } = t;
  const dome = P(`M ${n(cx - 10)},${n(y + 8)} L ${n(cx - 10)},${n(y)} A 10,10 0 0 1 ${n(cx + 10)},${n(y)} L ${n(cx + 10)},${n(y + 8)} Z`, "elmo-sym");
  return t.leads + dome;
}

// ── switches & electromechanical ──────────────────────────────────────────

function dot(p: Vec): string {
  return circle(p.x, p.y, 1.8, "elmo-sym-fill");
}

function switchSpst(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 13);
  if (!t) return "";
  const { cx, y } = t;
  const p1 = { x: cx - 11, y };
  const p2 = { x: cx + 11, y };
  return t.leads + dot(p1) + dot(p2) + L(p1, { x: cx + 6, y: y - 11 }, "elmo-sym");
}

function pushbutton(pc: PlacedComponent): string {
  const t = twoTerminal(pc, 12);
  if (!t) return "";
  const { cx, y } = t;
  const p1 = { x: cx - 12, y };
  const p2 = { x: cx + 12, y };
  // bridging bar floats above the open gap; plunger + button cap on top
  const bar = L({ x: cx - 11, y: y - 6 }, { x: cx + 11, y: y - 6 }, "elmo-sym");
  const plunger = L({ x: cx, y: y - 6 }, { x: cx, y: y - 13 }, "elmo-sym");
  const cap = L({ x: cx - 6, y: y - 13 }, { x: cx + 6, y: y - 13 }, "elmo-sym");
  return t.leads + dot(p1) + dot(p2) + bar + plunger + cap;
}

function switchSpdt(pc: PlacedComponent): string {
  const com = named(pc, "com");
  const no = named(pc, "no");
  const nc = named(pc, "nc");
  if (!com || !no || !nc) return "";
  const cx = com.edge.x + 26;
  const cy = com.edge.y;
  const cP = { x: cx - 4, y: cy };
  const noP = { x: cx + 8, y: no.edge.y };
  const ncP = { x: cx + 8, y: nc.edge.y };
  return [
    L(com.stub, cP),
    L(no.stub, noP),
    L(nc.stub, ncP),
    dot(cP),
    dot(noP),
    dot(ncP),
    L(cP, { x: noP.x - 1, y: noP.y + 2 }, "elmo-sym"),
  ].join("");
}

function relay(pc: PlacedComponent): string {
  const a = named(pc, "A");
  const b = named(pc, "B");
  const com = named(pc, "com");
  const no = named(pc, "no");
  const nc = named(pc, "nc");
  if (!a || !b || !com || !no || !nc) return "";
  const coilX = a.edge.x + 20;
  const coilTop = Math.min(a.edge.y, b.edge.y);
  const coilBot = Math.max(a.edge.y, b.edge.y);
  const parts = [
    L(a.stub, { x: coilX, y: coilTop }),
    L(b.stub, { x: coilX, y: coilBot }),
    rect(coilX, coilTop, 12, coilBot - coilTop),
  ];
  const cx = com.edge.x - 20;
  const cP = { x: cx, y: com.edge.y };
  const noP = { x: cx, y: no.edge.y };
  const ncP = { x: cx, y: nc.edge.y };
  parts.push(L(com.stub, cP), L(no.stub, noP), L(nc.stub, ncP), dot(cP), dot(noP), dot(ncP));
  parts.push(L(cP, { x: noP.x, y: noP.y }, "elmo-sym"));
  // dashed mechanical linkage between coil and contact
  parts.push(`<line class="elmo-dash" x1="${n(coilX + 12)}" y1="${n((coilTop + coilBot) / 2)}" x2="${n(cx)}" y2="${n((coilTop + coilBot) / 2)}"/>`);
  return parts.join("");
}

function antenna(pc: PlacedComponent): string {
  const p = pc.pins[0];
  if (!p) return "";
  const base = { x: p.edge.x + 16, y: p.edge.y };
  const topc = { x: base.x, y: base.y - 4 };
  return [
    L(p.stub, base),
    L(base, topc, "elmo-sym"),
    L(topc, { x: topc.x - 9, y: topc.y - 12 }, "elmo-sym"),
    L(topc, { x: topc.x + 9, y: topc.y - 12 }, "elmo-sym"),
  ].join("");
}

export type SymbolFn = (pc: PlacedComponent) => string;

export const SYMBOLS: Record<string, SymbolFn> = {
  // passives
  res: resistor,
  cap: (pc) => (pc.comp.attrs.pol === "yes" ? capacitorPolar(pc) : capacitor(pc)),
  ind: inductor,
  ferrite,
  fuse,
  crystal,
  thermistor,
  varistor,
  rheostat,
  pot,
  transformer,
  // diode family
  diode,
  led,
  zener,
  schottky,
  tvs,
  photodiode,
  varactor,
  bridge,
  // transistors / FETs
  npn: (pc) => bjt(pc, true),
  pnp: (pc) => bjt(pc, false),
  darlington,
  phototransistor,
  igbt,
  nmos: (pc) => drawFet(pc, { insulated: true, depletion: false, nType: true }),
  pmos: (pc) => drawFet(pc, { insulated: true, depletion: false, nType: false }),
  nmos_dep: (pc) => drawFet(pc, { insulated: true, depletion: true, nType: true }),
  pmos_dep: (pc) => drawFet(pc, { insulated: true, depletion: true, nType: false }),
  njfet: (pc) => drawFet(pc, { insulated: false, depletion: true, nType: true }),
  pjfet: (pc) => drawFet(pc, { insulated: false, depletion: true, nType: false }),
  // active / sources
  opamp,
  vsource,
  isource,
  acsource,
  battery,
  lamp,
  motor,
  speaker,
  buzzer,
  // switches / electromechanical
  switch_spst: switchSpst,
  pushbutton,
  switch_spdt: switchSpdt,
  relay,
  antenna,
};
