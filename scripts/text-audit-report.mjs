#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const MAP_FILE = path.join(DOCS_DIR, "text-map.json");
const AUDIT_FILE = path.join(DOCS_DIR, "text-audit.md");
const NARRATION_FILE = path.join(DOCS_DIR, "narration-plan.md");

function rel(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join("/");
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function byCountDesc(items) {
  return [...items].sort((a, b) => b.count - a.count || String(a.label || a.key || "").localeCompare(String(b.label || b.key || "")));
}

function findVariantsByStem(variants, stems) {
  const matches = [];
  for (const stem of stems) {
    const group = variants.filter((item) => item.normalized.includes(stem));
    if (!group.length) continue;
    matches.push({ stem, groups: group.slice(0, 20) });
  }
  return matches;
}

function detectPronounTone(entries) {
  let tuCount = 0;
  let vousCount = 0;

  for (const entry of entries) {
    const text = normalize(entry.text);
    if (!text) continue;
    if (/\btu\b|\bton\b|\btes\b|\btoi\b/.test(text)) tuCount += 1;
    if (/\bvous\b|\bvotre\b|\bvos\b/.test(text)) vousCount += 1;
  }

  return { tuCount, vousCount };
}

function detectActionLabelConflicts(variants) {
  const rules = [
    { key: "save", labels: ["enregistrer", "sauvegarder"] },
    { key: "cancel-close", labels: ["annuler", "fermer"] },
    { key: "continue-validate", labels: ["continuer", "valider"] },
    { key: "login", labels: ["connexion", "se connecter", "connecte"] },
    { key: "logout", labels: ["deconnexion", "se deconnecter"] },
    { key: "support-help", labels: ["support", "aide"] },
  ];

  const index = new Map();
  for (const item of variants) {
    index.set(item.normalized, item);
  }

  const conflicts = [];
  for (const rule of rules) {
    const present = [];
    for (const label of rule.labels) {
      const hits = variants.filter((item) => item.normalized.includes(label));
      if (hits.length) present.push({ label, hits: hits.slice(0, 10) });
    }
    if (present.length > 1) conflicts.push({ key: rule.key, present });
  }

  return conflicts;
}

function buildNarrationPlan() {
  const lines = [];
  lines.push("# Narration & Microcopy Plan (LOT 10)");
  lines.push("");
  lines.push("## Style guide (proposé)");
  lines.push("");
  lines.push("- Voix: directe, courte, orientée action.");
  lines.push("- Personne grammaticale: choisir une seule forme (`tu` ou `vous`) et l’appliquer partout.");
  lines.push("- Verbes d’action cohérents: `Enregistrer`, `Annuler`, `Continuer`, `Supprimer`, `Réessayer`.");
  lines.push("- Messages d’erreur: cause + impact + prochaine action.");
  lines.push("- Messages succès: courts, explicites, sans ambiguïté.");
  lines.push("");

  lines.push("## Règles microcopy");
  lines.push("");
  lines.push("- Boutons primaires: verbe + objet (`Enregistrer le profil`).");
  lines.push("- Boutons secondaires: action courte (`Annuler`, `Retour`).");
  lines.push("- Placeholders: exemple utile, pas une répétition du label.");
  lines.push("- Empty states: contexte + bénéfice + CTA immédiat.");
  lines.push("- Erreurs réseau/API: code (si dispo) + message humain + action (`Réessayer`).");
  lines.push("");

  lines.push("## Narration produit");
  lines.push("");
  lines.push("- Onboarding: 3 étapes max, texte séquencé (objectif, action, feedback).");
  lines.push("- Progression: wording constant entre `Aujourd’hui`, `Bibliothèque`, `Pilotage`.");
  lines.push("- Premium/paywall: bénéfice concret avant le prix, CTA unique.");
  lines.push("- Support/légal: ton neutre, clair, sans jargon.");
  lines.push("");

  lines.push("## Accessibilité textuelle");
  lines.push("");
  lines.push("- Vérifier présence des `aria-label` sur icônes sans texte.");
  lines.push("- Longueur mobile: éviter les chaînes > 70 caractères dans les boutons.");
  lines.push("- Contraste sémantique: états erreur/succès avec texte explicite (pas couleur seule).");
  lines.push("- Focus clavier: labels et aides contextualisées.");
  lines.push("");

  lines.push("## Feedback & motion (recommandations, non implémentées)");
  lines.push("");
  lines.push("- Press feedback: `.GatePressable` uniquement sur CTA/rows autorisés.");
  lines.push("- Haptics (mobile): déclenchement léger sur validation primaire (optionnel, opt-in).");
  lines.push("- Son de clic: désactivé par défaut, activable en préférences.");
  lines.push("- Transitions: 120-180ms, easing homogène, pas d’animations concurrentes.");
  lines.push("- Toasts: durée stable (2.5–4s), action de fermeture claire.");
  lines.push("");

  lines.push("## Plan d’exécution recommandé (non appliqué)");
  lines.push("");
  lines.push("1. Harmoniser terminologie globale (actions + erreurs).\n2. Uniformiser textes onboarding/empty states.\n3. Valider accessibilité (aria + longueurs + contrastes).\n4. Ajouter feedback motion/son en feature flag.");

  return `${lines.join("\n")}\n`;
}

async function main() {
  const raw = await fs.readFile(MAP_FILE, "utf8");
  const map = JSON.parse(raw);
  const entries = Array.isArray(map.entries) ? map.entries : [];
  const variants = Array.isArray(map.variants) ? map.variants : [];
  const stats = map.stats || {};

  const tone = detectPronounTone(entries);
  const conflicts = detectActionLabelConflicts(variants);
  const stems = findVariantsByStem(variants, ["enregistrer", "sauvegarder", "annuler", "fermer", "continuer", "valider", "profil", "compte", "support", "aide"]);

  const contextStats = byCountDesc((stats.byContext || []).map((item) => ({ key: item.context, count: item.count })));
  const hotspots = (stats.hotspots || []).slice(0, 20);
  const nearDuplicates = (stats.nearDuplicates || []).slice(0, 30);

  const lines = [];
  lines.push("# Text Audit (LOT 10)");
  lines.push("");
  lines.push(`- Generated: ${map.generatedAt || new Date().toISOString()}`);
  lines.push(`- Source map: \`${rel(MAP_FILE)}\``);
  lines.push(`- Total strings collectées: ${stats.totalEntries || entries.length}`);
  lines.push(`- Textes uniques: ${stats.uniqueTexts || 0}`);
  lines.push(`- Groupes normalisés: ${stats.normalizedGroups || variants.length}`);
  lines.push("");

  lines.push("## Répartition par contexte");
  lines.push("");
  if (!contextStats.length) {
    lines.push("Aucune chaîne détectée.");
  } else {
    contextStats.forEach((item) => {
      lines.push(`- ${item.key}: ${item.count}`);
    });
  }
  lines.push("");

  lines.push("## Hotspots textuels (fichiers)");
  lines.push("");
  if (!hotspots.length) {
    lines.push("Aucun hotspot détecté.");
  } else {
    hotspots.forEach((item, index) => {
      lines.push(`${index + 1}. \`${item.file}\` — ${item.count} chaînes`);
    });
  }
  lines.push("");

  lines.push("## Cohérence terminologique");
  lines.push("");
  if (!conflicts.length) {
    lines.push("Aucun conflit majeur détecté automatiquement.");
  } else {
    conflicts.forEach((conflict) => {
      lines.push(`- **${conflict.key}**`);
      conflict.present.forEach((entry) => {
        const sample = entry.hits
          .flatMap((hit) => hit.variants.slice(0, 2).map((variant) => variant.text))
          .slice(0, 4)
          .join(" | ");
        lines.push(`  - variante \`${entry.label}\`: ${sample}`);
      });
    });
  }
  lines.push("");

  lines.push("## Variantes proches (normalisation)");
  lines.push("");
  nearDuplicates.forEach((item) => {
    const variantsLine = item.variants
      .slice(0, 4)
      .map((variant) => `${variant.text} (${variant.count})`)
      .join(" | ");
    lines.push(`- ${item.normalized}: ${variantsLine}`);
  });
  lines.push("");

  lines.push("## Ton & narration");
  lines.push("");
  lines.push(`- Occurrences liées à \`tu\`: ${tone.tuCount}`);
  lines.push(`- Occurrences liées à \`vous\`: ${tone.vousCount}`);
  if (tone.tuCount > 0 && tone.vousCount > 0) {
    lines.push("- Incohérence probable: mélange `tu`/`vous` détecté.");
  }
  lines.push("- Recommandation: fixer un registre unique et l’appliquer aux CTA, erreurs, onboarding, support.");
  lines.push("");

  lines.push("## Accessibilité microcopy");
  lines.push("");
  lines.push("- Vérifier les icônes sans label explicite (aria-label absent).\n- Vérifier les textes longs sur mobile pour éviter la coupure CTA.\n- Uniformiser les messages d’erreur avec action immédiate (`Réessayer`, `Contacter le support`).");
  lines.push("");

  lines.push("## Extraits sémantiques (échantillon)");
  lines.push("");
  stems.slice(0, 12).forEach((stem) => {
    const sample = stem.groups
      .flatMap((group) => group.variants.slice(0, 2).map((variant) => variant.text))
      .slice(0, 6)
      .join(" | ");
    lines.push(`- ${stem.stem}: ${sample}`);
  });
  lines.push("");

  lines.push("## Prochaine étape (non appliquée)");
  lines.push("");
  lines.push("- Construire un dictionnaire de copy canonique (actions, états, erreurs, titres), puis lancer une migration contrôlée par lot.");

  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(AUDIT_FILE, `${lines.join("\n")}\n`, "utf8");
  await fs.writeFile(NARRATION_FILE, buildNarrationPlan(), "utf8");
  console.log(`[text-audit] report written: ${rel(AUDIT_FILE)}`);
  console.log(`[text-audit] narration plan written: ${rel(NARRATION_FILE)}`);
}

main().catch((error) => {
  console.error("[text-audit] report failed", error);
  process.exitCode = 1;
});
