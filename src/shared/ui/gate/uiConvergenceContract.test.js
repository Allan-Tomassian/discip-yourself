import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(nextPath));
      continue;
    }
    if (!/\.(js|jsx)$/.test(entry.name)) continue;
    files.push(nextPath);
  }
  return files;
}

describe("UI convergence contract", () => {
  it("removes active imports of the legacy UI wrapper", () => {
    const offenders = walk(SRC_ROOT)
      .filter((file) => !file.endsWith(path.join("src", "components", "UI.jsx")))
      .filter((file) => /src[\\/](auth|pages|features|ui|components|profile)[\\/]/.test(file))
      .filter((file) => {
        const source = fs.readFileSync(file, "utf8");
        return /from ["'](?:\.\/UI|(?:\.\.\/)+components\/UI)["']/.test(source);
      })
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });
});
