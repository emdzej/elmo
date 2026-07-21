# Getting started

A schematic is a list of **parts** and the **connections** between their pins.

## Parts

Every component uses one form — `part <ref> <kind> [value] [attrs] [{ pins }]`:

```elmo
part R1 res 10k
part C1 cap 100n
part U1 ic "NE555" pkg=DIP-8 { left 2:TRIG 6:THRES right 3:OUT top 8:VCC bottom 1:GND }
```

`res`, `cap`, and friends draw iconic symbols with implicit pins `1` and `2`.
`ic`, `connector`, and `mod` are boxes whose pins you declare per side.

## Connections

- `wire A.p -- B.q` — a point-to-point connection (`->` is an equivalent alias).
- `net name = A.p B.q C.r` — a named net; 2 members route as a wire, 3+ become labels (`as=wire` forces routing).
- `power NAME = …`, `gnd NAME = …`, `signal NAME = …` — net **symbols** (rail flag,
  ground symbol, hollow-circle terminal). By default one symbol is stamped at each
  member pin; add `routable` to draw a single symbol wired to all members.

```elmo
part U1 ic "MCU" { left 1:IN right 2:OUT top 3:VCC bottom 4:GND }
part R1 res 220
part D1 led
wire U1.OUT -- R1.1
wire R1.2 -- D1.anode
signal TEST = U1.OUT
power VCC = U1.VCC
gnd GND = U1.GND D1.cathode routable
```

## Metadata

Attributes like `pkg=`, `mpn=`, `footprint=`, `tol=` are carried through untouched —
they don't affect rendering but feed the [netlist and BOM](/guide/how-to#netlist-bom).
`link="uri"` renders the ref as a hyperlink.

## Layout hints

Layout is automatic; nudge it when needed:

```elmo
place J1 right-of U1
near C1 U1.VCC
group "power supply" { U2 C3 C4 }
rotate Q1 90
mirror U3
```

## Reusable parts

Define a pinout once with `def` and instantiate it as many times as you like —
the template name becomes the default label:

```elmo
def NE555 ic pkg=DIP-8 {
  left  2:TRIG  6:THRES  7:DISCH
  right 3:OUT   4:~RESET
  top   8:VCC
  bottom 1:GND
}

part U1 NE555
part U2 NE555 pkg=SOIC-8
```

## Reuse across files

`import` pulls another file's declarations in; `as` puts them in a namespace
(rails like `power`/`gnd` still merge with the parent). Given a `psu.elmo`:

```elmo-file psu.elmo
part U1 ic "REG" { left 1:IN right 2:OUT bottom 3:GND }
gnd GND = U1.GND
```

another file imports it and wires across the namespace:

```elmo
import "psu.elmo" as psu
part U2 mod "ESP32-WROOM" { left 1:GND 2:3V3 }
wire psu.U1.OUT -- U2.3V3
gnd GND = psu.U1.GND U2.GND
```

See [How-to → split a design across files](/guide/how-to#split-a-design-across-files)
for resolvers.

Next: [How-to](/guide/how-to) for recipes, or the [Language spec](/language-spec).
