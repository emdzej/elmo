// elmo intermediate representation (IR) — the contract between parser and renderer.
// See docs/language-spec.md (v0.1-final).

export type Side = "left" | "right" | "top" | "bottom";

export interface Pin {
  /** Canonical id: the pin number if present, else the name. Unique per component. */
  id: string;
  /** Human-facing pin name (e.g. "VCC", "PD0/RX"). Equals the number when unnamed. */
  name: string;
  /** Physical pin number, footprint identity. Absent for auto-numbered bare-name pins. */
  number?: string;
  /** Alternate names a net may reference this pin by (e.g. "+"/"anode"). */
  aliases?: string[];
  /** Which symbol side this pin sits on (schematic aesthetic, not connectivity). */
  side: Side;
}

export interface Component {
  ref: string; // U1, R1, J3
  kind: string; // ic | connector | res | cap | ...
  value?: string; // "ATmega328P" or "10k" — single positional slot (spec §4)
  attrs: Record<string, string>; // opaque pass-through metadata (pkg, mpn, ...)
  pins: Pin[];
  rotation?: 0 | 90 | 180 | 270; // from a `rotate` hint
  mirror?: boolean; // from a `mirror` hint
}

export type NetKind = "signal" | "power" | "gnd";

export interface NetMember {
  ref: string;
  pin: string; // pin number or name as written; resolved at layout time
}

export interface Net {
  name: string;
  kind: NetKind;
  attrs: Record<string, string>; // e.g. { as: "wire" | "label" }, { sym: "analog" }
  members: NetMember[];
  /** Synthesized from a `wire` statement rather than a named `net`. */
  synthetic?: boolean;
  /** `->` flow hint from a wire statement. */
  directed?: boolean;
}

export type Hint =
  | { type: "place"; ref: string; rel: "left-of" | "right-of" | "above" | "below"; anchor: string }
  | { type: "near"; ref: string; target: NetMember }
  | { type: "rotate"; ref: string; angle: 0 | 90 | 180 | 270 }
  | { type: "mirror"; ref: string }
  | { type: "group"; label: string; refs: string[] };

export interface ImportDecl {
  spec: string; // the quoted path, e.g. "amp.elmo"
  ns: string; // namespace alias from `as foo`, or "" for the default namespace
  line: number;
  col: number;
}

export interface Schematic {
  title?: string;
  theme?: string;
  settings: Record<string, string>;
  components: Component[];
  nets: Net[];
  hints: Hint[];
  imports?: ImportDecl[];
}

/** Loads an imported file. Returns its canonical path (for cycle detection) and
 * source, or null if it cannot be resolved. Kept outside core so the parser
 * stays pure/browser-safe — Node/CLI inject an fs-backed resolver. */
export type ImportResolver = (spec: string, fromPath?: string) => { path: string; source: string } | null;

export interface ParseOptions {
  resolve?: ImportResolver;
  path?: string; // path of the file being parsed (base for relative imports)
  /** @internal cycle-detection stack of canonical paths */
  _stack?: Set<string>;
}

export type Severity = "error" | "warning";

export interface Diagnostic {
  severity: Severity;
  message: string;
  line: number;
  col: number;
}
