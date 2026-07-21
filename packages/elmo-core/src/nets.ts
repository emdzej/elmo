// How a net renders — shared by layout (which nets become routable edges) and
// render (how each net is drawn). Spec §5: power/gnd are symbols, signal nets
// route as wire when 2-member and as labels when 3+, with `as=wire|label` override.

import type { Net } from "./types.js";

export type NetMode = "power" | "gnd" | "wire" | "label";

/** Default fan-out at which a signal net renders as labels instead of a wire. */
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

export function netMode(net: Net, threshold: number = DEFAULT_LABEL_THRESHOLD): NetMode {
  if (net.kind === "power") return "power";
  if (net.kind === "gnd") return "gnd";
  const forced = net.attrs.as;
  if (forced === "label") return "label";
  if (forced === "wire") return "wire";
  if (net.synthetic) return "wire"; // `wire` statements always route, any fan-out
  return net.members.length >= threshold ? "label" : "wire";
}
