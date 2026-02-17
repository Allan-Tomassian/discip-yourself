#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const DOCS_DIR = path.join(ROOT, "docs");
const OUT_FILE = path.join(DOCS_DIR, "hamburger-map.json");
const EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".css"]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function rel(absPath) {
  return toPosix(path.relative(ROOT, absPath));
}

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function uniq(values) {
  return Array.from(new Set(values));
}

function uniqSorted(values) {
  return uniq(values).sort((a, b) => a.localeCompare(b));
}

function findAll(text, re) {
  const out = [];
  for (const match of text.matchAll(re)) {
    out.push({
      index: match.index ?? 0,
      line: lineAt(text, match.index ?? 0),
      match,
    });
  }
  return out;
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git", "dist"].includes(entry.name)) continue;
      out.push(...(await walk(full)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    out.push(full);
  }
  return out;
}

function parseTopNav(text, file) {
  const stateDecl = findAll(text, /const\s*\[(\w+),\s*(\w+)\]\s*=\s*useState\(/g)
    .map((m) => ({ file, line: m.line, state: m.match[1], setter: m.match[2] }));

  const trigger = findAll(text, /data-tour-id="topnav-settings"/g)[0] || null;
  const triggerClass = findAll(text, /className=\{`navMenuTrigger\$\{menuOpen \? " navMenuTriggerOpen" : ""\}`\}/g)[0] || null;
  const triggerOnClick = findAll(text, /onClick=\{\(\) => \{\s*setMenuOpen\(\(prev\) => !prev\);\s*\}\}/g)[0] || null;

  const popoverConditional = findAll(text, /\{menuOpen \? \(/g).map((m) => ({ file, line: m.line }));
  const popoverMount = findAll(text, /<TopMenuPopover\b/g)[0] || null;
  const popoverLayer = findAll(text, /className="topMenuPopoverLayer"/g)[0] || null;
  const scrim = findAll(text, /className="topMenuScrim(?: [^"]+)?"/g)[0] || null;

  const inlineScrimZ = findAll(text, /topMenuScrim[\s\S]{0,180}?zIndex:\s*(\d+)/g)[0] || null;
  const inlineLayerZ = findAll(text, /topMenuPopoverLayer[\s\S]{0,260}?zIndex:\s*(\d+)/g)[0] || null;

  const refs = {
    topbarRef: findAll(text, /const\s+topbarRef\s*=\s*useRef\(/g)[0] || null,
    menuRef: findAll(text, /const\s+menuRef\s*=\s*useRef\(/g)[0] || null,
    menuButtonRef: findAll(text, /const\s+menuButtonRef\s*=\s*useRef\(/g)[0] || null,
  };

  const computeLayout = findAll(text, /const\s+computeMenuLayout\s*=\s*useCallback\(/g)[0] || null;

  return {
    stateDecl,
    trigger: trigger ? { file, line: trigger.line } : null,
    triggerClass: triggerClass ? { file, line: triggerClass.line } : null,
    triggerOnClick: triggerOnClick ? { file, line: triggerOnClick.line } : null,
    popoverConditional,
    popoverMount: popoverMount ? { file, line: popoverMount.line } : null,
    popoverLayer: popoverLayer ? { file, line: popoverLayer.line } : null,
    scrim: scrim ? { file, line: scrim.line } : null,
    inlineScrimZ: inlineScrimZ
      ? { file, line: inlineScrimZ.line, zIndex: Number(inlineScrimZ.match[1]) }
      : null,
    inlineLayerZ: inlineLayerZ
      ? { file, line: inlineLayerZ.line, zIndex: Number(inlineLayerZ.match[1]) }
      : null,
    refs: Object.fromEntries(
      Object.entries(refs).map(([k, v]) => [k, v ? { file, line: v.line } : null])
    ),
    computeLayout: computeLayout ? { file, line: computeLayout.line } : null,
  };
}

function parseTopMenuPopover(text, file) {
  const itemsBlock = text.match(/const\s+MENU_ITEMS\s*=\s*\[([\s\S]*?)\];/);
  const items = [];
  if (itemsBlock) {
    const baseIndex = text.indexOf(itemsBlock[0]);
    const itemRe = /\{\s*id:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"\s*,\s*subtitle:\s*"([^"]+)"\s*,\s*group:\s*"([^"]+)"\s*\}/g;
    for (const match of itemsBlock[1].matchAll(itemRe)) {
      const absoluteIndex = baseIndex + (match.index ?? 0);
      items.push({
        id: match[1],
        label: match[2],
        subtitle: match[3],
        group: match[4],
        file,
        line: lineAt(text, absoluteIndex),
      });
    }
  }

  const handleAction = findAll(text, /function\s+handleAction\(itemId\)/g)[0] || null;
  const onNavigateCall = findAll(text, /onNavigate\(itemId\)/g)[0] || null;

  return {
    items,
    handleAction: handleAction ? { file, line: handleAction.line } : null,
    onNavigateCall: onNavigateCall ? { file, line: onNavigateCall.line } : null,
  };
}

function parseUseAppNavigation(text, file) {
  const tabs = [];
  const tabsMatch = text.match(/const\s+TABS\s*=\s*new Set\(\[([\s\S]*?)\]\);/);
  if (tabsMatch) {
    for (const m of tabsMatch[1].matchAll(/"([^"]+)"/g)) tabs.push(m[1]);
  }

  const pathFromTab = [];
  for (const m of text.matchAll(/else if \(t === "([^"]+)"\) nextPath = "([^"]+)";/g)) {
    pathFromTab.push({ tab: m[1], path: m[2], line: lineAt(text, m.index ?? 0), file });
  }

  const tabFromPath = [];
  for (const m of text.matchAll(/else if \(initialPath\.startsWith\("([^"]+)"\)\) initialTab = "([^"]+)";/g)) {
    tabFromPath.push({ path: m[1], tab: m[2], line: lineAt(text, m.index ?? 0), file });
  }

  const settingsRedirect = findAll(text, /window\.history\.replaceState\(\{\}, "", "\/preferences"\);/g)[0] || null;

  return {
    tabs,
    pathFromTab,
    tabFromPath,
    settingsRedirect: settingsRedirect ? { file, line: settingsRedirect.line } : null,
  };
}

function parseCssSelectors(text, file) {
  const selectors = [".topMenuScrim", ".topMenuPopoverLayer", ".topMenuGatePopover", ".topNavGateWrap", ".TopNavShell"];
  const lines = text.split("\n");

  const result = {};
  for (const sel of selectors) {
    const idx = lines.findIndex((line) => line.trim().startsWith(`${sel} {`));
    if (idx < 0) {
      result[sel] = null;
      continue;
    }

    const props = {};
    for (let i = idx + 1; i < lines.length; i += 1) {
      const raw = lines[i].trim();
      if (raw === "}") break;
      const propMatch = raw.match(/^([a-zA-Z-]+):\s*([^;]+);/);
      if (!propMatch) continue;
      props[propMatch[1]] = propMatch[2].trim();
    }

    result[sel] = { file, line: idx + 1, props };
  }

  return result;
}

async function main() {
  const files = await walk(SRC_DIR);
  const byPath = new Map();
  for (const abs of files) byPath.set(rel(abs), await fs.readFile(abs, "utf8"));

  const topNavFile = "src/components/TopNav.jsx";
  const topMenuFile = "src/components/TopMenuPopover.jsx";
  const appFile = "src/App.jsx";
  const navHookFile = "src/hooks/useAppNavigation.js";
  const navCssFile = "src/features/navigation/topMenuGate.css";

  const topNavText = byPath.get(topNavFile) || "";
  const topMenuText = byPath.get(topMenuFile) || "";
  const appText = byPath.get(appFile) || "";
  const navHookText = byPath.get(navHookFile) || "";
  const navCssText = byPath.get(navCssFile) || "";

  const appImportsTopNav = findAll(appText, /import\s+TopNav\s+from\s+"\.\/components\/TopNav";/g);
  const appRendersTopNav = findAll(appText, /<TopNav\b/g);

  const topNavParsed = parseTopNav(topNavText, topNavFile);
  const topMenuParsed = parseTopMenuPopover(topMenuText, topMenuFile);
  const navParsed = parseUseAppNavigation(navHookText, navHookFile);
  const navCssParsed = parseCssSelectors(navCssText, navCssFile);

  const portalMentions = [];
  for (const [file, text] of byPath.entries()) {
    for (const found of findAll(text, /createPortal|ReactDOM\.createPortal/g)) {
      portalMentions.push({ file, line: found.line, token: found.match[0] });
    }
  }

  const reactRouterMentions = [];
  for (const [file, text] of byPath.entries()) {
    for (const found of findAll(text, /<Routes\b|<Route\b|useNavigate\(|navigate\(/g)) {
      reactRouterMentions.push({ file, line: found.line, token: found.match[0] });
    }
  }

  const pageNames = [
    "Account",
    "Preferences",
    "Subscription",
    "Data",
    "Privacy",
    "Terms",
    "Support",
  ];

  const pageFiles = Object.fromEntries(
    pageNames.map((name) => [`src/pages/${name}.jsx`, byPath.has(`src/pages/${name}.jsx`)])
  );

  const menuTargets = topMenuParsed.items.map((item) => item.id);
  const missingTargetsInTabs = menuTargets.filter((id) => !navParsed.tabs.includes(id));

  const suspects = [];

  if (appImportsTopNav.length === 0 || appRendersTopNav.length === 0) {
    suspects.push({
      severity: "critical",
      code: "MENU_NOT_MOUNTED",
      reason: "TopNav import or render path missing in App.jsx",
      evidence: [
        `${appFile}#L${appImportsTopNav[0]?.line || "?"}`,
        `${appFile}#L${appRendersTopNav[0]?.line || "?"}`,
      ],
    });
  }

  if (!topNavParsed.trigger || !topNavParsed.triggerOnClick || topNavParsed.stateDecl.length === 0) {
    suspects.push({
      severity: "critical",
      code: "TRIGGER_OR_STATE_BROKEN",
      reason: "Hamburger trigger/state/toggle handler incomplete",
      evidence: [
        `${topNavFile}#L${topNavParsed.trigger?.line || "?"}`,
        `${topNavFile}#L${topNavParsed.triggerOnClick?.line || "?"}`,
      ],
    });
  }

  if (!topNavParsed.popoverMount || topNavParsed.popoverConditional.length === 0) {
    suspects.push({
      severity: "critical",
      code: "POPOVER_NOT_RENDERED",
      reason: "Conditional render for TopMenuPopover not detected",
      evidence: [
        `${topNavFile}#L${topNavParsed.popoverMount?.line || "?"}`,
      ],
    });
  }

  const cssScrimZ = Number(navCssParsed[".topMenuScrim"]?.props?.["z-index"] || NaN);
  const cssLayerZ = Number(navCssParsed[".topMenuPopoverLayer"]?.props?.["z-index"] || NaN);
  const inlineScrimZ = topNavParsed.inlineScrimZ?.zIndex;
  const inlineLayerZ = topNavParsed.inlineLayerZ?.zIndex;

  if (Number.isFinite(cssScrimZ) && Number.isFinite(cssLayerZ) && cssScrimZ >= cssLayerZ) {
    suspects.push({
      severity: "high",
      code: "SCRIM_OVER_MENU_CSS",
      reason: "CSS z-index places scrim above or equal popover layer",
      evidence: [
        `${navCssFile}#L${navCssParsed[".topMenuScrim"]?.line || "?"}`,
        `${navCssFile}#L${navCssParsed[".topMenuPopoverLayer"]?.line || "?"}`,
      ],
    });
  }

  if (Number.isFinite(inlineScrimZ) && Number.isFinite(inlineLayerZ) && inlineScrimZ >= inlineLayerZ) {
    suspects.push({
      severity: "high",
      code: "SCRIM_OVER_MENU_INLINE",
      reason: "Inline z-index places scrim above or equal popover layer",
      evidence: [
        `${topNavFile}#L${topNavParsed.inlineScrimZ?.line || "?"}`,
        `${topNavFile}#L${topNavParsed.inlineLayerZ?.line || "?"}`,
      ],
    });
  }

  if (!Number.isFinite(inlineScrimZ) || !Number.isFinite(inlineLayerZ)) {
    suspects.push({
      severity: "medium",
      code: "NO_INLINE_STACK_HINT",
      reason: "No explicit inline z-index found on scrim/layer (stacking may depend on parent contexts)",
      evidence: [
        `${topNavFile}#L${topNavParsed.scrim?.line || "?"}`,
        `${topNavFile}#L${topNavParsed.popoverLayer?.line || "?"}`,
      ],
    });
  }

  if (missingTargetsInTabs.length) {
    suspects.push({
      severity: "high",
      code: "MENU_TARGET_MISSING_IN_TABS",
      reason: `Menu items not present in tab registry: ${missingTargetsInTabs.join(", ")}`,
      evidence: [`${topMenuFile}#L${topMenuParsed.items[0]?.line || "?"}`, `${navHookFile}#L1`],
    });
  }

  const map = {
    generatedAt: new Date().toISOString(),
    components: {
      topNav: {
        file: topNavFile,
        importedInApp: appImportsTopNav.map((x) => ({ file: appFile, line: x.line })),
        renderedInApp: appRendersTopNav.map((x) => ({ file: appFile, line: x.line })),
      },
      topMenuPopover: {
        file: topMenuFile,
        importedInTopNav: findAll(topNavText, /import\s+TopMenuPopover\s+from\s+"\.\/TopMenuPopover";/g)
          .map((x) => ({ file: topNavFile, line: x.line })),
        mountedInTopNav: topNavParsed.popoverMount ? [{ file: topNavFile, line: topNavParsed.popoverMount.line }] : [],
      },
      gatePrimitivesMentions: findAll(topMenuText, /GatePanel|GateHeader|GateSection|GateRow|GateFooter|GateButton/g)
        .map((x) => ({ file: topMenuFile, line: x.line, token: x.match[0] })),
    },
    hamburgerTrigger: {
      selectorCandidates: ["navMenuTrigger", "navMenuBars", "topnav-settings"],
      buttonNode: topNavParsed.trigger,
      triggerClassNode: topNavParsed.triggerClass,
      triggerOnClickNode: topNavParsed.triggerOnClick,
      triggerAriaExpanded: findAll(topNavText, /aria-expanded=\{menuOpen\}/g)
        .map((x) => ({ file: topNavFile, line: x.line })),
    },
    menuPopover: {
      conditionals: topNavParsed.popoverConditional,
      popoverLayerNode: topNavParsed.popoverLayer,
      scrimNode: topNavParsed.scrim,
      inlineStacking: {
        scrimZIndex: topNavParsed.inlineScrimZ,
        layerZIndex: topNavParsed.inlineLayerZ,
      },
      usesPortal: portalMentions.some((x) => x.file === topNavFile || x.file === topMenuFile),
      portalMentions,
    },
    state: {
      openStates: topNavParsed.stateDecl,
      refs: topNavParsed.refs,
      computeLayout: topNavParsed.computeLayout,
      closeHandlers: {
        esc: findAll(topNavText, /event\.key === "Escape"/g).map((x) => ({ file: topNavFile, line: x.line })),
        outsideClick: findAll(topNavText, /contains\(target\).*setMenuOpen\(false\)/g)
          .map((x) => ({ file: topNavFile, line: x.line })),
      },
    },
    routing: {
      mode: reactRouterMentions.length ? "mixed-or-router" : "tab-history",
      reactRouterMentions,
      tabsRegistry: navParsed.tabs,
      tabToPath: navParsed.pathFromTab,
      pathToTab: navParsed.tabFromPath,
      settingsRedirect: navParsed.settingsRedirect,
      pageFiles,
      missingPageFiles: Object.entries(pageFiles)
        .filter(([, exists]) => !exists)
        .map(([file]) => file),
    },
    menuItems: {
      sourceFile: topMenuFile,
      items: topMenuParsed.items,
      onNavigateDispatch: topMenuParsed.onNavigateCall,
      targetsMissingInTabs: missingTargetsInTabs,
      targetsWithoutKnownPageFile: menuTargets
        .filter((id) => ["account", "preferences", "subscription", "data", "privacy", "terms", "support"].includes(id))
        .filter((id) => {
          const file = `src/pages/${id.charAt(0).toUpperCase()}${id.slice(1)}.jsx`;
          if (id === "data") return !pageFiles["src/pages/Data.jsx"];
          if (id === "privacy") return !pageFiles["src/pages/Privacy.jsx"];
          if (id === "terms") return !pageFiles["src/pages/Terms.jsx"];
          if (id === "support") return !pageFiles["src/pages/Support.jsx"];
          if (id === "account") return !pageFiles["src/pages/Account.jsx"];
          if (id === "preferences") return !pageFiles["src/pages/Preferences.jsx"];
          if (id === "subscription") return !pageFiles["src/pages/Subscription.jsx"];
          return !pageFiles[file];
        }),
    },
    css: {
      sourceFile: navCssFile,
      selectors: navCssParsed,
      relatedSelectorsMentions: findAll(navCssText, /topMenuScrim|topMenuPopoverLayer|topMenuGatePopover|z-index|opacity|visibility|display|transform|overflow/g)
        .map((x) => ({ file: navCssFile, line: x.line, token: x.match[0] })),
      parentContextChecks: {
        topNavShell: navCssParsed[".TopNavShell"],
        topNavGateWrap: navCssParsed[".topNavGateWrap"],
      },
    },
    suspects,
  };

  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  console.log(`[hamburger-audit] map written: ${rel(OUT_FILE)}`);
}

main().catch((error) => {
  console.error("[hamburger-audit] scan failed", error);
  process.exitCode = 1;
});
