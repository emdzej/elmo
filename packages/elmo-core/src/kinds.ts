// Built-in component kinds and their implicit pins (spec §4.2, §4.3, §8).
// ic/connector take an explicit pin-block; everything else has implicit pins and
// draws an iconic symbol (see symbols.ts).

import type { Side } from "./types.js";

export interface KindPin {
  name: string;
  number: string;
  side: Side;
  aliases?: string[];
}

export interface KindDef {
  pins?: KindPin[];
  defaultSide: Side;
  explicitPins: boolean;
}

// ── pin-shape helpers ──────────────────────────────────────────────────────

/** Horizontal 2-terminal part: pin 1 left, pin 2 right. */
function twoTerm(a1: string[] = [], a2: string[] = []): KindDef {
  return {
    defaultSide: "left",
    explicitPins: false,
    pins: [
      { name: "1", number: "1", side: "left", aliases: a1 },
      { name: "2", number: "2", side: "right", aliases: a2 },
    ],
  };
}

/** Anode (left) / cathode (right) two-terminal, used by the diode family. */
function diodeLike(): KindDef {
  return {
    defaultSide: "left",
    explicitPins: false,
    pins: [
      { name: "anode", number: "1", side: "left", aliases: ["1", "a"] },
      { name: "cathode", number: "2", side: "right", aliases: ["2", "k", "c"] },
    ],
  };
}

/** Three-terminal active part: control pin left, two channel pins right (upper/lower). */
function threeTerm(ctrl: string, upper: string, lower: string, nums: [string, string, string]): KindDef {
  return {
    defaultSide: "left",
    explicitPins: false,
    pins: [
      { name: ctrl, number: nums[0], side: "left", aliases: [nums[0]] },
      { name: upper, number: nums[1], side: "right", aliases: [nums[1]] },
      { name: lower, number: nums[2], side: "right", aliases: [nums[2]] },
    ],
  };
}

const bjt = () => threeTerm("B", "C", "E", ["2", "1", "3"]);
const fet = (g: string, d: string, s: string) => threeTerm(g, d, s, ["1", "2", "3"]);

export const KINDS: Record<string, KindDef> = {
  // ── containers (explicit pin-block) ──
  ic: { defaultSide: "left", explicitPins: true },
  connector: { defaultSide: "right", explicitPins: true },

  // ── passives ──
  res: twoTerm(),
  cap: twoTerm(["+"], ["-"]),
  ind: twoTerm(),
  ferrite: twoTerm(),
  fuse: twoTerm(),
  crystal: twoTerm(),
  rheostat: twoTerm(),
  thermistor: twoTerm(),
  varistor: twoTerm(),
  pot: {
    defaultSide: "left",
    explicitPins: false,
    pins: [
      { name: "1", number: "1", side: "left" },
      { name: "2", number: "2", side: "right" },
      { name: "W", number: "3", side: "top", aliases: ["3", "wiper", "w"] },
    ],
  },
  transformer: {
    defaultSide: "left",
    explicitPins: false,
    pins: [
      { name: "P1", number: "1", side: "left", aliases: ["1"] },
      { name: "P2", number: "2", side: "left", aliases: ["2"] },
      { name: "S1", number: "3", side: "right", aliases: ["3"] },
      { name: "S2", number: "4", side: "right", aliases: ["4"] },
    ],
  },

  // ── diode family (anode/cathode) ──
  diode: diodeLike(),
  led: diodeLike(),
  zener: diodeLike(),
  schottky: diodeLike(),
  tvs: diodeLike(),
  photodiode: diodeLike(),
  varactor: diodeLike(),
  bridge: {
    defaultSide: "left",
    explicitPins: false,
    pins: [
      { name: "AC1", number: "1", side: "top", aliases: ["1", "~1"] },
      { name: "AC2", number: "2", side: "bottom", aliases: ["2", "~2"] },
      { name: "+", number: "3", side: "right", aliases: ["3", "V+"] },
      { name: "-", number: "4", side: "left", aliases: ["4", "V-"] },
    ],
  },

  // ── transistors / FETs ──
  npn: bjt(),
  pnp: bjt(),
  darlington: bjt(),
  phototransistor: bjt(),
  igbt: threeTerm("G", "C", "E", ["1", "2", "3"]),
  nmos: fet("G", "D", "S"),
  pmos: fet("G", "D", "S"),
  nmos_dep: fet("G", "D", "S"),
  pmos_dep: fet("G", "D", "S"),
  njfet: fet("G", "D", "S"),
  pjfet: fet("G", "D", "S"),

  // ── sources & electromechanical ──
  opamp: {
    defaultSide: "left",
    explicitPins: false,
    pins: [
      { name: "+", number: "3", side: "left", aliases: ["in+"] },
      { name: "-", number: "2", side: "left", aliases: ["in-"] },
      { name: "V+", number: "8", side: "top" },
      { name: "V-", number: "4", side: "bottom" },
      { name: "out", number: "1", side: "right", aliases: ["o"] },
    ],
  },
  battery: twoTerm(["+"], ["-"]),
  vsource: twoTerm(["+"], ["-"]),
  isource: twoTerm(),
  acsource: twoTerm(),
  lamp: twoTerm(),
  motor: twoTerm(),
  speaker: twoTerm(["+"], ["-"]),
  buzzer: twoTerm(["+"], ["-"]),
  switch_spst: twoTerm(),
  pushbutton: twoTerm(),
  switch_spdt: {
    defaultSide: "left",
    explicitPins: false,
    pins: [
      { name: "com", number: "1", side: "left", aliases: ["1", "c"] },
      { name: "no", number: "2", side: "right", aliases: ["2"] },
      { name: "nc", number: "3", side: "right", aliases: ["3"] },
    ],
  },
  relay: {
    defaultSide: "left",
    explicitPins: false,
    pins: [
      { name: "A", number: "1", side: "left", aliases: ["1", "coil+"] },
      { name: "B", number: "2", side: "left", aliases: ["2", "coil-"] },
      { name: "com", number: "3", side: "right", aliases: ["3"] },
      { name: "no", number: "4", side: "right", aliases: ["4"] },
      { name: "nc", number: "5", side: "right", aliases: ["5"] },
    ],
  },
  antenna: {
    defaultSide: "left",
    explicitPins: false,
    pins: [{ name: "1", number: "1", side: "left" }],
  },
};

// aliases: some kinds accept alternate spellings
const KIND_ALIASES: Record<string, string> = {
  mod: "ic", // ready-to-use module (ESP32-WROOM, Pi Pico) — same box, user-defined pins
  module: "ic",
  potentiometer: "pot",
  xtal: "crystal",
  spst: "switch_spst",
  spdt: "switch_spdt",
  pushbtn: "pushbutton",
  ntc: "thermistor",
  ptc: "thermistor",
  mov: "varistor",
  jfet_n: "njfet",
  jfet_p: "pjfet",
};

export function resolveKind(kind: string): string {
  return KIND_ALIASES[kind] ?? kind;
}

export function isKnownKind(kind: string): boolean {
  return resolveKind(kind) in KINDS;
}
