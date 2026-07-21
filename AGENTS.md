# AGENTS.md

Guidance for AI agents working in the elmo repository.

## What elmo is

elmo (ELectronics MOdeling, Schematics as a code) is a text DSL that renders
electronic circuits as SVG schematics, embeddable in Markdown. The pipeline is:
parse → IR → normalize connectivity → elkjs layout + orthogonal routing → SVG.

## Repository layout

This is a pnpm workspace. Packages live under `packages/`:

| Package | Purpose |
| --- | --- |
| `@emdzej/elmo-core` | Parser, IR, layout, symbols, SVG renderer, netlist/BOM. The heart. |
| `@emdzej/elmo-markdown-it` | markdown-it plugin (two-phase, async via `renderElmo`). |
| `@emdzej/elmo-remark` | remark/unified plugin (async transformer). |
| `@emdzej/elmo-browser` | esbuild IIFE bundle for client-side rendering. |
| `@emdzej/elmo-cli` | `elmo` command (render/check/netlist/bom). |

- `docs/` — VitePress site **and** the canonical `language-spec.md`.
- `examples/` — `.elmo` sources plus their rendered `.svg`.

## Core module map (`packages/elmo-core/src`)

- `types.ts` — the IR (`Schematic`, `Component`, `Pin`, `Net`, `Hint`, `Diagnostic`).
- `parser.ts` — hand-written tokenizer + recursive-descent parser.
- `kinds.ts` — component kinds, their implicit pins, and kind aliases.
- `symbols.ts` — one draw function per iconic symbol (local-frame geometry).
- `transform.ts` — affine transforms for `rotate`/`mirror`.
- `normalize.ts` — merges shared-pin nets; applies orientation hints.
- `nets.ts` — `netMode()`: how each net renders (power/gnd/wire/label).
- `layout.ts` — elkjs placement + routing; two-pass for auto-rotation and place/near.
- `render.ts` — SVG emission, theming, junction dots, z-ordering.
- `exporters.ts` — netlist and BOM.
- `index.ts` — public API; `render()` is async.

## Commands

```bash
pnpm install
pnpm build       # Turborepo: build all packages (topological, cached)
pnpm typecheck   # Turborepo: tsc --noEmit per package
pnpm test        # vitest — keep this green
pnpm lint:md     # markdownlint — keep this at 0 errors
pnpm docs:dev    # VitePress dev server with live diagrams
```

`build`/`typecheck` run through **Turborepo** (`turbo.json`); the cache lives in
`.turbo/`. `test` and `lint:md` are still plain root scripts.

## Conventions (please follow)

- **The language spec (`docs/language-spec.md`) is the contract.** Change it in
  lockstep with parser/renderer behaviour.
- **Never use `---` horizontal rules in Markdown.** Structure with headings.
- **Run `pnpm lint:md` to 0 errors** for any docs change.
- **`render()` is async** (layout runs on elkjs). Anything calling it awaits.
- **Rendering rules are load-bearing:** power/ground draw as symbols and are
  never routed; only signal nets route. Keep it that way — it is what makes the
  output legible.
- **Symbols draw in a local frame** and are mapped to the world by a transform;
  text is drawn upright in world space so labels never rotate. Preserve this when
  adding symbols.
- **Verify visually.** After renderer/layout changes, render an example to SVG
  and rasterize it (e.g. `qlmanage -t`) to actually look at the output — tests
  alone do not catch layout regressions.
- Match the surrounding code style; TypeScript is `strict`.

## Security & trust boundary

elmo renders potentially untrusted `.elmo` source to SVG that is inlined into a
page (playground, browser bundle, Markdown plugins). Two rules keep that safe:

- **URLs are sanitized.** The `link=` attribute goes through `safeHref` in
  `util.ts` (allowlist: http/https/mailto + relative/fragment). Any new place
  that emits a URL into output must reuse it. `escapeHtml` (also in `util.ts`) is
  the single escaper — don't hand-roll another.
- **Import resolvers are a trust boundary.** A resolver can read arbitrary
  content (the CLI's fs resolver has no root confinement — fine for a local
  tool). If you ever wire an fs-backed resolver into a **server** that renders
  untrusted input, confine resolution to an allowed root and cap parse/layout
  work (component/net counts, source size, import depth) — the core sets no such
  limits today.

## Adding a new symbol (common task)

1. Add the kind (and any pin definition/alias) in `kinds.ts`.
2. Add a draw function in `symbols.ts` and register it in the `SYMBOLS` map.
3. Add the keyword to spec §8 (`docs/language-spec.md`) and the docs symbol catalogue.
4. Extend the parametric symbols test in `packages/elmo-core/test/symbols.test.ts`.
5. Render `examples/gallery.elmo` and eyeball it.
