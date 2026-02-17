#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MAP_FILE = path.join(ROOT, "docs", "ui-style-map.json");
const AUDIT_MD = path.join(ROOT, "docs", "ui-audit.md");
const MIGRATION_MD = path.join(ROOT, "docs", "ui-migration-plan.md");

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function uniq(values) {
  return Array.from(new Set(values));
}

function uniqSorted(values) {
  return uniq(values).sort((a, b) => a.localeCompare(b));
}

function escMd(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function table(headers, rows) {
  const head = `| ${headers.map(escMd).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((cell) => escMd(cell)).join(" | ")} |`).join("\n");
  return [head, sep, body].filter(Boolean).join("\n");
}

function hasNonGate(file) {
  return file.uiSystemsUsed.some((system) => system !== "gate");
}

function hotspotScore(file) {
  let score = 0;
  if (file.uiSystemsUsed.includes("legacy")) score += 6;
  if (file.uiSystemsUsed.includes("liquid")) score += 5;
  if (file.uiSystemsUsed.includes("glass")) score += 4;
  if (file.uiSystemsUsed.includes("gate")) score += 1;
  if (file.uiSystemsUsed.length > 1) score += 3;
  if (file.kind === "page") score += 2;
  if (file.kind === "component") score += 1;

  const legacyComponents = file.jsxComponents.filter((name) =>
    ["Card", "Button", "Input", "Textarea", "Modal", "SelectMenu", "IconButton", "Badge"].includes(name)
  );
  score += legacyComponents.length;

  return score;
}

function collectReachablePages(styleMap) {
  const byComponent = new Map(
    (styleMap.routing?.pageImportsFromApp || []).map((item) => [item.component, item.module])
  );

  const rows = [];
  for (const item of styleMap.userCanReach?.pagesFromTabs || []) {
    rows.push({
      tab: item.tab,
      component: item.component,
      module: item.module || byComponent.get(item.component) || "",
    });
  }

  for (const item of styleMap.routing?.pageImportsFromApp || []) {
    if (!rows.find((row) => row.component === item.component)) {
      rows.push({ tab: "(import-only)", component: item.component, module: item.module });
    }
  }

  return rows.sort((a, b) => `${a.tab}:${a.component}`.localeCompare(`${b.tab}:${b.component}`));
}

function formatList(values) {
  if (!values || values.length === 0) return "-";
  return values.join(", ");
}

function inferTokenGaps(files) {
  const nonGatePageFiles = files.filter((file) => file.kind === "page" && hasNonGate(file));
  const hasLegacyInputs = nonGatePageFiles.some((file) =>
    file.jsxComponents.some((name) => ["Input", "Textarea", "SelectMenu"].includes(name))
  );
  const hasLegacyButtons = nonGatePageFiles.some((file) => file.jsxComponents.includes("Button"));
  const hasModalMix = files.some((file) =>
    /Modal|Popover|Overlay|Drawer/.test(file.path) && file.uiSystemsUsed.some((s) => s !== "gate")
  );

  return {
    buttons: hasLegacyButtons,
    inputs: hasLegacyInputs,
    modalTokens: hasModalMix,
    rowsAndLists: true,
    tabs: true,
    toasts: true,
    emptyStates: true,
    calendarExceptions: true,
  };
}

