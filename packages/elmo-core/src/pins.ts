// Per-instance pin visibility (`show=` / `hide=`). Hidden pins are dropped from
// the drawing only — they remain in the IR, so netlist/BOM are unaffected. A
// pin referenced by a net is always kept (a wire to a hidden pin would dangle).

import type { Component, Pin, Schematic } from "./types.js";

const tokens = (v?: string): string[] => (v ? v.split(/[\s,]+/).filter(Boolean) : []);

function matches(pin: Pin, token: string): boolean {
  return pin.number === token || pin.id === token || pin.name === token || (pin.aliases?.includes(token) ?? false);
}

/** Pin ids referenced by at least one net, keyed by component ref. */
export function connectedPinIds(schematic: Schematic): Map<string, Set<string>> {
  const byRef = new Map(schematic.components.map((c) => [c.ref, c]));
  const out = new Map<string, Set<string>>();
  for (const net of schematic.nets) {
    for (const m of net.members) {
      const comp = byRef.get(m.ref);
      const pin = comp?.pins.find((p) => matches(p, m.pin));
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
    if (show.length) return show.some((t) => matches(pin, t));
    return !hide.some((t) => matches(pin, t));
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
    const wouldHide = show.length ? !show.some((t) => matches(pin, t)) : hide.some((t) => matches(pin, t));
    return wouldHide;
  });
}
