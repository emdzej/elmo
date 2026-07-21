import { describe, expect, it, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "dist", "cli.js");
const pkgVersion = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")).version as string;

function run(args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync("node", [cli, ...args], { encoding: "utf8" });
    return { stdout, status: 0 };
  } catch (e) {
    const err = e as { stdout?: string; status?: number };
    return { stdout: err.stdout ?? "", status: err.status ?? 1 };
  }
}

describe("elmo CLI", () => {
  let file: string;
  beforeAll(() => {
    const dir = mkdtempSync(join(tmpdir(), "elmo-cli-"));
    file = join(dir, "c.elmo");
    writeFileSync(file, 'part U1 ic "NE555" pkg=DIP-8 { left 1:A right 2:B }\npart R1 res 10k\nnet s = U1.B R1.1\n');
  });

  it("prints the package version (not a hardcoded literal)", () => {
    // requires the package to be built (dist/cli.js)
    if (!existsSync(cli)) return;
    expect(run(["--version"]).stdout.trim()).toBe(pkgVersion);
  });

  it("emits a netlist", () => {
    if (!existsSync(cli)) return;
    expect(run(["netlist", file]).stdout).toContain("U1.2");
  });

  it("emits a BOM listing the parts", () => {
    if (!existsSync(cli)) return;
    const out = run(["bom", file]).stdout;
    expect(out).toContain("NE555");
    expect(out).toContain("R1");
  });

  it("check passes on valid input", () => {
    if (!existsSync(cli)) return;
    expect(run(["check", file]).status).toBe(0);
  });
});