function buildAuditMarkdown(styleMap) {
  const files = styleMap.inventory.files || [];
  const pages = styleMap.inventory.pages || [];
  const features = styleMap.inventory.features || [];

  const uiFiles = files.filter((file) => file.uiSystemsUsed.length > 0);
  const gateFiles = uiFiles.filter((file) => file.uiSystemsUsed.includes("gate"));
  const nonGateFiles = uiFiles.filter((file) => hasNonGate(file));
  const gateOnlyFiles = uiFiles.filter(
    (file) => file.uiSystemsUsed.length === 1 && file.uiSystemsUsed.includes("gate")
  );
  const mixedFiles = uiFiles.filter((file) => file.uiSystemsUsed.length > 1);

  const gatePresencePercent = uiFiles.length ? ((gateFiles.length / uiFiles.length) * 100).toFixed(2) : "0.00";
  const nonGatePresencePercent = uiFiles.length
    ? ((nonGateFiles.length / uiFiles.length) * 100).toFixed(2)
    : "0.00";
  const gateOnlyPercent = uiFiles.length
    ? ((gateOnlyFiles.length / uiFiles.length) * 100).toFixed(2)
    : "0.00";

  const hotspots = [...uiFiles]
    .map((file) => ({ ...file, score: hotspotScore(file) }))
    .filter((file) => file.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const legacyClassUsage = Object.entries(styleMap.inventory.classUsageIndex || {})
    .filter(([className, usageFiles]) => {
      if (!/^(glass|liquid|navMenu|panel|drawer|modal)/i.test(className)) return false;
      return usageFiles.some((file) => !file.endsWith(".css"));
    })
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  const reachablePages = collectReachablePages(styleMap);
  const routes = styleMap.routing?.routes || [];

  const pageRows = pages
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((page) => [
      page.path,
      page.uiSystemsUsed.join(", ") || "-",
      page.jsxComponents.length,
      page.cssImports.join(", ") || "-",
      page.jsxComponents.filter((name) => ["Card", "Button", "Input", "Textarea", "SelectMenu", "Modal"].includes(name)).join(", ") || "-",
    ]);

  const featureRows = features
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((feature) => [
      feature.path,
      feature.uiSystemsUsed.join(", ") || "-",
      feature.jsxComponents.length,
      feature.cssImports.join(", ") || "-",
    ]);

  const hotspotRows = hotspots.slice(0, 20).map((file) => [
    file.score,
    file.path,
    file.kind,
    file.uiSystemsUsed.join(", "),
    file.jsxComponents
      .filter((name) => ["Card", "Button", "Input", "Textarea", "SelectMenu", "Modal", "LiquidGlassSurface"].includes(name))
      .join(", ") || "-",
  ]);

  const modalRows = [
    ["Modals", formatList(styleMap.userCanReach?.modalComponents || [])],
    ["Popovers", formatList(styleMap.userCanReach?.popoverComponents || [])],
    ["Drawers", formatList(styleMap.userCanReach?.drawerComponents || [])],
    ["Overlays", formatList(styleMap.userCanReach?.overlayComponents || [])],
    ["Transient Views", formatList(styleMap.userCanReach?.transientViews || [])],
  ];

  const sections = [];
  sections.push("# UI/DA Audit (Gate Only Target)");
  sections.push(`Generated: ${styleMap.generatedAt}`);
  sections.push("");
  sections.push("## Reference Gate");
  sections.push(
    `Source of truth: ${styleMap.sourceOfTruth.gatePrimitives.map((x) => `\`${x}\``).join(", ")}`
  );
  sections.push(
    `Visual references: ${styleMap.sourceOfTruth.visualReferences.map((x) => `\`${x}\``).join(", ")}`
  );
  sections.push("");
  sections.push("## Global Coherence");
  sections.push(`- UI files scanned: ${uiFiles.length}`);
  sections.push(`- Gate present: ${gateFiles.length} (${gatePresencePercent}%)`);
  sections.push(`- Non-Gate present: ${nonGateFiles.length} (${nonGatePresencePercent}%)`);
  sections.push(`- Gate-only files: ${gateOnlyFiles.length} (${gateOnlyPercent}%)`);
  sections.push(`- Mixed-system files: ${mixedFiles.length}`);
  sections.push("");
  sections.push("## Routes And Reachable Views");
  sections.push(table(["Route", "Tab"], routes.map((route) => [route, styleMap.routing.pathToTab?.[route] || "-"])));
  sections.push("");
  sections.push(table(["Tab", "Component", "Module"], reachablePages.map((row) => [row.tab, row.component, row.module || "-"])));
  sections.push("");
  sections.push("## Modals Popovers Overlays");
  sections.push(table(["Type", "Components"], modalRows));
  sections.push("");
  sections.push("## Pages Inventory");
  sections.push(table(["Page", "Systems", "JSX Components", "CSS Imports", "Legacy Primitives"], pageRows));
  sections.push("");
  sections.push("## Features Inventory");
  sections.push(table(["Feature File", "Systems", "JSX Components", "CSS Imports"], featureRows));
  sections.push("");
  sections.push("## Mixed Hotspots");
  sections.push(table(["Score", "File", "Kind", "Systems", "Legacy/Liquid Usage"], hotspotRows));
  sections.push("");
  sections.push("## Legacy Class Usage");
  sections.push(
    table(
      ["Class", "Usage Count", "Sample Usage Files"],
      legacyClassUsage.slice(0, 30).map(([className, usageFiles]) => [
        className,
        usageFiles.length,
        usageFiles.slice(0, 4).join(", "),
      ])
    )
  );

  return sections.join("\n");
}

function buildMigrationPlanMarkdown(styleMap) {
  const files = styleMap.inventory.files || [];
  const hotspots = [...files]
    .map((file) => ({ path: file.path, score: hotspotScore(file), systems: file.uiSystemsUsed, kind: file.kind }))
    .filter((file) => file.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const topLegacyPages = hotspots
    .filter((file) => file.kind === "page" && file.systems.some((s) => s !== "gate"))
    .slice(0, 12)
    .map((file) => file.path);

  const tokenGaps = inferTokenGaps(files);

  const migrationLots = [
    {
      lot: "Lot 0 - Guardrails",
      goal: "Stop regressions before further migration.",
      files: [
        "scripts/check-no-legacy-ui.mjs",
        "package.json",
        "docs/ui-audit.md",
        "docs/ui-style-map.json",
      ],
      acceptance: [
        "CI/local check fails on new Liquid/legacy imports in forbidden zones.",
        "Audit artifacts regenerated and tracked per iteration.",
      ],
      risks: [
        "False positives on allowed transitional files.",
        "Mitigation: maintain explicit allowlist with expiration notes.",
      ],
      tests: ["npm run ui:check", "npm run ui:audit"],
    },
    {
      lot: "Lot 1 - Navigation + Hamburger",
      goal: "Keep top navigation and menu on a single Gate visual language.",
      files: [
        "src/components/TopNav.jsx",
        "src/components/TopMenuPopover.jsx",
        "src/features/navigation/topMenuGate.css",
      ],
      acceptance: [
        "No LiquidGlassSurface in TopNav/TopMenuPopover.",
        "Single dense popover surface with readable rows.",
        "Outside click, ESC, and touch close still work.",
      ],
      risks: [
        "Layering/z-index conflicts with other overlays.",
        "Mitigation: QA with modal + menu open sequence on desktop/mobile.",
      ],
      tests: ["npm test", "npm run build", "npm run test:e2e"],
    },
    {
      lot: "Lot 2 - Account + Preferences",
      goal: "Finish Gate-only conversion for account and settings surfaces.",
      files: [
        "src/pages/Account.jsx",
        "src/pages/Preferences.jsx",
        "src/features/account/accountGate.css",
        "src/features/preferences/preferencesGate.css",
      ],
      acceptance: [
        "No imports from components/UI in Account/Preferences.",
        "No double-surface card stacking.",
        "Username availability, save/reload, theme apply/reset unchanged.",
      ],
      risks: [
        "Logic regressions during markup swap.",
        "Mitigation: preserve handlers and add smoke e2e for save flows.",
      ],
      tests: ["npm test", "npm run build", "manual QA account/preferences"],
    },
    {
      lot: "Lot 3 - Menu Pages Dedicated",
      goal: "Align Subscription, Data, Privacy, Terms, Support to pure Gate primitives.",
      files: [
        "src/pages/Subscription.jsx",
        "src/pages/Data.jsx",
        "src/pages/Privacy.jsx",
        "src/pages/Terms.jsx",
        "src/pages/Support.jsx",
      ],
      acceptance: [
        "No LiquidGlassSurface in dedicated menu pages.",
        "Typography/spacing match Gate references.",
      ],
      risks: [
        "Visual drift due to duplicated custom classes.",
        "Mitigation: consolidate class hooks into gate.css-driven variants.",
      ],
      tests: ["npm test", "npm run build", "manual responsive checks"],
    },
    {
      lot: "Lot 4 - Core Product Pages",
      goal: "Migrate Today/Library/Pilotage/Category flows to Gate surfaces.",
      files: topLegacyPages,
      acceptance: [
        "Legacy Card/Button/Input removed from top hotspots.",
        "Create/edit/session/category screens stay behavior-compatible.",
      ],
      risks: [
        "High blast radius across daily workflows.",
        "Mitigation: migrate per page cluster with before/after snapshots.",
      ],
      tests: ["npm test", "npm run test:e2e", "manual scenario walkthrough"],
    },
    {
      lot: "Lot 5 - Modals/Toasts/Overlays",
      goal: "Unify all overlays and transient feedback into Gate tokens.",
      files: [
        "src/components/*Modal*.jsx",
        "src/tour/TourOverlay.jsx",
        "src/components/DiagnosticOverlay.jsx",
        "src/index.css (overlay/toast legacy blocks)",
      ],
      acceptance: [
        "Gate scrim + panel tokens used everywhere.",
        "No modal-specific legacy gradient leftovers.",
      ],
      risks: [
        "Focus-trap and accessibility regressions.",
        "Mitigation: keyboard traversal checks + e2e overlay tests.",
      ],
      tests: ["npm test", "npm run build", "manual keyboard QA"],
    },
    {
      lot: "Lot 6 - Legacy Removal",
      goal: "Delete old UI systems and dead classes once migration is complete.",
      files: [
        "src/components/UI.jsx",
        "src/ui/LiquidGlassSurface.jsx",
        "legacy glass classes in src/index.css",
      ],
      acceptance: [
        "No imports remain from removed legacy modules.",
        "ui:check passes without allowlist exceptions.",
      ],
      risks: [
        "Hidden dependencies in tests or niche flows.",
        "Mitigation: full-text import grep before deletion + full CI run.",
      ],
      tests: ["npm run ui:check", "npm test", "npm run build", "npm run test:e2e"],
    },
  ];

  const lines = [];
  lines.push("# UI Migration Plan (Gate Only)");
  lines.push(`Generated: ${styleMap.generatedAt}`);
  lines.push("");
  lines.push("## Objective");
  lines.push("Move all visible/clickable surfaces to a single Gate design system and remove legacy/liquid/glass drift.");
  lines.push("");
  lines.push("## Missing Gate Tokens To Add/Normalize");
  lines.push(`- Buttons states (primary/secondary/ghost/danger + press/focus/disabled): ${tokenGaps.buttons ? "missing/inconsistent" : "already covered"}`);
  lines.push(`- Inputs/textarea/select/file/number + validation: ${tokenGaps.inputs ? "missing/inconsistent" : "already covered"}`);
  lines.push(`- Dense cards/panels gradients/borders/shadows/highlight: missing/inconsistent`);
  lines.push(`- Rows/list items (flat row + meta + chevron + hover/press): ${tokenGaps.rowsAndLists ? "missing/inconsistent" : "already covered"}`);
  lines.push(`- Tabs/segmented controls: ${tokenGaps.tabs ? "missing/inconsistent" : "already covered"}`);
  lines.push(`- Modals/popovers/scrims tokens: ${tokenGaps.modalTokens ? "missing/inconsistent" : "already covered"}`);
  lines.push(`- Toasts/alerts/empty states: ${tokenGaps.toasts ? "missing/inconsistent" : "already covered"}`);
  lines.push(`- Calendar/toggle exceptions for press fx: ${tokenGaps.calendarExceptions ? "needs explicit policy" : "already covered"}`);
  lines.push("");

  for (const lot of migrationLots) {
    lines.push(`## ${lot.lot}`);
    lines.push(`Goal: ${lot.goal}`);
    lines.push("Files:");
    for (const file of lot.files) lines.push(`- ${file}`);
    lines.push("Acceptance criteria:");
    for (const item of lot.acceptance) lines.push(`- ${item}`);
    lines.push("Risks and mitigation:");
    for (const item of lot.risks) lines.push(`- ${item}`);
    lines.push("Tests:");
    for (const item of lot.tests) lines.push(`- ${item}`);
    lines.push("");
  }

  lines.push("## QA Checklist (Mac + iPhone)");
  lines.push("- Open/close hamburger with mouse, trackpad tap, and touch.");
  lines.push("- Validate ESC close and outside click/tap close on each overlay.");
  lines.push("- Check route transitions for /account, /preferences, /subscription, /data, /privacy, /terms, /support.");
  lines.push("- Verify profile save, username availability, theme apply/reset, why-save flows.");
  lines.push("- Verify readability (contrast) in dark backgrounds and small screens.");

  return lines.join("\n");
}

