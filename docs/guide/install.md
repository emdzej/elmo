# Install

elmo is published as a small set of packages under the `@emdzej` scope. Install
only what you need.

## Core (parse + render)

```bash
npm install @emdzej/elmo-core
```

```ts
import { render } from "@emdzej/elmo-core";

const { svg } = await render(`
part R1 res 10k
part R2 res 4k7
net s = R1.2 R2.1
`);
```

`render` is async (layout runs on elkjs) and returns the SVG plus any diagnostics.

## Markdown

For markdown-it (VitePress, mkdocs-node, …):

```bash
npm install @emdzej/elmo-markdown-it markdown-it
```

For remark / unified (MDX, Docusaurus, Astro):

```bash
npm install @emdzej/elmo-remark
```

## CLI

```bash
npm install -g @emdzej/elmo-cli
elmo render circuit.elmo -o circuit.svg
```

## Browser

Drop the bundle on any page and write `elmo` blocks — they render on load:

```html
<script src="https://unpkg.com/@emdzej/elmo-browser/dist/elmo.min.js"></script>
<pre class="elmo">
part R1 res 10k
part R2 res 4k7
net s = R1.2 R2.1
</pre>
```
