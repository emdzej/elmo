// Hand-written tokenizer + parser for the elmo DSL (spec v0.1-final).
//
// The grammar is keyword-driven and line-oriented, which makes a small scanner
// simpler and more robust than a generic lexer: the DSL's context-sensitive `-`
// (in `left-of`, `header-1x4`, `--`, `->`, `V-`) is a nightmare for regex lexers
// but a non-issue here because operators are always whitespace-delimited.

import type { Diagnostic, Hint, NetKind, NetMember, Net, ParseOptions, Pin, Schematic, Side } from "./types.js";
import { KINDS, resolveKind } from "./kinds.js";

interface Token {
  v: string;
  quoted: boolean;
  line: number;
  col: number;
}

const STATEMENT_KEYWORDS = new Set([
  "import",
  "part",
  "net",
  "power",
  "gnd",
  "wire",
  "place",
  "near",
  "rotate",
  "mirror",
  "group",
  "title",
  "theme",
  "set",
]);

const SIDES = new Set<string>(["left", "right", "top", "bottom"]);
const RELDIRS = new Set(["left-of", "right-of", "above", "below"]);

// ── tokenizer ────────────────────────────────────────────────────────────

export function tokenize(src: string): { tokens: Token[]; diagnostics: Diagnostic[] } {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  const lines = src.split(/\r?\n/);

  lines.forEach((raw, idx) => {
    const line = idx + 1;
    let i = 0;
    let cur = "";
    let curCol = 0;
    let inQuote = false;

    const flush = () => {
      if (cur.length > 0) {
        tokens.push({ v: cur, quoted: false, line, col: curCol + 1 });
        cur = "";
      }
    };

    while (i < raw.length) {
      const ch = raw[i]!;
      if (inQuote) {
        if (ch === '"') {
          tokens.push({ v: cur, quoted: true, line, col: curCol + 1 });
          cur = "";
          inQuote = false;
        } else {
          cur += ch;
        }
        i++;
        continue;
      }
      if (ch === "#") break; // comment to end of line
      if (ch === '"') {
        flush();
        inQuote = true;
        curCol = i;
        i++;
        continue;
      }
      if (ch === " " || ch === "\t") {
        flush();
        i++;
        continue;
      }
      if (ch === "{" || ch === "}") {
        flush();
        tokens.push({ v: ch, quoted: false, line, col: i + 1 });
        i++;
        continue;
      }
      if (cur.length === 0) curCol = i;
      cur += ch;
      i++;
    }
    if (inQuote) {
      diagnostics.push({ severity: "error", message: "Unterminated string", line, col: curCol + 1 });
      tokens.push({ v: cur, quoted: true, line, col: curCol + 1 });
    } else {
      flush();
    }
  });

  return { tokens, diagnostics };
}

// ── parser ───────────────────────────────────────────────────────────────

class TokenStream {
  private pos = 0;
  constructor(private readonly toks: Token[]) {}
  peek(): Token | undefined {
    return this.toks[this.pos];
  }
  next(): Token | undefined {
    return this.toks[this.pos++];
  }
  atStatementBoundary(): boolean {
    const t = this.peek();
    return !t || (!t.quoted && STATEMENT_KEYWORDS.has(t.v));
  }
}

function splitFirst(s: string, sep: string): [string, string | undefined] {
  const idx = s.indexOf(sep);
  if (idx < 0) return [s, undefined];
  return [s.slice(0, idx), s.slice(idx + 1)];
}

export function parse(src: string, opts?: ParseOptions): { schematic: Schematic; diagnostics: Diagnostic[] } {
  const { tokens, diagnostics } = tokenize(src);
  const ts = new TokenStream(tokens);
  const schematic: Schematic = {
    settings: {},
    components: [],
    nets: [],
    hints: [],
    imports: [],
  };
  let wireCounter = 0;

  const err = (message: string, t?: Token) =>
    diagnostics.push({ severity: "error", message, line: t?.line ?? 0, col: t?.col ?? 0 });

  while (ts.peek()) {
    const head = ts.next()!;
    if (head.quoted || !STATEMENT_KEYWORDS.has(head.v)) {
      err(`Unexpected token '${head.v}' (expected a statement keyword)`, head);
      continue;
    }
    switch (head.v) {
      case "import":
        parseImport(ts, schematic, err);
        break;
      case "part":
        parsePart(ts, schematic, err);
        break;
      case "net":
      case "power":
      case "gnd":
        parseNet(head.v, ts, schematic, err);
        break;
      case "wire":
        parseWire(ts, schematic, err, wireCounter++);
        break;
      case "place":
      case "near":
      case "rotate":
      case "mirror":
      case "group":
        parseHint(head.v, ts, schematic, err);
        break;
      case "title":
      case "theme":
        parseDirective(head.v, ts, schematic, err);
        break;
      case "set":
        parseSet(ts, schematic);
        break;
    }
  }

  const imports = schematic.imports ?? [];
  if (imports.length === 0) return { schematic, diagnostics };
  if (!opts?.resolve) {
    for (const imp of imports) {
      err(`cannot resolve import '${imp.spec}': no import resolver configured`, {
        v: "",
        quoted: false,
        line: imp.line,
        col: imp.col,
      });
    }
    return { schematic, diagnostics };
  }
  const stack = opts._stack ?? new Set<string>(opts.path ? [opts.path] : []);
  return applyImports(schematic, diagnostics, opts, stack);
}

