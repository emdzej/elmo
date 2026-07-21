# How-to

## Embed in Markdown (markdown-it)

The plugin is two-phase because layout is async: `renderElmo` pre-renders the
fences, then `md.render` runs.

```ts
import MarkdownIt from "markdown-it";
import elmo, { renderElmo } from "@emdzej/elmo-markdown-it";

const md = new MarkdownIt().use(elmo);
const html = await renderElmo(md, "# Title\n\n```elmo\npart R1 res 10k\n```");
```

## Embed in MDX / Docusaurus / Astro (remark)

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
  .process(markdown);
```

## Theme a diagram

Force a palette with the `theme` directive (or `render(src, { theme })`):

```elmo
theme dark
part R1 res 10k
part R2 res 4k7
net s = R1.2 R2.1
```

Without a `theme` directive, diagrams follow the viewer's light/dark preference.

## Tune the wire/label threshold

Signal nets route as wires up to a fan-out, then switch to net labels (default 3
members). Change it with `set labelThreshold=N` or `render(src, { labelThreshold })`:

```elmo
set labelThreshold=5
part U1 ic "MCU" { right 1:D0 2:D1 3:D2 }
part U2 ic "IO" { left 1:D0 2:D1 3:D2 }
net D0 = U1.D0 U2.D0
```

## Split a design across files

Use `import` to reuse subcircuits. A named import puts everything in a namespace;
rails (`power`/`gnd`) still merge with the parent.

`psu.elmo`:

```elmo
part U1 ic "AMS1117-3.3" pkg=SOT-223 { left 3:IN right 2:OUT bottom 1:GND }
part C1 cap 10u
net vout = U1.OUT C1.1
gnd GND = U1.GND C1.2
```

`board.elmo`:

```elmo
import "psu.elmo" as psu
part U2 mod "ESP32-WROOM" { left 1:GND 2:3V3 }
wire psu.U1.OUT -- U2.3V3
gnd GND = psu.U1.GND U2.GND
```

Imports need a resolver — a function mapping a path to source. The CLI resolves
relative to the importing file; in code pass `render(src, { resolve, path })`.

In environments without a filesystem, use a **virtual file map**:

```ts
import { render, mapResolver } from "@emdzej/elmo-core";

const resolve = mapResolver({ "psu.elmo": "part U1 ic { ... }" });
const { svg } = await render(boardSource, { resolve });
```

The Markdown plugins and browser bundle accept the same — pass `files` (a map)
or `resolve` to `renderElmo(md, src, { files })`, `remarkElmo({ files })`, or
`elmo.run(root, { files })`. In the browser you can also declare library files
inline and they are picked up automatically:

```html
<script type="text/elmo-file" data-path="psu.elmo">part U1 ic { ... }</script>
<pre class="elmo">import "psu.elmo" as psu
...</pre>
```

## Netlist & BOM

The pass-through metadata feeds exporters — no layout needed:

```ts
import { parse, netlist, netlistToText, bom, bomToCsv } from "@emdzej/elmo-core";

const { schematic } = parse(source);
console.log(netlistToText(netlist(schematic)));
console.log(bomToCsv(bom(schematic)));
```

Or from the CLI:

```bash
elmo netlist circuit.elmo
elmo bom circuit.elmo --csv
elmo check circuit.elmo
```
