# Introduction

**elmo** (ELectronics MOdeling, Schematics as a code) is a small text language for
describing electronic circuits that render as schematics — in the spirit of
Mermaid and PlantUML, but for electronics.

You write parts, pins, and connections in plain text; elmo lays them out and
draws a schematic as SVG.

```elmo
part U1 ic "ATtiny85" pkg=SOIC-8 {
  left 1:~RESET 2:PB3 3:PB4 right 8:VCC 7:PB2 6:PB1 5:PB0 bottom 4:GND
}
part R1 res 10k
part D1 led green
wire U1.PB0 -- R1.1
wire R1.2 -- D1.anode
power VCC = U1.VCC
gnd GND = U1.GND D1.cathode
```

## Why a language?

- **Diffable & reviewable** — schematics live in git as text, not binary.
- **Generatable** — emit elmo from scripts, BOMs, or config.
- **Embeddable** — drop diagrams into Markdown docs, wikis, and MDX.
- **Downstream-ready** — the same source exports a netlist and a BOM.

## How it works

The pipeline is: parse the DSL into an intermediate representation, merge shared
connections into electrical nets, place components with
[elkjs](https://github.com/kieler/elkjs), route signal nets orthogonally, and
emit themeable SVG. Power and ground render as symbols (never routed); signal
nets route as wires or collapse to net labels by fan-out.

Continue to [Install](/guide/install) and [Getting started](/guide/getting-started).
