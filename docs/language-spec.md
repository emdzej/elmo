# elmo — Language Specification (v0.1-final)

**elmo** (*EL*ectronics *MO*deling, Schematics as a code) is a text DSL for
describing electronic circuits that render as schematics. It is designed to be
embedded in Markdown code fences and rendered by plugins, in the spirit of
Mermaid/PlantUML.

Status: **FROZEN (v0.1-final).** All grammar decisions are settled; this is the
contract M1 implements. Post-v1 extensions are noted where relevant.

## 1. Design goals

1. **Readable & terse** — structured, not English. Approachable like Mermaid, unambiguous to parse.
2. **Schematic-first** — the primary artifact is a human-readable schematic. Layout convention beats layout algorithm.
3. **Metadata-friendly, render-agnostic** — package/MPN/etc. are carried but never affect rendering, enabling later netlist/BOM/PCB export.
4. **Small core, extensible symbols** — a fixed grammar; the symbol library grows independently.

### Non-goals (v1)

- Circuit *simulation* (no SPICE semantics).
- PCB layout (metadata only; export is a downstream concern).
- Pixel-perfect analog aesthetics without any hints.

## 2. Lexical structure

- **Encoding**: UTF-8.
- **Comments**: `#` to end of line.
- **Whitespace**: insignificant except as a token separator. Newlines separate statements; a statement may also end at a `}`.
- **Identifiers** (`ref`, net names, pin names): `[A-Za-z_][A-Za-z0-9_]*`, plus `/`, `~`, `+`, `-`, `.` **inside pin names only** (e.g. `PC6/~RESET`, `AVCC`). A `ref` is a plain identifier (`U1`, `R1`, `J3`).
- **Strings**: double-quoted, `"ATmega328P"`. Used for human labels/part names.
- **Values with units**: bare tokens like `10k`, `4.7u`, `100n`, `1M`, `3V3`. Stored as opaque strings in v1 (no unit math).
- **Attributes**: `key=value` where value is a bare token or a quoted string. Keys are identifiers.
- **Pin numbers**: bare integers or short alphanumerics (`1`, `28`, `A1` for BGA grids).

## 3. Document structure

A document is a sequence of statements in any order (forward references allowed):

```text
import-decl           # import "file" [as ns] (§3.1)
component-decl        # ic | connector | res | cap | … (§4)
net-decl              # net | power | gnd | wire (§5)
layout-hint           # place | near | group (§6)
directive             # title | theme | set (§7)
```

Resolution happens in two passes: (1) collect declarations, (2) resolve net/hint references.
Referencing an undefined `ref` or pin is an **error** with line/column.

### 3.1 Imports

Split a design across files. `import` loads another elmo file's declarations
into the current document:

```text
import "psu.elmo"              # default namespace — declarations merged flat
import "amp.elmo" as amp       # named namespace — refs become amp.U1, amp.R1, …
```

Rules:

- **Namespacing.** A named import prefixes every imported component `ref` (and
  the internal net-member refs and hints that touch them) with `ns.`. Reference
  them from the parent as `amp.U1.out`. A default (unnamed) import merges flat,
  as if pasted in.
- **Rails stay global.** In a named namespace, `power`/`gnd` net *names* are
  **not** prefixed — a subcircuit's `gnd GND` merges with the parent's `GND`.
  Signal-net names *are* prefixed (`amp.feedback`), so they stay isolated.
- **Flattened.** Transitive imports (an imported file that itself imports) are
  inlined into one flat document.
- **Merged, last-wins.** Multiple imports into the same namespace combine. If a
  component `ref` is declared more than once, the **last declaration wins** and a
  **warning** is emitted. The parent file's own declarations take precedence over
  what it imports.
- **Cycles** are detected and broken with a warning.
- Imports require a **resolver** (how a file path maps to source). The CLI and
  Node use the filesystem; `parse`/`render` accept a `resolve` option. Without
  one, an `import` is an error.

## 4. Components

**One** declaration form for every component — `part` is the sole keyword, `kind`
is the second token:

```text
part <ref> <kind> [label|value] [attrs…] [ { pin-block } ]
```

