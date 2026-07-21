// @emdzej/elmo-core — parse the elmo DSL and render schematics as SVG.

export type * from "./types.js";
export { parse, tokenize } from "./parser.js";
export { validate, hasErrors } from "./validate.js";
export { layoutSchematic, resolvePin } from "./layout.js";
export type { GroupBox, Layout, LayoutResult, PlacedComponent, PlacedPin, Vec } from "./layout.js";
export { netMode, labelThreshold, DEFAULT_LABEL_THRESHOLD, type NetMode } from "./nets.js";
export { renderSchematic, type RenderOptions } from "./render.js";
export { KINDS, isKnownKind, resolveKind } from "./kinds.js";
export { normalizeNets } from "./normalize.js";
export { mapResolver } from "./resolvers.js";
export { escapeHtml, safeHref } from "./util.js";
export { matchPin, matchPins, pinMatches } from "./pins.js";
export {
  netlist,
  netlistToText,
  bom,
  bomToCsv,
  type NetlistNet,
  type NetConnection,
  type BomRow,
} from "./exporters.js";

import type { Diagnostic, ParseOptions } from "./types.js";
import { parse } from "./parser.js";
import { validate, hasErrors } from "./validate.js";
import { renderSchematic, type RenderOptions } from "./render.js";

export interface RenderResult {
  svg: string;
  diagnostics: Diagnostic[];
}

/**
 * Convenience: parse + validate + render in one call. Async because layout runs
 * on elkjs. Always resolves to an SVG (best-effort even with warnings); rejects
 * with an ElmoError only on parse or resolution *errors*. Pass `resolve`/`path`
 * to enable `import` statements.
 */
export async function render(source: string, opts?: RenderOptions & ParseOptions): Promise<RenderResult> {
  const { schematic, diagnostics: parseDiags } = parse(source, { resolve: opts?.resolve, path: opts?.path });
  const semanticDiags = validate(schematic);
  const diagnostics = [...parseDiags, ...semanticDiags];
  if (hasErrors(diagnostics)) {
    const msg = diagnostics
      .filter((d) => d.severity === "error")
      .map((d) => (d.line ? `${d.line}:${d.col} ${d.message}` : d.message))
      .join("\n");
    throw new ElmoError(msg, diagnostics);
  }
  return { svg: await renderSchematic(schematic, opts), diagnostics };
}

export class ElmoError extends Error {
  constructor(
    message: string,
    public readonly diagnostics: Diagnostic[],
  ) {
    super(message);
    this.name = "ElmoError";
  }
}
