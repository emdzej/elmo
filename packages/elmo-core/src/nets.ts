// How a net renders — shared by layout (which nets become ELK edges) and render
// (how each net is drawn). Spec §5: power/gnd/signal are symbol nets; a plain
// `net` routes as a wire (≤2 members) or as labels (≥3), `as=wire|label`
// overrides. A symbol net with `routable` becomes one symbol wired to its pins.

import type { Net, NetKind } from "./types.js";

export type NetMode = "power" | "gnd" | "signal" | "wire" | "label";

/** Default fan-out at which a plain net renders as labels instead of a wire. */
export const DEFAULT_LABEL_THRESHOLD = 3;

/**
 * Resolve the label threshold: an explicit override wins, else the
 * `set labelThreshold=N` directive, else the default (3). A net with this many
 * members or more renders as labels.
 */
export function labelThreshold(settings: Record<string, string>, override?: number): number {
  if (override !== undefined && Number.isFinite(override) && override > 0) return override;
  const v = Number(settings.labelThreshold ?? settings["label-threshold"]);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_LABEL_THRESHOLD;
}

const SYMBOL_KINDS: NetKind[] = ["power", "gnd", "signal"];

/** Is this a net symbol (power/gnd/signal) rather than a plain net? */
export function isSymbolNet(net: Net): boolean {
  return SYMBOL_KINDS.includes(net.kind);
}

/** `routable`: draw one symbol and route wires to every member (vs per-pin). */
export function isRoutable(net: Net): boolean {
  return net.attrs.routable != null;
}

/** Whether this net contributes routed edges to ELK: a plain wire net, or a
 * routable symbol net. */
export function isRouted(net: Net, threshold: number = DEFAULT_LABEL_THRESHOLD): boolean {
  return isSymbolNet(net) ? isRoutable(net) : netMode(net, threshold) === "wire";
}

export function netMode(net: Net, threshold: number = DEFAULT_LABEL_THRESHOLD): NetMode {
  if (net.kind === "power") return "power";
  if (net.kind === "gnd") return "gnd";
  if (net.kind === "signal") return "signal";
  const forced = net.attrs.as;
  if (forced === "label") return "label";
  if (forced === "wire") return "wire";
  if (net.synthetic) return "wire"; // `wire` statements always route, any fan-out
  return net.members.length >= threshold ? "label" : "wire";
}