- `ref` — unique instance id (`U1`, `R1`).
- `kind` — a symbol kind (built-in, §8). Determines the symbol drawn.
- `label|value` — quoted string (part name, e.g. `"ATmega328P"`) **or** a bare value (`10k`). Optional.
- `attrs` — zero or more `key=value` (§7). Opaque metadata.
- `pin-block` — required for `ic`/`connector`; implicit for two-terminal parts.

Rationale: a single grammar production and one parser code path; greppable
(`grep '^part '`); `kind` and `ref` always in the same columns.

The positional `label|value` maps to a **single `value` field** in the IR
regardless of `kind` (`"NE555"` and `10k` both land there). When you need both a
human name and a value, use explicit attrs — `part R1 res 10k name="load"`.

### 4.1 ICs and connectors (explicit pins)

```elmo
part U1 ic "ATmega328P" pkg=DIP-28 {
  left   1:PC6/~RESET  2:PD0/RX  3:PD1/TX  4:PD2
  right  28:PC5  27:PC4
  top    7:VCC  20:AVCC
  bottom 8:GND  22:GND
}

part J1 connector "UART" pkg=header-1x4 {
  1:GND  2:VCC  3:TX  4:RX          # side omitted → auto-assigned
}
```

- Pin entry syntax: `number:name`, or just `number` (name = number), or just `name`. Bare-name entries are **auto-numbered** and are only allowed on `connector` (never `ic`, whose numbers are footprint identity).
- **Connector auto-numbering is column-major**: pin 1 is top of column 1, counting down each column before the next (matches pin-header silkscreen / ribbon-cable order). A `2x5` header numbers `1..5` down the left column, `6..10` down the right.
- `left|right|top|bottom` group pins onto a symbol side; order within a line is top-to-bottom / left-to-right.
- **Side placement is a schematic aesthetic**; pin *number* is the stable identity tying symbol ↔ footprint. Overriding sides never changes the netlist.
- Multiple pins may share a name (e.g. two `GND`); they are distinct pins that happen to sit on the same net.

### 4.2 Two-terminal parts (implicit pins)

```elmo
part R1 res 10k tol=1%
part C1 cap 100n
part C2 cap 10u pol=yes         # polarized: pin 1 = +, pin 2 = -
part L1 ind 10uH
part D1 diode 1N4148            # pin 1 = anode, 2 = cathode
part D2 led red
```

Implicit pins: `1` and `2`. Polarized parts add name aliases (`+`/`-`, `anode`/`cathode`)
so nets can reference `C2.+` or `D1.anode`.

### 4.3 Multi-terminal discrete parts

```elmo
part Q1 npn 2N3904             # pins: C, B, E  (numeric aliases 1/2/3 from symbol def)
part Q2 pnp 2N3906
part M1 nmos 2N7000            # G, D, S
part U3 opamp "LM358" { }      # pins: +, -, out, V+, V-
```

Pin names for these come from the symbol definition (§8), not the user.

### 4.4 Reusable templates (`def`)

When several parts share a pinout, define it once with `def` and instantiate it
by using the template name in the `kind` slot:

```elmo
def NE555 ic pkg=DIP-8 {
  left  2:TRIG  6:THRES  7:DISCH
  right 3:OUT   4:~RESET
  top   8:VCC
  bottom 1:GND
}

part U1 NE555               # inherits pins, pkg, and the label "NE555"
part U2 NE555               # again, no repetition
part U3 NE555 pkg=SOIC-8    # override an attr on this instance
part U4 NE555 "555 timer"   # override the label
```

- **A template is a user-defined kind.** `def <name> <baseKind> [value] [attrs] [{ pins }]`;
  `baseKind` is any built-in kind (§8). Instantiate with the normal `part` form.
- **The template name is the default label**; an instance value overrides it, and
  a `value` on the `def` overrides the name.
- **Instance attrs merge over the template's** (the instance wins).
- **Kind resolution** checks templates before built-ins; a `def` may not shadow a
  built-in kind name.
- **Libraries via imports.** Put `def`s in a file, `import` it, and instantiate.
  With `import … as lib`, reference the template as `lib.NE555`. Rails and
  namespacing follow §3.1.