type Err = (message: string, t?: Token) => void;

function parseImport(ts: TokenStream, schematic: Schematic, err: Err): void {
  const spec = ts.next();
  if (!spec || !spec.quoted) return err("import: expected a quoted file path", spec);
  let ns = "";
  if (ts.peek() && !ts.peek()!.quoted && ts.peek()!.v === "as") {
    ts.next(); // consume `as`
    const nsTok = ts.next();
    if (!nsTok || nsTok.quoted) return err('import: expected a namespace name after "as"', nsTok);
    ns = nsTok.v;
  }
  schematic.imports!.push({ spec: spec.v, ns, line: spec.line, col: spec.col });
}

interface Layer {
  components: Schematic["components"];
  nets: Net[];
  hints: Hint[];
}

/** Prefix a sub-schematic into a namespace: refs and signal-net names get the
 * `ns.` prefix; power/gnd net names stay global so rails merge with the parent. */
function namespacePrefix(sch: Schematic, ns: string): Layer {
  if (!ns) return { components: sch.components, nets: sch.nets, hints: sch.hints };
  const p = (ref: string) => `${ns}.${ref}`;
  const components = sch.components.map((c) => ({ ...c, ref: p(c.ref) }));
  const nets: Net[] = sch.nets.map((net) => ({
    ...net,
    name: net.kind === "signal" ? p(net.name) : net.name,
    members: net.members.map((m) => ({ ...m, ref: p(m.ref) })),
  }));
  const hints: Hint[] = sch.hints.map((h) => {
    switch (h.type) {
      case "place":
        return { ...h, ref: p(h.ref), anchor: p(h.anchor) };
      case "near":
        return { ...h, ref: p(h.ref), target: { ...h.target, ref: p(h.target.ref) } };
      case "rotate":
      case "mirror":
        return { ...h, ref: p(h.ref) };
      case "group":
        return { ...h, refs: h.refs.map(p) };
    }
  });
  return { components, nets, hints };
}

/** Merge layers low→high precedence. Later layers override earlier component
 * refs (last-declaration-wins) with a warning; nets and hints accumulate. */
function mergeLayers(layers: Layer[], diagnostics: Diagnostic[]): Layer {
  const order: string[] = [];
  const byRef = new Map<string, Schematic["components"][number]>();
  for (const layer of layers) {
    for (const c of layer.components) {
      if (byRef.has(c.ref)) {
        diagnostics.push({ severity: "warning", message: `redeclared component '${c.ref}' (last declaration wins)`, line: 0, col: 0 });
      } else {
        order.push(c.ref);
      }
      byRef.set(c.ref, c);
    }
  }
  return {
    components: order.map((r) => byRef.get(r)!),
    nets: layers.flatMap((l) => l.nets),
    hints: layers.flatMap((l) => l.hints),
  };
}

/** Re-resolve net members / near targets whose ref carries a namespace prefix.
 * A parent wrote `foo.R1.2`; naive first-dot split gives ref=foo. Rejoin and
 * match the longest known component ref (`foo.R1`), leaving pin `2`. */
function resolveMemberRefs(sch: Schematic): void {
  const refs = sch.components.map((c) => c.ref);
  const refSet = new Set(refs);
  const sorted = [...refs].sort((a, b) => b.length - a.length);
  const fix = (m: NetMember): NetMember => {
    if (refSet.has(m.ref)) return m; // already a valid ref
    const token = `${m.ref}.${m.pin}`;
    for (const r of sorted) if (token === r || token.startsWith(r + ".")) return { ref: r, pin: token.slice(r.length + 1) };
    return m; // unresolved — validate will report it
  };
  for (const net of sch.nets) net.members = net.members.map(fix);
  for (const h of sch.hints) {
    if (h.type === "near" && h.target.pin) {
      const f = fix(h.target as NetMember);
      h.target = { ref: f.ref, pin: f.pin };
    }
  }
}

