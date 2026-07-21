// Per-instance pin visibility (`show=` / `hide=`). Hidden pins are dropped from
// the drawing only — they remain in the IR, so netlist/BOM are unaffected. A
// pin referenced by a net is always kept (a wire to a hidden pin would dangle).

import type { Component, Pin, Schematic } from "./types.js";

const tokens = (v?: string): string[] => (v ? v.split(/[\s,]+/).filter(Boolean) : []);

// ── canonical pin matching (the single source of truth) ──

/** Does `token` refer to this pin (by number, id, name, or alias)? */
export function pinMatches(pin: Pin, token: string): boolean {
  return pin.number === token || pin.id === token || pin.name === token || (pin.aliases?.includes(token) ?? false);
}

/** Every pin `token` could refer to (used to detect ambiguous names). */
export function matchPins(comp: Component, token: string): Pin[] {
  return comp.pins.filter((p) => pinMatches(p, token));
}

/** The single pin `token` resolves to, by precedence: number → id → name → alias. */
export function matchPin(comp: Component, token: string): Pin | undefined {
  return (
    comp.pins.find((p) => p.number === token) ??
    comp.pins.find((p) => p.id === token) ??
    comp.pins.find((p) => p.name === token) ??
    comp.pins.find((p) => p.aliases?.includes(token))
  );
}

/** Pin ids referenced by at least one net, keyed by component ref. */
export function connectedPinIds(schematic: Schematic): Map<string, Set<string>> {
  const byRef = new Map(schematic.components.map((c) => [c.ref, c]));
  const out = new Map<string, Set<string>>();
  for (const net of schematic.nets) {
    for (const m of net.members) {
      const comp = byRef.get(m.ref);
      const pin = comp?.pins.find((p) => pinMatches(p, m.pin));
      if (!pin) continue;
      (out.get(m.ref) ?? out.set(m.ref, new Set()).get(m.ref)!).add(pin.id);
    }
  }
  return out;
}

/** Subset of a component's pins to draw, honoring `show=`/`hide=`. A connected
 * pin is always kept. Returns the full list when neither attribute is set. */
export function visiblePins(comp: Component, connected: Set<string>): Pin[] {
  const show = tokens(comp.attrs.show);
  const hide = tokens(comp.attrs.hide);
  if (!show.length && !hide.length) return comp.pins;
  return comp.pins.filter((pin) => {
    if (connected.has(pin.id)) return true; // never hide a wired pin
    if (show.length) return show.some((t) => pinMatches(pin, t));
    return !hide.some((t) => pinMatches(pin, t));
  });
}

/** Pins that a `show`/`hide` list tried to hide but are kept because they are
 * connected — reported as warnings by the validator. */
export function keptDespiteHidden(comp: Component, connected: Set<string>): Pin[] {
  const show = tokens(comp.attrs.show);
  const hide = tokens(comp.attrs.hide);
  if (!show.length && !hide.length) return [];
  return comp.pins.filter((pin) => {
    if (!connected.has(pin.id)) return false;
    const wouldHide = show.length ? !show.some((t) => pinMatches(pin, t)) : hide.some((t) => pinMatches(pin, t));
    return wouldHide;
  });
}