Deferred to a later version: template inheritance (a `def` based on another `def`)
and per-instance pin/side overrides.

## 5. Nets & connections

Four ways to express connectivity. **The power/gnd distinction is semantic, not cosmetic** — it changes how things render.

### 5.1 Signal nets (routed, labeled)

```elmo-src
net TX = U1.TX J1.RX
net SPI_MOSI = U1.PB3 U4.SDI U5.SDI
```

**Default rendering is automatic by fan-out**: a net with fewer than the label
threshold (default **3**) members is drawn as routed wire; a net that meets it is
rendered as **net labels** — a named tag at each member pin, no copper drawn. The
threshold is configurable with `set labelThreshold=N` (§7) or
`render(src, { labelThreshold })`. Override per net:

```elmo-src
net BUS = U1.D0 U2.D0 U3.D0  as=wire     # force routed wire despite fan-out
net TX  = U1.TX J1.RX        as=label    # force a label despite low fan-out
```

### 5.2 Power nets (rendered as power symbols)

```elmo-src
power VCC = U1.VCC U1.AVCC J1.VCC R1.1
power 3V3 = U6.VDD
```

**Not routed as wires.** Each member pin gets a VCC/power flag glyph. This is the
single most important rendering rule — it keeps schematics legible.

### 5.3 Ground nets (rendered as ground symbols)

```elmo-src
gnd GND = U1.8 U1.22 J1.GND C1.2
gnd AGND sym=analog = U3.V- C5.2      # alternate ground symbol
```

Each member gets a ground symbol. Not routed.

### 5.4 Point-to-point wires

```elmo-src
wire U1.RX -- J1.TX      # neutral connection
wire U1.TX -> J1.RX      # same, plus a signal-flow hint to the router
```

Sugar for a two-member signal net. `--` is the canonical operator; `->` is an
accepted alias that additionally hints signal-flow direction to the layout router.
The arrow is a layout hint only — it never changes connectivity.

### 5.5 Pin references

`<ref>.<pin>` where `<pin>` is a number **or** a name/alias. `U1.7` and `U1.VCC`
may refer to the same pin. Ambiguous names (two pins named `GND`) must be
referenced by number.

### 5.6 Net-name scope (global merge)

Net names are **global**: the same name in two statements refers to **one** net
(KiCad semantics). This makes rails composable across a file —

```elmo-src
power VCC = U1.VCC
power VCC = U2.VCC       # merges into the single VCC net
```

Trade-off: a typo'd net name silently creates a second net. The linter mitigates
this by **warning on any net with a single member** (§11).

## 6. Layout hints (all optional)

The layout is automatic (elkjs); hints nudge it. Zero hints must still produce a valid render.

```text
place J1 right-of U1          # relative: left-of | right-of | above | below
place J2 below U1
near  C1 U1.VCC               # pin C1 adjacent to pin/pin-owner (decoupling caps)
group "Power supply" { U6 C3 C4 L1 }   # keep together, optional visible box
rotate Q1 90                  # 0|90|180|270
mirror U3                     # flip horizontally (op-amps etc.)
```

There is no absolute `at x,y` placement — layout is hint-only by design, so a
schematic never hard-codes coordinates that fight the router.

## 7. Directives & attributes

```text
title "USB-to-UART bridge"
theme dark                    # light | dark | mono
set labelThreshold=4          # signal nets with ≥ N members render as labels (default 3)
set grid=100 fontsize=12      # other renderer knobs (namespaced, ignored if unknown)
```

`set labelThreshold=N` tunes the fan-out at which a signal net stops routing as a
wire and renders as net labels (§5.1). The default is 3; set it high to force
wires, or low to prefer labels. `render(src, { labelThreshold })` overrides it.

**Attributes** on components (`pkg=`, `mpn=`, `footprint=`, `tol=`, `datasheet=`, …)
are **opaque pass-through metadata**: stored in the IR, never read by the layout or
render pipeline, available to future exporters (netlist/BOM/PCB). Unknown attrs are
kept, not rejected.

### 7.1 Reserved attributes

A few attribute keys are read by the pipeline rather than passed through:

