#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const MAP_FILE = path.join(DOCS_DIR, "hamburger-map.json");
const AUDIT_FILE = path.join(DOCS_DIR, "hamburger-audit.md");
const PLAN_FILE = path.join(DOCS_DIR, "hamburger-fixes-plan.md");
const CHECKLIST_FILE = path.join(DOCS_DIR, "hamburger-audit-runtime-checklist.md");

function fmtRef(file, line) {
  if (!file) return "`unknown`";
  if (!line) return `\`${file}\``;
  return `\`${file}#L${line}\``;
}

function section(title, lines) {
  return [`## ${title}`, ...lines, ""].join("\n");
}

function scoreSeverity(severity) {
  if (severity === "critical") return 3;
  if (severity === "high") return 2;
  if (severity === "medium") return 1;
  return 0;
}

function detectBranch(map) {
  const mounted = Boolean(
    map.components?.topNav?.importedInApp?.length
      && map.components?.topNav?.renderedInApp?.length
      && map.components?.topMenuPopover?.mountedInTopNav?.length
  );
  const canOpen = Boolean(
    map.hamburgerTrigger?.buttonNode
      && map.hamburgerTrigger?.triggerOnClickNode
      && (map.state?.openStates || []).some((x) => x.state === "menuOpen")
  );

  if (!mounted) return { id: 1, label: "Menu non monté" };
  if (!canOpen) return { id: 2, label: "Menu monté mais jamais ouvert" };
  return { id: 3, label: "Menu ouvert mais potentiellement invisible/hors écran/stacking" };
}