function applyImports(
  schematic: Schematic,
  diagnostics: Diagnostic[],
  opts: ParseOptions,
  stack: Set<string>,
): { schematic: Schematic; diagnostics: Diagnostic[] } {
  const layers: Layer[] = [];
  for (const imp of schematic.imports ?? []) {
    const r = opts.resolve!(imp.spec, opts.path);
    if (!r) {
      diagnostics.push({ severity: "error", message: `cannot resolve import '${imp.spec}'`, line: imp.line, col: imp.col });
      continue;
    }
    if (stack.has(r.path)) {
      diagnostics.push({ severity: "warning", message: `circular import '${imp.spec}' skipped`, line: imp.line, col: imp.col });
      continue;
    }
    stack.add(r.path);
    const sub = parse(r.source, { resolve: opts.resolve, path: r.path, _stack: stack });
    stack.delete(r.path);
    for (const d of sub.diagnostics) diagnostics.push(d);
    layers.push(namespacePrefix(sub.schematic, imp.ns));
  }
  layers.push({ components: schematic.components, nets: schematic.nets, hints: schematic.hints });
  const merged = mergeLayers(layers, diagnostics);
  const result: Schematic = {
    title: schematic.title,
    theme: schematic.theme,
    settings: schematic.settings,
    imports: [],
    ...merged,
  };
  resolveMemberRefs(result);
  return { schematic: result, diagnostics };
}

function parsePart(ts: TokenStream, schematic: Schematic, err: Err): void {
  const refTok = ts.next();
  const kindTok = ts.next();
  if (!refTok || refTok.quoted) return err("part: expected a ref", refTok);
  if (!kindTok || kindTok.quoted) return err("part: expected a kind", kindTok);
  const ref = refTok.v;
  const kind = resolveKind(kindTok.v);
  const attrs: Record<string, string> = {};
  let value: string | undefined;
  let pins: Pin[] | undefined;

  // label, attrs (before or after the pin block), and the pin block, in any order
  while (ts.peek() && !ts.atStatementBoundary()) {
    const t = ts.peek()!;
    if (t.v === "{") {
      pins = parsePinBlock(ts, kind, err);
      continue;
    }
    ts.next();
    if (t.quoted) {
      value ??= t.v;
    } else if (t.v.includes("=")) {
      const [k, v] = splitFirst(t.v, "=");
      // `key="quoted value"` tokenizes as `key=` + a separate quoted string
      const val = v === "" && ts.peek()?.quoted ? ts.next()!.v : (v ?? "");
      attrs[k] = val;
    } else if (value === undefined) {
      value = t.v;
    } else {
      err(`part ${ref}: unexpected token '${t.v}'`, t);
    }
  }

  schematic.components.push({ ref, kind, value, attrs, pins: pins ?? implicitPins(kind) });
}

function implicitPins(kind: string): Pin[] {
  const def = KINDS[kind];
  if (!def?.pins) return [];
  return def.pins.map((p) => ({
    id: p.number,
    name: p.name,
    number: p.number,
    side: p.side,
    aliases: p.aliases,
  }));
}

function parsePinBlock(ts: TokenStream, kind: string, err: Err): Pin[] {
  ts.next(); // consume '{'
  const def = KINDS[kind];
  const defaultSide: Side = def?.defaultSide ?? "left";
  const pins: Pin[] = [];
  let side: Side = defaultSide;
  let autoNum = 0;

  while (ts.peek() && ts.peek()!.v !== "}") {
    const t = ts.next()!;
    if (!t.quoted && SIDES.has(t.v)) {
      side = t.v as Side;
      continue;
    }
    const [rawNum, rawName] = splitFirst(t.v, ":");
    let number: string | undefined;
    let name: string;
    if (rawName !== undefined) {
      number = rawNum;
      name = rawName;
    } else if (/^[0-9]+$/.test(rawNum)) {
      number = rawNum; // bare number → name equals number
      name = rawNum;
    } else {
      name = rawNum; // bare name → auto-numbered
      number = String(++autoNum);
    }
    pins.push({ id: number ?? name, name, number, side });
  }
  if (ts.peek()?.v === "}") ts.next();
  else err("Unterminated pin block: missing '}'");
  return pins;
}