| Attribute | Effect |
| --- | --- |
| `link="uri"` | Renders the component's ref (e.g. `U1`) as a hyperlink to `uri` — a datasheet, BOM entry, or wiki page. Wherever a renderer supports links (SVG `<a>`), the ref becomes clickable. |
| `pol=yes` | On a `cap`, selects the polarized capacitor symbol. |
| `sym=...` | On a `gnd` net, selects an alternate ground symbol (e.g. `sym=analog`). |
| `as=wire\|label` | On a `net`, forces routed wire or net labels regardless of fan-out (§5.1). |

```elmo
part U1 ic "ATmega328P" pkg=DIP-28 link="https://ww1.microchip.com/…/ATmega328P.pdf" {
  left 1:PC6 right 28:PC5
}
```

All other attributes remain opaque metadata.

## 8. Built-in symbol kinds

The `kind` token is open — the parser accepts any identifier and an unknown kind
falls back to a labelled box, so the set below grows without grammar changes.
Pins listed as `a/b` mean primary name with accepted aliases.

**Containers** (explicit pin-block):

| Keyword | Symbol | Pins |
| --- | --- | --- |
| `ic` | rectangle, pins per declared side | user-defined |
| `mod` / `module` | ready-made module box (ESP32, Pi Pico) — alias of `ic` | user-defined |
| `connector` | header/box | user-defined |

**Passives:**

| Keyword | Symbol | Pins |
| --- | --- | --- |
| `res` | resistor | 1, 2 |
| `cap` (`pol=yes` → polarized) | capacitor | 1/+, 2/- |
| `ind` | inductor | 1, 2 |
| `ferrite` | ferrite bead | 1, 2 |
| `fuse` | fuse | 1, 2 |
| `crystal` (`xtal`) | crystal | 1, 2 |
| `thermistor` (`ntc`/`ptc`) | thermistor | 1, 2 |
| `varistor` (`mov`) | varistor/MOV | 1, 2 |
| `rheostat` | variable resistor | 1, 2 |
| `pot` (`potentiometer`) | potentiometer | 1, 2, W/wiper |
| `transformer` | transformer | P1, P2, S1, S2 |

**Diode family** (anode/cathode):

| Keyword | Symbol | Pins |
| --- | --- | --- |
| `diode` | diode | anode/1, cathode/2 |
| `led` | LED | anode/1, cathode/2 |
| `zener` | Zener diode | anode/1, cathode/2 |
| `schottky` | Schottky diode | anode/1, cathode/2 |
| `tvs` | bidirectional TVS | 1, 2 |
| `photodiode` | photodiode | anode/1, cathode/2 |
| `varactor` | varactor | anode/1, cathode/2 |
| `bridge` | bridge rectifier | AC1, AC2, +, - |

**Transistors / FETs:**

| Keyword | Symbol | Pins |
| --- | --- | --- |
| `npn` / `pnp` | BJT | B, C, E |
| `darlington` | Darlington | B, C, E |
| `phototransistor` | phototransistor | B, C, E |
| `igbt` | IGBT | G, C, E |
| `nmos` / `pmos` | enhancement MOSFET | G, D, S |
| `nmos_dep` / `pmos_dep` | depletion MOSFET | G, D, S |
| `njfet` / `pjfet` (`jfet_n`/`jfet_p`) | JFET | G, D, S |

**Active / sources:**

| Keyword | Symbol | Pins |
| --- | --- | --- |
| `opamp` | op-amp triangle | +, -, out, V+, V- |
| `vsource` | voltage source | 1/+, 2/- |
| `isource` | current source | 1, 2 |
| `acsource` | AC source | 1, 2 |
| `battery` | battery | 1/+, 2/- |
| `lamp` | lamp | 1, 2 |
| `motor` | motor | 1, 2 |
| `speaker` | speaker | 1/+, 2/- |
| `buzzer` | buzzer | 1/+, 2/- |

**Switches / electromechanical:**

| Keyword | Symbol | Pins |
| --- | --- | --- |
| `switch_spst` (`spst`) | SPST switch | 1, 2 |
| `switch_spdt` (`spdt`) | SPDT switch | com, no, nc |
| `pushbutton` (`pushbtn`) | momentary button | 1, 2 |
| `relay` | relay (coil + SPDT) | A, B, com, no, nc |
| `antenna` | antenna | 1 |

