#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const DOCS_DIR = path.join(ROOT, "docs");
const OUT_FILE = path.join(DOCS_DIR, "ui-style-map.json");
const EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".css"]);

const GATE_COMPONENTS = new Set([
  "GatePanel",
  "GateHeader",
  "GateSection",
  "GateRow",
  "GateCard",
  "GateBadge",
  "GateButton",
  "GateFooter",
  "GatePage",
]);

const LEGACY_COMPONENTS = new Set([
  "Card",
  "Button",
  "Input",
  "Textarea",
  "Modal",
  "SelectMenu",
  "IconButton",
  "Select",
  "Badge",
  "AccentItem",
]);

const UI_SYSTEMS = ["gate", "legacy", "liquid", "glass"];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function uniq(values) {
  return Array.from(new Set(values));
}

function sortAsc(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function uniqSorted(values) {
  return sortAsc(uniq(values));
}

function relFromRoot(absPath) {
  return toPosix(path.relative(ROOT, absPath));
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      out.push(...(await walk(full)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    out.push(full);
  }
  return out;
}

function getKind(relPath) {
  if (relPath.startsWith("src/pages/")) return "page";
  if (relPath.startsWith("src/features/")) return "feature";
  if (relPath.startsWith("src/components/")) return "component";
  if (relPath.startsWith("src/shared/")) return "shared";
  if (relPath.startsWith("src/ui/")) return "ui";
  if (relPath.startsWith("src/hooks/")) return "hook";
  if (relPath.startsWith("src/auth/")) return "auth";
  if (relPath.startsWith("src/profile/")) return "profile";
  if (relPath.startsWith("src/data/")) return "data";
  if (relPath.startsWith("src/theme/")) return "theme";
  if (relPath.startsWith("src/infra/")) return "infra";
  if (relPath.endsWith(".css")) return "css";
  return "other";
}

function extractImports(text) {
  const out = [];
  const re = /import\s+[\s\S]*?\sfrom\s+["']([^"']+)["']/g;
  for (const match of text.matchAll(re)) out.push(match[1]);
  return uniqSorted(out);
}

function extractJsxComponents(text) {
  const out = [];
  const re = /<([A-Z][A-Za-z0-9_]*)\b/g;
  for (const match of text.matchAll(re)) out.push(match[1]);
  return uniqSorted(out);
}

function extractHtmlTags(text) {
  const out = [];
  const re = /<(button|input|select|textarea|dialog|form)\b/g;
  for (const match of text.matchAll(re)) out.push(match[1]);
  return uniqSorted(out);
}

function normalizeClassToken(token) {
  return token
    .replace(/\$\{[^}]+\}/g, "")
    .replace(/[\[\]{}(),?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractClassNames(text) {
  const out = [];
  const patterns = [
    /className\s*=\s*"([^"]+)"/g,
    /className\s*=\s*'([^']+)'/g,
    /className\s*=\s*\{`([^`]+)`\}/g,
    /className\s*=\s*\{"([^"]+)"\}/g,
    /class\s*=\s*"([^"]+)"/g,
  ];

  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const raw = normalizeClassToken(match[1]);
      if (!raw) continue;
      for (const chunk of raw.split(" ")) {
        const clean = chunk.replace(/[^A-Za-z0-9_-]/g, "").trim();
        if (!clean) continue;
        out.push(clean);
      }
    }
  }

  return uniqSorted(out);
}

function extractCssClassDefinitions(text) {
  const out = [];
  const re = /(^|[\s,{])\.([A-Za-z_][A-Za-z0-9_-]*)/gm;
  for (const match of text.matchAll(re)) out.push(match[2]);
  return uniqSorted(out);
}

function resolveImport(fromRelPath, importValue) {
  if (!importValue.startsWith(".")) return importValue;
  const fromAbsDir = path.dirname(path.join(ROOT, fromRelPath));
  const absolute = path.resolve(fromAbsDir, importValue);
  const rel = relFromRoot(absolute);
  return rel;
}

function isLegacyImport(value) {
  return (
    value.includes("/components/UI") ||
    value === "./UI" ||
    value === "../UI" ||
    value.endsWith("/UI")
  );
}

function isGateImport(value) {
  return value.includes("/shared/ui/gate/Gate") || value.includes("/shared/ui/gate/");
}

function isLiquidImport(value) {
  return value.includes("LiquidGlassSurface") || value.includes("liquidGlassSurface");
}

function inferUiSystems({ imports, components, classNames, classDefinitions }) {
  const set = new Set();

  if (imports.some(isGateImport)) set.add("gate");
  if (imports.some(isLegacyImport)) set.add("legacy");
  if (imports.some(isLiquidImport)) set.add("liquid");

  for (const name of components) {
    if (GATE_COMPONENTS.has(name) || name.startsWith("Gate")) set.add("gate");
    if (LEGACY_COMPONENTS.has(name)) set.add("legacy");
    if (name === "LiquidGlassSurface") set.add("liquid");
  }

  const glassMatcher = /^(glass|liquid|navMenu|glassTopbar|glassPanel|modalBackdrop|panel|drawer)/i;
  if (classNames.some((token) => glassMatcher.test(token))) set.add("glass");
  if (classDefinitions.some((token) => glassMatcher.test(token))) set.add("glass");

  if (
    classNames.some((token) => token.startsWith("gate")) ||
    classDefinitions.some((token) => token.startsWith("gate"))
  ) {
    set.add("gate");
  }

  return sortAsc(Array.from(set));
}

function byPathPrefix(files, prefix) {
  return files.filter((file) => file.path.startsWith(prefix));
}

function basenameWithoutExt(p) {
  const base = path.basename(p);
  const ext = path.extname(base);
  return base.slice(0, -ext.length);
}

function extractNavigation(appText, navText) {
  const tabs = [];
  const tabsBlock = navText.match(/const\s+TABS\s*=\s*new Set\(\[([\s\S]*?)\]\);/);
  if (tabsBlock) {
    for (const match of tabsBlock[1].matchAll(/"([^"]+)"/g)) {
      tabs.push(match[1]);
    }
  }

  const tabToPath = {};
  tabToPath.today = "/";
  tabToPath.library = "/";
  for (const match of navText.matchAll(/else if \(t === "([^"]+)"\) nextPath = "([^"]+)";/g)) {
    tabToPath[match[1]] = match[2];
  }

  const pathToTab = {};
  pathToTab["/"] = "today";
  for (const match of navText.matchAll(/else if \(initialPath\.startsWith\("([^"]+)"\)\) initialTab = "([^"]+)";/g)) {
    pathToTab[match[1]] = match[2];
  }
  if (navText.includes('initialPath.startsWith("/preferences") || initialPath.startsWith("/settings")')) {
    pathToTab["/preferences"] = "preferences";
    pathToTab["/settings"] = "preferences";
  }

  const redirects = [];
  for (const match of navText.matchAll(/window\.history\.replaceState\(\{\}, "", "([^"]+)"\);/g)) {
    redirects.push(match[1]);
  }

  const pageImportsFromApp = [];
  for (const match of appText.matchAll(/import\s+([A-Za-z0-9_]+)\s+from\s+"\.\/pages\/([^"]+)";/g)) {
    pageImportsFromApp.push({ component: match[1], module: `src/pages/${match[2]}.jsx` });
  }

  const nonPageImportsFromApp = [];
  for (const match of appText.matchAll(/import\s+([A-Za-z0-9_]+)\s+from\s+"\.\/([^";]+)";/g)) {
    if (match[2].startsWith("pages/")) continue;
    nonPageImportsFromApp.push({ component: match[1], module: `src/${match[2]}` });
  }

  const tabRenderMap = [];
  const tabRenderRe = /tab\s*===\s*"([^"]+)"(?:\s*&&[^?]+)?\s*\?\s*\(\s*<([A-Za-z0-9_]+)/g;
  for (const match of appText.matchAll(tabRenderRe)) {
    tabRenderMap.push({ tab: match[1], component: match[2] });
  }

  const appTags = extractJsxComponents(appText);
  const modalLike = appTags.filter((name) => /(Modal|Popover|Drawer|Overlay|Expander)$/.test(name));
  const transientViews = appTags.filter((name) =>
    /(Onboarding|Session|Category|Create|Edit|Progress)/.test(name)
  );

  return {
    tabs: uniqSorted(tabs),
    tabToPath,
    pathToTab,
    redirects: uniqSorted(redirects),
    pageImportsFromApp: sortAsc(pageImportsFromApp.map((entry) => `${entry.component}:${entry.module}`)).map(
      (raw) => {
        const [component, module] = raw.split(":");
        return { component, module };
      }
    ),
    nonPageImportsFromApp: sortAsc(
      nonPageImportsFromApp.map((entry) => `${entry.component}:${entry.module}`)
    ).map((raw) => {
      const [component, module] = raw.split(":");
      return { component, module };
    }),
    tabRenderMap: sortAsc(tabRenderMap.map((entry) => `${entry.tab}:${entry.component}`)).map((raw) => {
      const [tab, component] = raw.split(":");
      return { tab, component };
    }),
    appModalLikeComponents: uniqSorted(modalLike),
    appTransientViews: uniqSorted(transientViews),
  };
}

async function buildMap() {
  const filesAbs = await walk(SRC_DIR);

  const cssDefinitionIndex = new Map();
  const fileRecords = [];

  for (const absPath of filesAbs) {
    const relPath = relFromRoot(absPath);
    const text = await fs.readFile(absPath, "utf8");

    const imports = extractImports(text);
    const components = relPath.endsWith(".css") ? [] : extractJsxComponents(text);
    const htmlTags = relPath.endsWith(".css") ? [] : extractHtmlTags(text);
    const classNames = extractClassNames(text);
    const classDefinitions = relPath.endsWith(".css") ? extractCssClassDefinitions(text) : [];

    for (const className of classDefinitions) {
      if (!cssDefinitionIndex.has(className)) cssDefinitionIndex.set(className, new Set());
      cssDefinitionIndex.get(className).add(relPath);
    }

    const resolvedImports = imports.map((value) => ({
      raw: value,
      resolved: resolveImport(relPath, value),
      isCss: value.endsWith(".css"),
    }));

    const cssImports = resolvedImports.filter((entry) => entry.isCss).map((entry) => entry.resolved);

    const uiSystemsUsed = inferUiSystems({ imports, components, classNames, classDefinitions });

    fileRecords.push({
      path: relPath,
      kind: getKind(relPath),
      extension: path.extname(relPath),
      imports,
      importsResolved: resolvedImports,
      cssImports: uniqSorted(cssImports),
      jsxComponents: components,
      htmlTags,
      classNames,
      classDefinitions,
      hasInlineStyle: /style\s*=\s*\{\{/.test(text),
      hasDataTestId: /data-testid\s*=/.test(text),
      uiSystemsUsed,
    });
  }

  const classDefinitionIndex = {};
  for (const [className, fileSet] of cssDefinitionIndex.entries()) {
    classDefinitionIndex[className] = uniqSorted(Array.from(fileSet));
  }

  const classUsageIndex = {};
  for (const file of fileRecords) {
    for (const className of file.classNames) {
      if (!classUsageIndex[className]) classUsageIndex[className] = [];
      classUsageIndex[className].push(file.path);
    }
  }
  for (const className of Object.keys(classUsageIndex)) {
    classUsageIndex[className] = uniqSorted(classUsageIndex[className]);
  }

  for (const file of fileRecords) {
    const classLinks = {};
    for (const className of file.classNames) {
      classLinks[className] = classDefinitionIndex[className] || [];
    }
    file.classDefinitionFiles = classLinks;
  }

  const appText = await fs.readFile(path.join(SRC_DIR, "App.jsx"), "utf8");
  const navText = await fs.readFile(path.join(SRC_DIR, "hooks", "useAppNavigation.js"), "utf8");
  const navigation = extractNavigation(appText, navText);

  const pageRecords = byPathPrefix(fileRecords, "src/pages/");
  const featureRecords = byPathPrefix(fileRecords, "src/features/");
  const componentRecords = byPathPrefix(fileRecords, "src/components/");

  const pageByComponent = {};
  for (const item of navigation.pageImportsFromApp) {
    pageByComponent[item.component] = item.module;
  }

  const pagesFromTabs = [];
  for (const render of navigation.tabRenderMap) {
    pagesFromTabs.push({
      tab: render.tab,
      component: render.component,
      module: pageByComponent[render.component] || null,
    });
  }

  const routes = uniqSorted(
    Object.values(navigation.tabToPath)
      .concat(Object.keys(navigation.pathToTab))
      .concat(navigation.redirects)
      .filter(Boolean)
  );

  const jsxFiles = fileRecords.filter((file) => /\.(jsx|tsx|js|ts)$/.test(file.path));
  const allComponentUsage = uniqSorted(jsxFiles.flatMap((file) => file.jsxComponents));

  const modalComponents = allComponentUsage.filter((name) => /Modal$/.test(name));
  const popoverComponents = allComponentUsage.filter((name) => /Popover$/.test(name));
  const drawerComponents = allComponentUsage.filter((name) => /Drawer$/.test(name));
  const overlayComponents = allComponentUsage.filter((name) => /Overlay$/.test(name));

  const transientViews = uniqSorted(
    navigation.appTransientViews.concat(
      allComponentUsage.filter((name) => /(Create|Edit|Session|Progress|Category|Onboarding)/.test(name))
    )
  );

  const uiFiles = fileRecords.filter((file) => file.uiSystemsUsed.length > 0);
  const uiSystemCounts = Object.fromEntries(UI_SYSTEMS.map((system) => [system, 0]));
  for (const file of uiFiles) {
    for (const system of file.uiSystemsUsed) {
      uiSystemCounts[system] = (uiSystemCounts[system] || 0) + 1;
    }
  }

  const gateOnlyFiles = uiFiles.filter((file) =>
    file.uiSystemsUsed.includes("gate") && file.uiSystemsUsed.length === 1
  );
  const nonGateOnlyFiles = uiFiles.filter((file) => !file.uiSystemsUsed.includes("gate"));
  const mixedFiles = uiFiles.filter((file) => file.uiSystemsUsed.length > 1);

  return {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: {
      gatePrimitives: ["src/shared/ui/gate/Gate.jsx", "src/shared/ui/gate/gate.css"],
      visualReferences: ["src/components/CategoryGateModal.jsx", "src/ui/create/CreateFlowModal.jsx"],
    },
    routing: {
      tabs: navigation.tabs,
      tabToPath: navigation.tabToPath,
      pathToTab: navigation.pathToTab,
      redirects: navigation.redirects,
      routes,
      pageImportsFromApp: navigation.pageImportsFromApp,
      tabRenderMap: navigation.tabRenderMap,
    },
    userCanReach: {
      pagesFromTabs: sortAsc(pagesFromTabs.map((item) => `${item.tab}:${item.component}:${item.module || ""}`)).map(
        (raw) => {
          const [tab, component, module] = raw.split(":");
          return { tab, component, module: module || null };
        }
      ),
      appPageImports: navigation.pageImportsFromApp,
      modalComponents: uniqSorted(modalComponents.concat(navigation.appModalLikeComponents.filter((n) => /Modal$/.test(n)))),
      popoverComponents: uniqSorted(popoverComponents.concat(navigation.appModalLikeComponents.filter((n) => /Popover$/.test(n)))),
      drawerComponents: uniqSorted(drawerComponents.concat(navigation.appModalLikeComponents.filter((n) => /Drawer$/.test(n)))),
      overlayComponents: uniqSorted(overlayComponents.concat(navigation.appModalLikeComponents.filter((n) => /Overlay$/.test(n)))),
      transientViews,
    },
    inventory: {
      totals: {
        filesScanned: fileRecords.length,
        uiFiles: uiFiles.length,
        pages: pageRecords.length,
        features: featureRecords.length,
        components: componentRecords.length,
      },
      files: fileRecords,
      pages: pageRecords,
      features: featureRecords,
      components: componentRecords,
      classDefinitionIndex,
      classUsageIndex,
    },
    summary: {
      uiSystemCounts,
      gateOnlyFiles: gateOnlyFiles.length,
      nonGateOnlyFiles: nonGateOnlyFiles.length,
      mixedFiles: mixedFiles.length,
      gateCoveragePercent: uiFiles.length
        ? Number(((gateOnlyFiles.length / uiFiles.length) * 100).toFixed(2))
        : 0,
      nonGateCoveragePercent: uiFiles.length
        ? Number(((nonGateOnlyFiles.length / uiFiles.length) * 100).toFixed(2))
        : 0,
    },
  };
}

async function main() {
  const styleMap = await buildMap();
  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, `${JSON.stringify(styleMap, null, 2)}\n`, "utf8");

  const relOut = relFromRoot(OUT_FILE);
  console.log(`[ui-audit-scan] wrote ${relOut}`);
  console.log(`[ui-audit-scan] files scanned: ${styleMap.inventory.totals.filesScanned}`);
  console.log(`[ui-audit-scan] ui files: ${styleMap.inventory.totals.uiFiles}`);
}

main().catch((error) => {
  console.error("[ui-audit-scan] failed", error);
  process.exitCode = 1;
});