async function main() {
  let raw;
  try {
    raw = await fs.readFile(MAP_FILE, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      console.error("[ui-audit-report] missing docs/ui-style-map.json. Run: npm run ui:audit");
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  const styleMap = JSON.parse(raw);

  const auditMd = buildAuditMarkdown(styleMap);
  const migrationMd = buildMigrationPlanMarkdown(styleMap);

  await fs.writeFile(AUDIT_MD, `${auditMd}\n`, "utf8");
  await fs.writeFile(MIGRATION_MD, `${migrationMd}\n`, "utf8");

  const files = styleMap.inventory.files || [];
  const uiFiles = files.filter((file) => file.uiSystemsUsed.length > 0);
  const gateFiles = uiFiles.filter((file) => file.uiSystemsUsed.includes("gate"));
  const nonGateFiles = uiFiles.filter((file) => file.uiSystemsUsed.some((system) => system !== "gate"));
  const hotspots = [...uiFiles]
    .map((file) => ({ path: file.path, score: hotspotScore(file) }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 10);

  const gatePct = uiFiles.length ? ((gateFiles.length / uiFiles.length) * 100).toFixed(2) : "0.00";
  const nonGatePct = uiFiles.length ? ((nonGateFiles.length / uiFiles.length) * 100).toFixed(2) : "0.00";

  console.log(`[ui-audit-report] wrote ${toPosix(path.relative(ROOT, AUDIT_MD))}`);
  console.log(`[ui-audit-report] wrote ${toPosix(path.relative(ROOT, MIGRATION_MD))}`);
  console.log(`[ui-audit-report] gate presence: ${gatePct}%`);
  console.log(`[ui-audit-report] non-gate presence: ${nonGatePct}%`);
  console.log("[ui-audit-report] top hotspots:");
  hotspots.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.path} (score ${item.score})`);
  });
}

main().catch((error) => {
  console.error("[ui-audit-report] failed", error);
  process.exitCode = 1;
});