**Net symbols** (not `part` kinds — see §5):

| Keyword | Symbol |
| --- | --- |
| `power` | VCC/rail flag |
| `gnd` | ground symbol |

User-registered custom symbols are post-v1.

## 9. Complete example

```elmo
title "555 astable"

part U1 ic "NE555" pkg=DIP-8 {
  left  2:TRIG  6:THRES  7:DISCH
  right 3:OUT   4:~RESET
  top   8:VCC
  bottom 1:GND
}
part R1 res 10k
part R2 res 47k
part C1 cap 10u pol=yes
part C2 cap 100n

power VCC = U1.VCC U1.~RESET R1.1
gnd   GND = U1.GND C1.- C2.2

net n_disch = U1.DISCH R1.2 R2.1
net n_thres = U1.THRES U1.TRIG R2.2 C1.+
net decouple = U1.VCC C2.1

place R1 above U1
near  C2 U1.VCC
```

## 10. Formal grammar (EBNF, provisional)

```text
document      = { statement } ;
statement     = import | def | component | net | hint | directive | comment ;

import        = "import" string [ "as" ident ] NL ;
def           = "def" ref kind [ label ] { attr } [ pinblock ] NL ;
component     = "part" ref kind [ label ] { attr } [ pinblock ] NL ;
kind          = ident ;   (* built-in (§8), a `def` template, else a labelled box *)
label         = string | value ;
attr          = ident "=" ( ident | value | string ) ;
pinblock      = "{" { pinline } "}" ;
pinline       = [ side ] pinentry { pinentry } NL ;
side          = "left" | "right" | "top" | "bottom" ;
pinentry      = [ pinnum ":" ] pinname | pinnum ;

net           = ( "net" | "power" | "gnd" ) netname { attr } "=" pinref { pinref } NL
              | "wire" pinref ( "--" | "->" ) pinref NL ;
pinref        = ref "." ( pinnum | pinname ) ;

hint          = "place" ref reldir ref NL
              | "near" ref pinref NL
              | "rotate" ref angle NL
              | "mirror" ref NL
              | "group" string "{" { ref } "}" NL ;
reldir        = "left-of" | "right-of" | "above" | "below" ;

directive     = "title" string NL
              | "theme" ident NL
              | "set" { attr } NL ;

ref           = ident ;
```

## 11. Decisions

All settled for v0.1-final.

1. **Declaration form** — single `part <ref> <kind> …`; no per-kind keywords.
2. **Pin numbering** — `ic` requires explicit `number:name`; `connector` may use bare names with implicit numbering.
3. **Net labels vs wires** — auto by fan-out (≥3 → labels), with `as=wire|label` override (§5.1).
4. **Buses** — **deferred past v1.** No `D[0:7]` slicing yet.
5. **Absolute placement** — **omitted.** Hints only; no `at x,y` (§6).
6. **Transistor pins** — named pins canonical (`C/B/E`, `G/D/S`), numeric aliases from the symbol def.
7. **Hierarchy / sheets** — **deferred.** v1 is single-sheet.
8. **Multiple grounds** — lightweight `gnd AGND sym=analog` form; no separate registry.
9. **Wire operator** — `--` canonical, `->` an alias adding a signal-flow hint (§5.4).
10. **Connector auto-numbering** — column-major for multi-row headers (§4.1).
11. **Label vs value** — one positional `value` field; explicit `name=`/`value=` attrs for the rare both-needed case (§4).
12. **Net-name scope** — global merge, KiCad semantics; linter warns on single-member nets (§5.6).

### Linter warnings (non-fatal, v1)

- Net with a single member (likely a typo'd name that failed to merge).
- Pin referenced by a name that matches multiple pins (ambiguous — use a number).
- Component declared but no pin referenced by any net (dangling part).

### Deferred to post-v1

Buses/vectors (`D[0:7]`), hierarchy/sub-sheets/`include`, absolute placement,
user-defined symbol registration, unit-aware value math.
