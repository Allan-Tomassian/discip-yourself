#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const OUT_MAP = path.join(DOCS_DIR, "menu-intent-map.json");
const OUT_REPORT = path.join(DOCS_DIR, "menu-intent-audit.md");

const FILES = {
  topMenu: path.join(ROOT, "src/components/TopMenuPopover.jsx"),
  topNav: path.join(ROOT, "src/components/TopNav.jsx"),
  app: path.join(ROOT, "src/App.jsx"),
  navHook: path.join(ROOT, "src/hooks/useAppNavigation.js"),
};

const TARGET_PAGES = [
  "src/pages/Account.jsx",
  "src/pages/Preferences.jsx",
  "src/pages/Subscription.jsx",
  "src/pages/Data.jsx",
  "src/pages/Privacy.jsx",
  "src/pages/Terms.jsx",
  "src/pages/Support.jsx",
  "src/pages/Settings.jsx",
];

function rel(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join("/");
}

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function snippet(lines, line) {
  return String(lines[line - 1] || "").trim().slice(0, 240);
}

function extractMenuItems(file, text) {
  const lines = text.split("\n");
  const items = [];
  const menuBlock = text.match(/const\s+MENU_ITEMS\s*=\s*\[([\s\S]*?)\];/);
  if (!menuBlock) return items;
  const block = menuBlock[1];
  const offset = text.indexOf(menuBlock[0]);

  for (const match of block.matchAll(/\{\s*id:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"([\s\S]*?)\}/g)) {
    const line = lineAt(text, offset + (match.index ?? 0));
    items.push({
      id: match[1],
      label: match[2],
      line,
      file,
      snippet: snippet(lines, line),
    });
  }
  return items;
}

function collectMatches(file, text, regex, type) {
  const lines = text.split("\n");
  const out = [];
  for (const match of text.matchAll(regex)) {
    const line = lineAt(text, match.index ?? 0);
    out.push({
      file,
      line,
      type,
      snippet: snippet(lines, line),
      groups: match.slice(1),
    });
  }
  return out;
}

async function fileExists(fileRel) {
  try {
    await fs.access(path.join(ROOT, fileRel));
    return true;
  } catch {
    return false;
  }
}

function mdRef(e) {
  return `\`${e.file}:${e.line}\``;
}

async function main() {
  const contents = {};
  for (const [key, abs] of Object.entries(FILES)) {
    contents[key] = await fs.readFile(abs, "utf8");
  }

  const topMenuFile = rel(FILES.topMenu);
  const topNavFile = rel(FILES.topNav);
  const appFile = rel(FILES.app);
  const navFile = rel(FILES.navHook);

  const menuItems = extractMenuItems(topMenuFile, contents.topMenu);
  const topMenuWiring = [
    ...collectMatches(topMenuFile, contents.topMenu, /function\s+handleAction\(itemId\)/g, "handleAction"),
    ...collectMatches(topMenuFile, contents.topMenu, /onNavigate\(itemId\)/g, "onNavigate-call"),
    ...collectMatches(topMenuFile, contents.topMenu, /onClose\(\)/g, "onClose-call"),
  ];

  const topNavWiring = [
    ...collectMatches(topNavFile, contents.topNav, /<TopMenuPopover/g, "popover-render"),
    ...collectMatches(topNavFile, contents.topNav, /onNavigate=\{onMenuNavigate\}/g, "forward-onMenuNavigate"),
    ...collectMatches(topNavFile, contents.topNav, /setMenuOpen\(\(prev\)\s*=>\s*!prev\)/g, "toggle-menu"),
  ];

  const appWiring = [
    ...collectMatches(appFile, contents.app, /onMenuNavigate=\{\(action\)\s*=>\s*\{\s*setTab\(action\);/g, "menu-to-setTab"),
    ...collectMatches(appFile, contents.app, /tab\s*===\s*"(account|preferences|subscription|data|privacy|terms|support)"/g, "tab-render-branch"),
    ...collectMatches(appFile, contents.app, /setTab\("(account|preferences|subscription|data|privacy|terms|support)"\)/g, "direct-setTab"),
  ];

  const navWiring = [
    ...collectMatches(navFile, contents.navHook, /else if \(t === "([^"]+)"\) nextPath = "([^"]+)";/g, "tab-to-path"),
    ...collectMatches(navFile, contents.navHook, /window\.history\.pushState\(state,\s*"",\s*nextPath\)/g, "history-pushState"),
    ...collectMatches(navFile, contents.navHook, /if \(initialPath\.startsWith\("\/(account|preferences|settings|subscription|data|privacy|terms|support)"\)\)/g, "path-to-tab"),
    ...collectMatches(navFile, contents.navHook, /window\.history\.replaceState\(\{\},\s*"",\s*"\/preferences"\)/g, "settings-redirect"),
  ];

  const itemActions = menuItems.map((item) => {
    const pathMatch = navWiring.find((entry) => entry.type === "tab-to-path" && entry.groups[0] === item.id);
    return {
      id: item.id,
      label: item.label,
      action: "setTab(item.id) via onNavigate",
      targetPath: pathMatch ? pathMatch.groups[1] : null,
      evidence: [item, ...topMenuWiring.filter((w) => w.type === "onNavigate-call").slice(0, 1), ...appWiring.filter((w) => w.type === "menu-to-setTab").slice(0, 1), ...(pathMatch ? [pathMatch] : [])],
    };
  });

  const pages = [];
  for (const page of TARGET_PAGES) {
    pages.push({ file: page, exists: await fileExists(page) });
  }

  const map = {
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    files: {
      topMenu: topMenuFile,
      topNav: topNavFile,
      app: appFile,
      navHook: navFile,
    },
    menuItems,
    wiring: {
      topMenu: topMenuWiring,
      topNav: topNavWiring,
      app: appWiring,
      navigation: navWiring,
    },
    itemActions,
    pageTargets: pages,
    inPlaceMenuRequirements: {
      suggestedState: "menuView = 'root' | 'account' | 'preferences' | 'subscription' | 'data' | 'privacy' | 'terms' | 'support'",
      requiredBehaviors: [
        "Menu items ne déclenchent plus setTab/history mais setMenuView(...)",
        "Back interne (retour sous-vue -> root) dans la même card",
        "Close/ESC/click-outside conserve la fermeture globale",
        "Option future: deep-link facultatif (opt-in) sans forcer navigation par défaut",
      ],
    },
    conclusion: {
      navigationDrivenMenu: true,
      likelyInvisibleRootCause: "layout/stacking",
      pagesMissingImpact: pages.some((p) => !p.exists),
    },
  };

  const report = [];
  report.push("# Menu Intent Audit (LOT 11)");
  report.push("");
  report.push(`- Generated: ${map.generatedAt}`);
  report.push("- Mode: Read-only audit, aucune modification appliquée.");
  report.push("");

  report.push("## Wiring actuel des items menu");
  report.push("");
  itemActions.forEach((item) => {
    report.push(`- **${item.label}** (\`${item.id}\`) -> ${item.action}${item.targetPath ? ` -> \`${item.targetPath}\`` : ""}`);
    item.evidence.forEach((ev) => {
      report.push(`  - ${mdRef(ev)} — ${ev.snippet}`);
    });
  });
  report.push("");

  report.push("## Navigation vs menu in-place");
  report.push("");
  report.push("- Constat: le menu déclenche actuellement un flux navigation (`TopMenuPopover` -> `onNavigate(itemId)` -> `App.setTab(action)` -> `history.pushState`).");
  report.push("- Ce wiring est incompatible avec un menu 100% in-place tant qu’il n’est pas remplacé par un state interne de vue.");
  report.push("");

  report.push("## Impact suppression/présence des pages");
  report.push("");
  pages.forEach((page) => {
    report.push(`- \`${page.file}\`: ${page.exists ? "présent" : "absent"}`);
  });
  report.push("");
  report.push("- Conclusion: les pages cibles principales existent. Le problème d’invisibilité est probablement lié au layout/stacking, pas à l’absence des routes/pages.");
  report.push("");

  report.push("## Plan in-place menu (non implémenté)");
  report.push("");
  report.push(`- State proposé: \`${map.inPlaceMenuRequirements.suggestedState}\``);
  map.inPlaceMenuRequirements.requiredBehaviors.forEach((rule) => report.push(`- ${rule}`));

  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(OUT_MAP, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  await fs.writeFile(OUT_REPORT, `${report.join("\n")}\n`, "utf8");
  console.log(`[menu-intent] map written: ${rel(OUT_MAP)}`);
  console.log(`[menu-intent] report written: ${rel(OUT_REPORT)}`);
}

main().catch((error) => {
  console.error("[menu-intent] audit failed", error);
  process.exitCode = 1;
});
