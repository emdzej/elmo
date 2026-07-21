---
layout: home
hero:
  name: elmo
  text: Schematics as code
  tagline: '<span class="elmo-accent">EL</span>ectronics <span class="elmo-accent">MO</span>deling — a text DSL that renders as schematics, embeddable in Markdown.'
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

Edit the elmo source below — it renders live in your browser as you type. Pick an
example to get started.

<ElmoPlayground />
