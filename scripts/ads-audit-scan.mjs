#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const OUT_FILE = path.join(DOCS_DIR, "ads-map.json");

const SCAN_DIRS = ["src", "tests", "docs"];
const SCAN_FILES = ["package.json", "package-lock.json", "README.md", "index.html"];
const EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".css", ".md", ".json", ".mjs", ".cjs", ".html"]);
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "coverage", "test-results"]);
const IGNORE_FILE_PATTERNS = [/^docs\/ads-map\.json$/i, /^docs\/ads-audit\.md$/i, /^docs\/ads-ready-checklist\.md$/i, /^docs\/ads-risk-appstore\.md$/i];

const KEYWORD_RULES = [
  { key: "ads", re: /\bads?\b/i },
  { key: "admob", re: /\badmob\b/i },
  { key: "unity", re: /\bunity(?:\s*ads?)?\b/i },
  { key: "rewarded", re: /\breward(?:ed|s)?\b/i },
  { key: "interstitial", re: /\binterstitial\b/i },
  { key: "banner", re: /\bbanner\b/i },
  { key: "iap", re: /\biap\b|\bin[\s-]?app\s+purchase\b/i },
  { key: "restore", re: /\brestore\b/i },
  { key: "tracking", re: /\btracking\b|\btracker\b/i },
  { key: "idfa", re: /\bidfa\b/i },
  { key: "att", re: /\batt\b|app\s+tracking\s+transparency/i },
  { key: "consent", re: /\bconsent\b/i },
  { key: "gdpr", re: /\bgdpr\b/i },
];

const ENV_RE = /\b(?:VITE_[A-Z0-9_]*ADS[A-Z0-9_]*|ADS_[A-Z0-9_]+|ADMOB_[A-Z0-9_]+|UNITY_[A-Z0-9_]+|ATT_[A-Z0-9_]+|IDFA_[A-Z0-9_]+|CONSENT_[A-Z0-9_]+)\b/g;
const IMPORT_RE = /import\s+[^\n]*from\s+["']([^"']+)["']/g;

const AD_SDK_PATTERNS = [
  /(^|[/_-])admob($|[/_-])/i,
  /(^|[/_-])google-mobile-ads($|[/_-])/i,
  /(^|[/_-])react-native-google-mobile-ads($|[/_-])/i,
  /(^|[/_-])unity-?ads?($|[/_-])/i,
  /(^|[/_-])ironsource($|[/_-])/i,
  /(^|[/_-])applovin($|[/_-])/i,
  /(^|[/_-])chartboost($|[/_-])/i,
  /(^|[/_-])vungle($|[/_-])/i,
  /(^|[/_-])adcolony($|[/_-])/i,
  /(^|[/_-])pangle($|[/_-])/i,
  /(^|[/_-])facebook-ads($|[/_-])/i,
  /(^|[/_-])meta-audience-network($|[/_-])/i,
  /(^|[/_-])appsflyer($|[/_-])/i,
  /(^|[/_-])tracking-transparency($|[/_-])/i,
  /(^|[/_-])ump($|[/_-])/i,
  /(^|[/_-])cookieconsent($|[/_-])/i,
];

function matchesSdkName(name) {
  return AD_SDK_PATTERNS.some((pattern) => pattern.test(name));
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function rel(absPath) {
  return toPosix(path.relative(ROOT, absPath));
}

function snippet(line) {
  return String(line || "").trim().slice(0, 120);
}

async function exists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

function isIgnoredFile(relPath) {
  return IGNORE_FILE_PATTERNS.some((rule) => rule.test(relPath));
}

async function walk(absDir) {
  const out = [];
  if (!(await exists(absDir))) return out;

  const entries = await fs.readdir(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(absDir, entry.name);
    const relPath = rel(full);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      out.push(...(await walk(full)));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    if (isIgnoredFile(relPath)) continue;
    out.push(full);
  }

  return out;
}

function extractKeywordHits(text, file) {
  const lines = text.split(/\r?\n/);
  const hits = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const matches = KEYWORD_RULES.filter((rule) => rule.re.test(line)).map((rule) => rule.key);
    if (!matches.length) continue;
    hits.push({
      file,
      line: i + 1,
      keywords: matches,
      snippet: snippet(line),
    });
  }

  return hits;
}

function extractEnvHits(text, file) {
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const vars = [...line.matchAll(ENV_RE)].map((m) => m[0]);
    if (!vars.length) continue;
    hits.push({ file, line: i + 1, vars: Array.from(new Set(vars)), snippet: snippet(line) });
  }
  return hits;
}

function extractImports(text, file) {
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (const match of text.matchAll(IMPORT_RE)) {
    const spec = String(match[1] || "");
    if (!matchesSdkName(spec)) continue;
    const line = text.slice(0, match.index ?? 0).split(/\r?\n/).length;
    hits.push({ file, line, specifier: spec, snippet: snippet(lines[line - 1]) });
  }
  return hits;
}

