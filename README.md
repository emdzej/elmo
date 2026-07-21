# elmo

**elmo = ELectronics MOdeling, Schematics as a code.** A text DSL for describing
circuits that renders as schematics — embeddable in Markdown code fences, in the
spirit of Mermaid and PlantUML.

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

power VCC = U1.VCC U1.~RESET R1.1
gnd   GND = U1.GND
net n_thres = U1.THRES U1.TRIG R2.2
wire U1.OUT -> R1.1
```

The full language is specified in [`docs/language-spec.md`](docs/language-spec.md)
(v0.1-final).

## Packages

| Package | What it does |
| --- | --- |
| [`@emdzej/elmo-core`](packages/elmo-core) | Parse the DSL → IR → layout → SVG. Async `render(source)` entry point. |
| [`@emdzej/elmo-markdown-it`](packages/elmo-markdown-it) | markdown-it plugin (two-phase `renderElmo`) that turns ` ```elmo ` fences into inline SVG. |
| [`@emdzej/elmo-remark`](packages/elmo-remark) | remark/unified plugin (async) for the MDX/Docusaurus/Astro ecosystem. |
| [`@emdzej/elmo-browser`](packages/elmo-browser) | Client-side bundle — drop `elmo.min.js` on a page to render `elmo` blocks (Mermaid-style). |
| [`@emdzej/elmo-cli`](packages/elmo-cli) | `elmo` command — render, check, and export netlist/BOM from `.elmo` files. |

## Usage

Core (async — layout runs on elkjs):

```ts
import { render } from "@emdzej/elmo-core";

const { svg, diagnostics } = await render(source);
```

markdown-it (two-phase: `renderElmo` pre-renders fences, then runs `md.render`):

```ts
import MarkdownIt from "markdown-it";
import elmo, { renderElmo } from "@emdzej/elmo-markdown-it";

const md = new MarkdownIt().use(elmo);
const html = await renderElmo(md, markdownWithElmoFences);
```

remark / unified (async transformer — works in MDX pipelines):

```ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import remarkElmo from "@emdzej/elmo-remark";

const html = await unified()
  .use(remarkParse)
  .use(remarkElmo)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeStringify, { allowDangerousHtml: true })
  .process(markdownWithElmoFences);
```

Browser (client-side, like Mermaid):

```html
<script src="elmo.min.js"></script>
<pre class="elmo">part R1 res 10k ...</pre>
<!-- elmo.run() renders every elmo block on load -->

<!-- imports: define reusable library files inline, then import them -->
<script type="text/elmo-file" data-path="psu.elmo">part U1 ic { ... }</script>
<pre class="elmo">import "psu.elmo" as psu
...</pre>
```

Netlist & BOM from the same source (uses the pass-through `pkg`/`mpn`/`footprint` metadata):

```ts
import { parse, netlist, netlistToText, bom, bomToCsv } from "@emdzej/elmo-core";

const { schematic } = parse(source);
console.log(netlistToText(netlist(schematic))); // electrical netlist
console.log(bomToCsv(bom(schematic))); // bill of materials, CSV
```

Split a design across files with `import` (needs a resolver — the CLI uses the
filesystem; elsewhere pass `mapResolver({ … })` or a `files` map):

```elmo
import "psu.elmo" as psu
part U2 mod "ESP32-WROOM" { left 1:GND 2:3V3 }
wire psu.U1.OUT -- U2.3V3
gnd GND = psu.U1.GND U2.GND
```

Force a palette with the `theme dark|light|mono` directive (or `render(src, { theme })`);
without it, diagrams follow the viewer's light/dark preference. `rotate R1 90`,
`mirror U3`, `group "PSU" { … }`, and `part … link="uri"` are also supported.

## Development

```bash
pnpm install
pnpm build       # build all packages (topological)
pnpm test        # vitest
pnpm lint:md     # markdownlint docs
pnpm docs:dev    # VitePress docs site (live diagrams)
pnpm docs:build  # build the static docs site
```

Docs deploy to <https://elmo.emdzej.pl> and packages publish to npm on release
(GitHub Actions in `.github/workflows/`).

## License

[MIT](LICENSE) © emdzej

## Features

- **Layout & routing** — elkjs places components by signal flow and routes signal
  nets as orthogonal wires (2-member by default; 3+ with `as=wire`), with junction
  dots where wires tee. Power/ground render as symbols and are never routed.
- **~45 iconic symbols** — passives (R/C/L, ferrite, fuse, crystal, thermistor,
  varistor, pot, transformer), diodes (incl. zener/schottky/TVS/bridge),
  transistors & FETs (BJT/Darlington/IGBT/MOSFET/JFET), sources, switches, relay,
  antenna. `ic`/`connector`/`mod` are pin-labelled boxes; unknown kinds fall back
  to a box. See the [symbol catalogue](docs/symbols.md).
- **Orientation & placement** — `rotate`/`mirror`, connection-driven
  auto-rotation, and `place`/`near`/`group` hints.
- **Imports** — split designs across files with namespaces; rails stay global.
- **Theming** — `theme dark|light|mono`, else responsive to the viewer.
- **Exports** — netlist and BOM from the same source, using pass-through metadata.
- **Everywhere** — markdown-it & remark plugins, a browser bundle, and a CLI.

Post-v1: buses/vectors and hierarchical sub-sheets.

See [`examples/`](examples/) for a 555 astable, a routed RC buffer, a Pi Pico
blink, a cross-file board import, and the full symbol gallery.
