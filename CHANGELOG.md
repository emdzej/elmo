# Changelog

All notable changes to elmo are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-20

First public release. elmo (ELectronics MOdeling, Schematics as a code) is a text
DSL that renders circuits as schematics, embeddable in Markdown.

### Added

- **Language & core (`@emdzej/elmo-core`)**
  - Hand-written parser for the elmo DSL → intermediate representation.
  - Single `part <ref> <kind> [value] [attrs] [{ pins }]` component form; `ic`,
    `connector`, and `mod`/`module` render as pin-labelled boxes.
  - Nets: `wire`, `net` (auto wire/label by fan-out with a configurable
    `set labelThreshold=N`, plus `as=wire|label` override), `power`, and `gnd`
    (rendered as rail/ground symbols, never routed).
  - `import "file" [as ns]` — split designs across files; namespaces prefix refs
    and signal nets while power/ground rails stay global; transitive imports are
    flattened, re-declarations are last-wins with a warning, cycles are broken.
  - Shared-pin connectivity merge so tee'd wires form one electrical net.
  - Layout and orthogonal routing via [elkjs](https://github.com/kieler/elkjs),
    with junction dots, clean pin legs, and readable label halos.
  - ~45 iconic symbols: passives, diodes (incl. zener/schottky/tvs/bridge),
    transistors and FETs (BJT/Darlington/IGBT/MOSFET/JFET), sources, switches,
    relay, antenna, and more.
  - Orientation: `rotate` and `mirror` hints plus connection-driven
    auto-rotation, via an affine local-frame transform (labels stay upright).
  - Placement hints: `place` (left/right/above/below), `near`, and `group`
    (a labelled box drawn around a subsystem).
  - Theming: `theme dark|light|mono` directive (or `render(src, { theme })`);
    otherwise diagrams follow the viewer's colour-scheme preference.
  - `link="uri"` attribute renders a part's ref as a hyperlink.
  - Opaque pass-through metadata (`pkg`, `mpn`, `footprint`, …).
  - Netlist and BOM exporters (`netlist`, `netlistToText`, `bom`, `bomToCsv`).
  - Async `render(source)` returning SVG plus diagnostics.
- **Plugins**
  - `@emdzej/elmo-markdown-it` — two-phase (`renderElmo`) markdown-it plugin.
  - `@emdzej/elmo-remark` — async remark/unified plugin for MDX pipelines.
  - `@emdzej/elmo-browser` — client-side bundle that renders `elmo` blocks on load.
- **Tooling**
  - `@emdzej/elmo-cli` — the `elmo` command (`render`, `check`, `netlist`, `bom`).
  - VitePress documentation site with live in-browser diagrams.
  - GitHub Actions: CI, npm trusted publishing on release, and Pages deploy.

[0.1.0]: https://github.com/emdzej/elmo/releases/tag/v0.1.0