function buildAuditMarkdown(map) {
  const branch = detectBranch(map);
  const suspects = [...(map.suspects || [])].sort((a, b) => {
    const ds = scoreSeverity(b.severity) - scoreSeverity(a.severity);
    if (ds !== 0) return ds;
    return String(a.code).localeCompare(String(b.code));
  });

  const lines = [];
  lines.push("# Hamburger Audit (Read-Only)");
  lines.push(`Generated: ${map.generatedAt}`);
  lines.push("");
  lines.push("## Conclusion Branch");
  lines.push(`- Résultat: **${branch.id}) ${branch.label}**`);
  lines.push("- Statut trigger: " + (map.hamburgerTrigger?.buttonNode ? "présent" : "absent"));
  lines.push("- Statut popover mount: " + (map.menuPopover?.popoverLayerNode ? "présent" : "absent"));
  lines.push("- Statut handler open: " + (map.hamburgerTrigger?.triggerOnClickNode ? "présent" : "absent"));
  lines.push("");

  lines.push("## Preuves (fichiers/ligne)");
  lines.push(`- TopNav importé dans App: ${map.components.topNav.importedInApp.map((x) => fmtRef(x.file, x.line)).join(", ") || "-"}`);
  lines.push(`- TopNav rendu dans App: ${map.components.topNav.renderedInApp.map((x) => fmtRef(x.file, x.line)).join(", ") || "-"}`);
  lines.push(`- TopMenuPopover monté dans TopNav: ${map.components.topMenuPopover.mountedInTopNav.map((x) => fmtRef(x.file, x.line)).join(", ") || "-"}`);
  lines.push(`- Bouton hamburger: ${fmtRef(map.hamburgerTrigger.buttonNode?.file, map.hamburgerTrigger.buttonNode?.line)}`);
  lines.push(`- Toggle onClick: ${fmtRef(map.hamburgerTrigger.triggerOnClickNode?.file, map.hamburgerTrigger.triggerOnClickNode?.line)}`);
  lines.push(`- Condition render open: ${(map.menuPopover.conditionals || []).map((x) => fmtRef(x.file, x.line)).join(", ") || "-"}`);
  lines.push(`- Layer popover: ${fmtRef(map.menuPopover.popoverLayerNode?.file, map.menuPopover.popoverLayerNode?.line)}`);
  lines.push(`- Scrim: ${fmtRef(map.menuPopover.scrimNode?.file, map.menuPopover.scrimNode?.line)}`);
  lines.push(`- z-index inline scrim/layer: ${map.menuPopover.inlineStacking?.scrimZIndex?.zIndex ?? "?"} / ${map.menuPopover.inlineStacking?.layerZIndex?.zIndex ?? "?"}`);
  lines.push(`- z-index CSS scrim/layer: ${map.css.selectors?.[".topMenuScrim"]?.props?.["z-index"] ?? "?"} / ${map.css.selectors?.[".topMenuPopoverLayer"]?.props?.["z-index"] ?? "?"}`);
  lines.push("");

  lines.push("## Routing / Pages / Items Impact");
  lines.push(`- Mode navigation détecté: ${map.routing.mode}`);
  lines.push(`- React Router détecté: ${(map.routing.reactRouterMentions || []).length ? "oui (mentions trouvées)" : "non (tab/history interne)"}`);
  lines.push(`- Items menu: ${(map.menuItems.items || []).map((x) => `\`${x.id}\``).join(", ")}`);
  lines.push(`- Items absents du registry tabs: ${(map.menuItems.targetsMissingInTabs || []).length ? map.menuItems.targetsMissingInTabs.join(", ") : "aucun"}`);
  lines.push(`- Pages manquantes sur les cibles menu: ${(map.menuItems.targetsWithoutKnownPageFile || []).length ? map.menuItems.targetsWithoutKnownPageFile.join(", ") : "aucune"}`);
  lines.push(`- Redirect /settings -> /preferences: ${fmtRef(map.routing.settingsRedirect?.file, map.routing.settingsRedirect?.line)}`);
  lines.push("");

  lines.push("## Top 10 Suspects");
  if (!suspects.length) {
    lines.push("- Aucun suspect critique détecté statiquement.");
  } else {
    suspects.slice(0, 10).forEach((s, idx) => {
      lines.push(`${idx + 1}. [${s.severity}] \`${s.code}\` — ${s.reason}`);
      lines.push(`   preuves: ${Array.isArray(s.evidence) ? s.evidence.map((r) => `\`${r}\``).join(", ") : "-"}`);
    });
  }
  lines.push("");

  lines.push("## Analyse Ciblée (question 1→6)");
  lines.push(`1. Composants montés/importés: ${map.components.topNav.importedInApp.length && map.components.topMenuPopover.mountedInTopNav.length ? "oui" : "non"}`);
  lines.push(`2. Hamburger déclenche ouverture: ${map.hamburgerTrigger.triggerOnClickNode ? "oui" : "non"}`);
  lines.push(`3. Popover rendu quand open=true: ${(map.menuPopover.conditionals || []).length && map.menuPopover.popoverLayerNode ? "oui" : "non"}`);
  lines.push(`4. Invisible/hors écran/CSS: risque principal actuel = ${branch.id === 3 ? "stacking + position fixed + clipping parent éventuel" : "non prioritaire"}`);
  lines.push(`5. Items cassés par suppression pages: ${(map.menuItems.targetsWithoutKnownPageFile || []).length ? "oui (voir ci-dessus)" : "non"}`);
  lines.push(`6. Navigation interne vs pages: mode actuel = setTab/history (pas un menu purement interne sans navigation).`);
  lines.push("");

  lines.push("## Recommandation immédiate (non appliquée)");
  lines.push("- Si bug reproduit: vérifier d’abord stacking context du parent topbar (z-index dynamique + absence de transform/filter parent). ");
  lines.push("- En second: vérifier top/left clamp runtime et max-height interne du popover.");
  lines.push("- En parallèle: décider si le menu doit rester navigation tab/history ou devenir un mode interne sans navigation.");

  return `${lines.join("\n")}\n`;
}

function buildFixPlanMarkdown(map) {
  const lines = [];
  lines.push("# Hamburger Fixes Plan (Non Exécuté)");
  lines.push("");
  lines.push("## A) Repositionnement sous topbar + clamp + safe-area");
  lines.push("1. Mesurer la topbar au clic (getBoundingClientRect). ");
  lines.push("2. Positionner le layer en fixed sous la topbar avec gap 8-12px.");
  lines.push("3. Clamp horizontal + maxHeight = viewport - top - safeBottom.");
  lines.push("4. Garder overflow auto interne du popover.");
  lines.push("");

  lines.push("## B) Menu Single Surface");
  lines.push("1. Conserver une seule surface GatePanel racine.");
  lines.push("2. Sections internes flat (pas de backplate globale).");
  lines.push("3. Rows cliquables premium sans card imbriquée inutile.");
  lines.push("");

  lines.push("## C) Mode Menu Interne (sans navigation pages)");
  lines.push("1. Introduire un state local `menuView` (profil/réglages/données etc.).");
  lines.push("2. Garder callbacks actions sensibles (logout) inchangés.");
  lines.push("3. Option: conserver deep-link comme fallback derrière feature flag.");
  lines.push("");

  lines.push("## D) Compat iPhone");
  lines.push("1. Safe-area top/bottom sur placement et maxHeight.");
  lines.push("2. Pattern Outer/Clip/Backdrop sur la surface du popover.");
  lines.push("3. Vérifier qu’aucun parent transform/filter ne casse le stacking fixed.");
  lines.push("");

  lines.push("## E) Suppression pages / routing safety");
  lines.push("1. Contrat: chaque item menu doit mapper vers tab valide OU vue interne.");
  lines.push("2. Tests statiques: item->tab, tab->path, path->page existante.");
  lines.push("3. Garder redirect `/settings` -> `/preferences` tant que legacy links existent.");
  lines.push("");

  lines.push("## Priorité d’exécution");
  lines.push("1. Stacking/z-index + visibilité popover.");
  lines.push("2. Repositionnement stable sous topbar.");
  lines.push("3. Décision produit: navigation tab/history vs menu interne.");
  lines.push("4. Durcissement tests e2e ciblés menu.");
  lines.push("");

  lines.push("## Points d’appui (preuves scan)");
  lines.push(`- Trigger hamburger: ${fmtRef(map.hamburgerTrigger.buttonNode?.file, map.hamburgerTrigger.buttonNode?.line)}`);
  lines.push(`- Mount popover: ${fmtRef(map.menuPopover.popoverLayerNode?.file, map.menuPopover.popoverLayerNode?.line)}`);
  lines.push(`- Items menu source: ${fmtRef(map.menuItems.items?.[0]?.file, map.menuItems.items?.[0]?.line)}`);
  lines.push(`- Registry tabs: ${fmtRef(map.routing.pathFromTab?.[0]?.file, map.routing.pathFromTab?.[0]?.line)}`);

  return `${lines.join("\n")}\n`;
}

function buildRuntimeChecklist() {
  return `# Hamburger Runtime Checklist (DevTools)\n\n## Au clic hamburger\n- Vérifier que l’état \`menuOpen\` passe à \`true\` (React DevTools).\n- Vérifier la présence DOM de \`.topMenuPopoverLayer\` et \`.topMenuGatePopover\`.\n- Vérifier la présence DOM de \`.topMenuScrim\`.\n\n## Computed Styles à contrôler\n- \`.topMenuPopoverLayer\`: \`display\`, \`opacity\`, \`visibility\`, \`pointer-events\`, \`position\`, \`top\`, \`left\`, \`z-index\`.\n- \`.topMenuScrim\`: \`z-index\` inférieur au popover.\n- Parent topbar: absence de \`transform\`/\`filter\` qui crée un stacking context bloquant.\n\n## Interaction\n- Clic sur item menu: pas d’interception pointer par scrim.\n- Clic outside: fermeture.\n- Touche ESC: fermeture.\n\n## Routing / Navigation\n- Clic \"Réglages\" -> tab \`preferences\` (ou vue interne cible si refactor).\n- Vérifier qu’aucune erreur console \`no route match\` / \`undefined tab\`.\n\n## Captures utiles si bug\n- Capture DOM de \`.topMenuPopoverLayer\` + styles computed.\n- Capture DOM de \`.topMenuScrim\` + z-index.\n- Screenshot overlay montrant topbar/menu/scrim.\n`;
}

async function main() {
  const raw = await fs.readFile(MAP_FILE, "utf8");
  const map = JSON.parse(raw);

  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(AUDIT_FILE, buildAuditMarkdown(map), "utf8");
  await fs.writeFile(PLAN_FILE, buildFixPlanMarkdown(map), "utf8");
  await fs.writeFile(CHECKLIST_FILE, buildRuntimeChecklist(), "utf8");

  console.log(`[hamburger-audit] report written: ${path.relative(ROOT, AUDIT_FILE)}`);
  console.log(`[hamburger-audit] fixes plan written: ${path.relative(ROOT, PLAN_FILE)}`);
  console.log(`[hamburger-audit] runtime checklist written: ${path.relative(ROOT, CHECKLIST_FILE)}`);
}

main().catch((error) => {
  console.error("[hamburger-audit] report failed", error);
  process.exitCode = 1;
});
