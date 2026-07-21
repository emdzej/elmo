// Semantic checks (spec §11). Errors block rendering; warnings are advisory.
// Note: nets don't carry source positions in the IR yet, so net-level
// diagnostics report line 0 for M1 (precise spans arrive with M4 error work).

import type { Component, Diagnostic, Pin, Schematic } from "./types.js";

function matchPin(comp: Component, token: string): Pin[] {
  const exact = comp.pins.filter(
    (p) => p.number === token || p.id === token || p.name === token || p.aliases?.includes(token),
  );
  return exact;
}

export function validate(schematic: Schematic): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const byRef = new Map(schematic.components.map((c) => [c.ref, c]));
  const referenced = new Set<string>();

  for (const net of schematic.nets) {
    const label = net.synthetic ? "wire" : `net ${net.name}`;
    for (const m of net.members) {
      const comp = byRef.get(m.ref);
      if (!comp) {
        diags.push({ severity: "error", message: `${label}: unknown component '${m.ref}'`, line: 0, col: 0 });
        continue;
      }
      referenced.add(comp.ref);
      const matches = matchPin(comp, m.pin);
      if (matches.length === 0) {
        diags.push({
          severity: "error",
          message: `${label}: '${m.ref}' has no pin '${m.pin}'`,
          line: 0,
          col: 0,
        });
      } else if (matches.length > 1) {
        diags.push({
          severity: "warning",
          message: `${label}: pin '${m.pin}' is ambiguous on '${m.ref}' — reference it by number`,
          line: 0,
          col: 0,
        });
      }
    }

    if (!net.synthetic && net.members.length < 2) {
      diags.push({
        severity: "warning",
        message: `net '${net.name}' has a single member — likely a typo'd name that failed to merge`,
        line: 0,
        col: 0,
      });
    }
  }

  for (const comp of schematic.components) {
    if (!referenced.has(comp.ref)) {
      diags.push({
        severity: "warning",
        message: `component '${comp.ref}' is not connected to any net`,
        line: 0,
        col: 0,
      });
    }
  }

  return diags;
}

export function hasErrors(diags: Diagnostic[]): boolean {
  return diags.some((d) => d.severity === "error");
}