function parseNet(keyword: string, ts: TokenStream, schematic: Schematic, err: Err): void {
  const kind: NetKind = keyword === "net" ? "signal" : (keyword as NetKind);
  const nameTok = ts.next();
  if (!nameTok || nameTok.quoted) return err(`${keyword}: expected a net name`, nameTok);
  const attrs: Record<string, string> = {};
  const members: NetMember[] = [];

  while (ts.peek() && !ts.atStatementBoundary()) {
    const t = ts.next()!;
    if (t.v === "=") continue; // separator between name/attrs and members
    if (t.v.includes("=")) {
      const [k, v] = splitFirst(t.v, "=");
      attrs[k] = v ?? "";
    } else {
      const [r, pin] = splitFirst(t.v, ".");
      if (pin === undefined) err(`${keyword} ${nameTok.v}: '${t.v}' is not a pin reference (ref.pin)`, t);
      else members.push({ ref: r, pin });
    }
  }
  schematic.nets.push({ name: nameTok.v, kind, attrs, members });
}

function parseWire(ts: TokenStream, schematic: Schematic, err: Err, n: number): void {
  const a = ts.next();
  const op = ts.next();
  const b = ts.next();
  if (!a || !op || !b) return err("wire: expected 'A -- B' or 'A -> B'", a ?? op ?? b);
  if (op.v !== "--" && op.v !== "->") return err(`wire: expected '--' or '->', got '${op.v}'`, op);
  const parseRef = (t: Token): NetMember | undefined => {
    const [r, pin] = splitFirst(t.v, ".");
    if (pin === undefined) {
      err(`wire: '${t.v}' is not a pin reference (ref.pin)`, t);
      return undefined;
    }
    return { ref: r, pin };
  };
  const ma = parseRef(a);
  const mb = parseRef(b);
  if (!ma || !mb) return;
  schematic.nets.push({
    name: `_w${n}`,
    kind: "signal",
    attrs: {},
    members: [ma, mb],
    synthetic: true,
    directed: op.v === "->",
  });
}

function parseHint(keyword: string, ts: TokenStream, schematic: Schematic, err: Err): void {
  if (keyword === "place") {
    const ref = ts.next();
    const rel = ts.next();
    const anchor = ts.next();
    if (!ref || !rel || !anchor) return err("place: expected 'place <ref> <reldir> <ref>'", ref);
    if (!RELDIRS.has(rel.v)) return err(`place: unknown direction '${rel.v}'`, rel);
    schematic.hints.push({
      type: "place",
      ref: ref.v,
      rel: rel.v as "left-of" | "right-of" | "above" | "below",
      anchor: anchor.v,
    });
  } else if (keyword === "near") {
    const ref = ts.next();
    const target = ts.next();
    if (!ref || !target) return err("near: expected 'near <ref> <ref.pin|ref>'", ref);
    const [r, pin] = splitFirst(target.v, ".");
    schematic.hints.push({ type: "near", ref: ref.v, target: { ref: r, pin: pin ?? "" } });
  } else if (keyword === "rotate") {
    const ref = ts.next();
    const angle = ts.next();
    if (!ref || !angle) return err("rotate: expected 'rotate <ref> <angle>'", ref);
    const a = Number(angle.v);
    if (![0, 90, 180, 270].includes(a)) return err(`rotate: angle must be 0/90/180/270, got '${angle.v}'`, angle);
    schematic.hints.push({ type: "rotate", ref: ref.v, angle: a as 0 | 90 | 180 | 270 });
  } else if (keyword === "mirror") {
    const ref = ts.next();
    if (!ref) return err("mirror: expected 'mirror <ref>'", ref);
    schematic.hints.push({ type: "mirror", ref: ref.v });
  } else if (keyword === "group") {
    const label = ts.next();
    if (!label) return err("group: expected a label", label);
    const refs: string[] = [];
    if (ts.peek()?.v === "{") {
      ts.next();
      while (ts.peek() && ts.peek()!.v !== "}") refs.push(ts.next()!.v);
      if (ts.peek()?.v === "}") ts.next();
      else err("group: missing '}'");
    }
    schematic.hints.push({ type: "group", label: label.v, refs });
  }
}

function parseDirective(keyword: "title" | "theme", ts: TokenStream, schematic: Schematic, err: Err): void {
  const t = ts.next();
  if (!t) return err(`${keyword}: expected a value`, t);
  if (keyword === "title") schematic.title = t.v;
  else schematic.theme = t.v;
}

function parseSet(ts: TokenStream, schematic: Schematic): void {
  while (ts.peek() && !ts.atStatementBoundary()) {
    const t = ts.next()!;
    if (t.v.includes("=")) {
      const [k, v] = splitFirst(t.v, "=");
      schematic.settings[k] = v ?? "";
    }
  }
}
