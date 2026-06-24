#!/usr/bin/env node
import {
  formatBundleFindings,
  scanProductionBundle,
} from "./release-validation-core.mjs";

function parseArgs(argv) {
  const args = { distDir: "dist" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dist") {
      args.distDir = argv[index + 1] || "dist";
      index += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const result = scanProductionBundle({ root: process.cwd(), distDir: args.distDir });
console.log(formatBundleFindings(result));
process.exit(result.ok ? 0 : 1);