function groupByKeyword(hits) {
  const grouped = {};
  for (const hit of hits) {
    for (const keyword of hit.keywords || []) {
      grouped[keyword] = (grouped[keyword] || 0) + 1;
    }
  }
  return grouped;
}

async function readJsonIfExists(absPath) {
  if (!(await exists(absPath))) return null;
  try {
    return JSON.parse(await fs.readFile(absPath, "utf8"));
  } catch {
    return null;
  }
}

function extractSdkDepsFromPackageJson(pkg) {
  if (!pkg || typeof pkg !== "object") return [];
  const buckets = [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies, pkg.optionalDependencies];
  const found = [];

  for (const bucket of buckets) {
    if (!bucket || typeof bucket !== "object") continue;
    for (const [name, version] of Object.entries(bucket)) {
      if (!matchesSdkName(name)) continue;
      found.push({ name, version: String(version || "") });
    }
  }

  return found;
}

function extractSdkDepsFromPackageLock(lock) {
  if (!lock || typeof lock !== "object") return [];
  const found = [];

  const add = (name, version, source) => {
    if (!matchesSdkName(name)) return;
    found.push({ name, version: String(version || ""), source });
  };

  if (lock.dependencies && typeof lock.dependencies === "object") {
    for (const [name, meta] of Object.entries(lock.dependencies)) {
      add(name, meta?.version, "dependencies");
    }
  }

  if (lock.packages && typeof lock.packages === "object") {
    for (const [pkgPath, meta] of Object.entries(lock.packages)) {
      if (!pkgPath.startsWith("node_modules/")) continue;
      const name = pkgPath.slice("node_modules/".length);
      add(name, meta?.version, "packages");
    }
  }

  const uniq = new Map();
  for (const dep of found) {
    const key = `${dep.name}@${dep.version}`;
    if (!uniq.has(key)) uniq.set(key, dep);
  }

  return [...uniq.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const files = [];

  for (const dir of SCAN_DIRS) {
    files.push(...(await walk(path.join(ROOT, dir))));
  }

  for (const file of SCAN_FILES) {
    const abs = path.join(ROOT, file);
    if (await exists(abs) && !isIgnoredFile(rel(abs))) files.push(abs);
  }

  const seen = new Set();
  const uniqueFiles = files.filter((abs) => {
    const key = rel(abs);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const keywordHits = [];
  const envHits = [];
  const importHits = [];
  const fileSummaries = [];

  for (const abs of uniqueFiles) {
    const file = rel(abs);
    let text = "";
    try {
      text = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }

    const k = extractKeywordHits(text, file);
    const e = extractEnvHits(text, file);
    const i = extractImports(text, file);

    keywordHits.push(...k);
    envHits.push(...e);
    importHits.push(...i);

    if (k.length || e.length || i.length) {
      fileSummaries.push({
        file,
        keywordHitCount: k.length,
        envHitCount: e.length,
        importHitCount: i.length,
      });
    }
  }

  const pkg = await readJsonIfExists(path.join(ROOT, "package.json"));
  const lock = await readJsonIfExists(path.join(ROOT, "package-lock.json"));
  const packageJsonSdkDeps = extractSdkDepsFromPackageJson(pkg);
  const packageLockSdkDeps = extractSdkDepsFromPackageLock(lock);

  const map = {
    generatedAt: new Date().toISOString(),
    root: ROOT,
    scan: {
      dirs: SCAN_DIRS,
      files: SCAN_FILES,
      ignored: [...IGNORE_DIRS],
      ignoredFiles: IGNORE_FILE_PATTERNS.map((r) => String(r)),
      totalFiles: uniqueFiles.length,
    },
    keywordIndex: KEYWORD_RULES.map((rule) => rule.key),
    keywordHits,
    envHits,
    importHits,
    packageJsonSdkDeps,
    packageLockSdkDeps,
    aggregates: {
      keywordCounts: groupByKeyword(keywordHits),
      envVarCount: envHits.reduce((acc, hit) => acc + (hit.vars?.length || 0), 0),
      importHitCount: importHits.length,
      filesWithAnyHit: fileSummaries.length,
    },
    fileSummaries: fileSummaries
      .sort((a, b) => (b.keywordHitCount + b.envHitCount + b.importHitCount) - (a.keywordHitCount + a.envHitCount + a.importHitCount))
      .slice(0, 300),
  };

  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, `${JSON.stringify(map, null, 2)}\n`, "utf8");

  console.log(`[ads-audit-scan] wrote ${rel(OUT_FILE)}`);
  console.log(`[ads-audit-scan] scanned ${uniqueFiles.length} files, found ${keywordHits.length} keyword hits`);
}

main().catch((error) => {
  console.error("[ads-audit-scan] failed", error);
  process.exit(1);
});
