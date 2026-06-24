#!/usr/bin/env node
import {
  formatValidationResults,
  hasFailures,
  readEnvFile,
  validateProductionEnvironment,
} from "./release-validation-core.mjs";

function parseArgs(argv) {
  const args = {
    frontendEnvFiles: [],
    backendEnvFiles: [],
    productionOrigin: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--frontend-env") {
      args.frontendEnvFiles.push(argv[index + 1] || "");
      index += 1;
      continue;
    }
    if (arg === "--backend-env") {
      args.backendEnvFiles.push(argv[index + 1] || "");
      index += 1;
      continue;
    }
    if (arg === "--production-origin") {
      args.productionOrigin = argv[index + 1] || "";
      index += 1;
    }
  }
  return args;
}

function mergeEnv(files) {
  return files.reduce(
    (acc, filePath) => ({
      ...acc,
      ...readEnvFile(filePath),
    }),
    { ...process.env }
  );
}

const args = parseArgs(process.argv.slice(2));
const frontendEnv = mergeEnv(args.frontendEnvFiles);
const backendEnv = mergeEnv(args.backendEnvFiles);
const results = validateProductionEnvironment({
  frontendEnv,
  backendEnv,
  productionWebOrigin: args.productionOrigin || process.env.PRODUCTION_WEB_ORIGIN,
});

console.log(formatValidationResults(results));
process.exit(hasFailures(results) ? 1 : 0);
