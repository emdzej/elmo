#!/usr/bin/env node
// elmo CLI — render schematics and export netlists/BOMs from .elmo files.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import chalk from "chalk";
import {
  render,
  parse,
  validate,
  ElmoError,
  netlist,
  netlistToText,
  bom,
  bomToCsv,
  type Diagnostic,
  type ImportResolver,
} from "@emdzej/elmo-core";

const read = (file: string): string => readFileSync(file, "utf8");

// version from package.json so it can't drift from a hardcoded literal
const pkgVersion = (): string => {
  try {
    const url = new URL("../package.json", import.meta.url);
    return JSON.parse(readFileSync(fileURLToPath(url), "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
};

// Resolve `import "…"` relative to the importing file. Trust boundary: this is a
// local CLI run on the user's own files, so there is deliberately no confinement
// to a project root. Do NOT reuse this resolver as-is in a server that renders
// untrusted input — confine it to an allowed root first (see AGENTS.md).
const fsResolver: ImportResolver = (spec, fromPath) => {
  const path = resolvePath(fromPath ? dirname(fromPath) : process.cwd(), spec);
  try {
    return { path, source: readFileSync(path, "utf8") };
  } catch (err) {
    // a genuine missing file → let the parser report "cannot resolve import";
    // any other IO error (permissions, is-a-directory, …) should surface
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw new Error(`reading import '${spec}' (${path}): ${err instanceof Error ? err.message : String(err)}`);
  }
};
const abs = (file: string): string => resolvePath(process.cwd(), file);

function printDiagnostics(diags: Diagnostic[]): void {
  for (const d of diags) {
    const where = d.line ? chalk.dim(`${d.line}:${d.col} `) : "";
    const tag = d.severity === "error" ? chalk.red("error") : chalk.yellow("warning");
    process.stderr.write(`  ${where}${tag} ${d.message}\n`);
  }
}

function fail(err: unknown): never {
  if (err instanceof ElmoError) {
    process.stderr.write(chalk.red("✗ elmo failed\n"));
    printDiagnostics(err.diagnostics);
  } else {
    process.stderr.write(chalk.red(`✗ ${err instanceof Error ? err.message : String(err)}\n`));
  }
  process.exit(1);
}

const program = new Command();
program.name("elmo").description("elmo — electronics modeling, schematics as code").version(pkgVersion());

program
  .command("render <file>")
  .description("render an .elmo file to SVG")
  .option("-o, --out <file>", "write SVG to a file instead of stdout")
  .option("--theme <theme>", "force palette: light | dark | mono")
  .action(async (file: string, opts: { out?: string; theme?: string }) => {
    try {
      const { svg, diagnostics } = await render(read(file), {
        ...(opts.theme ? { theme: opts.theme } : {}),
        resolve: fsResolver,
        path: abs(file),
      });
      if (diagnostics.length) printDiagnostics(diagnostics);
      if (opts.out) {
        writeFileSync(opts.out, svg);
        process.stderr.write(chalk.green(`✓ wrote ${opts.out}\n`));
      } else {
        process.stdout.write(svg);
      }
    } catch (err) {
      fail(err);
    }
  });

program
  .command("check <file>")
  .description("parse and validate, reporting diagnostics")
  .action((file: string) => {
    const { schematic, diagnostics } = parse(read(file), { resolve: fsResolver, path: abs(file) });
    const all = [...diagnostics, ...validate(schematic)];
    if (all.length === 0) {
      process.stderr.write(chalk.green("✓ no problems\n"));
      return;
    }
    printDiagnostics(all);
    const errors = all.filter((d) => d.severity === "error").length;
    const warnings = all.length - errors;
    process.stderr.write(chalk.dim(`${errors} error(s), ${warnings} warning(s)\n`));
    if (errors) process.exit(1);
  });

program
  .command("netlist <file>")
  .description("print the electrical netlist")
  .action((file: string) => {
    try {
      process.stdout.write(netlistToText(netlist(parse(read(file), { resolve: fsResolver, path: abs(file) }).schematic)) + "\n");
    } catch (err) {
      fail(err);
    }
  });

program
  .command("bom <file>")
  .description("print the bill of materials")
  .option("--csv", "emit CSV")
  .action((file: string, opts: { csv?: boolean }) => {
    try {
      const rows = bom(parse(read(file), { resolve: fsResolver, path: abs(file) }).schematic);
      if (opts.csv) {
        process.stdout.write(bomToCsv(rows) + "\n");
        return;
      }
      for (const r of rows) {
        const val = r.value ? ` ${chalk.cyan(r.value)}` : "";
        const fp = r.footprint ? chalk.dim(` [${r.footprint}]`) : "";
        process.stdout.write(`${chalk.bold(String(r.qty).padStart(2))}  ${r.refs.join(", ")}  ${r.kind}${val}${fp}\n`);
      }
    } catch (err) {
      fail(err);
    }
  });

program.parseAsync(process.argv).catch(fail);
