---
layout: home
hero:
  name: elmo
  text: Schematics as code
  tagline: ELectronics MOdeling — a text DSL that renders as schematics, embeddable in Markdown.
  image:
    src: /elmo-icon.svg
    alt: elmo
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Language spec
      link: /language-spec
features:
  - title: Readable DSL
    details: Describe parts, pins, and nets in a terse, git-friendly text format — diff it, review it, generate it.
  - title: Real schematics
    details: elkjs placement and orthogonal routing, junction dots, ~45 iconic symbols, rotate/mirror, groups.
  - title: Embed anywhere
    details: markdown-it and remark plugins, a client-side browser bundle, and a CLI — plus netlist and BOM export.
---

## Try it

The block below is written in elmo and rendered live in your browser:

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
part C1 cap 10n

power VCC = U1.VCC U1.~RESET R1.1
gnd   GND = U1.GND C1.2

net disch  = U1.DISCH R1.2 R2.1        as=wire
net timing = U1.THRES U1.TRIG R2.2 C1.1 as=wire
```
