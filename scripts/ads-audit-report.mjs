#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const MAP_FILE = path.join(DOCS_DIR, "ads-map.json");
const AUDIT_FILE = path.join(DOCS_DIR, "ads-audit.md");
const CHECKLIST_FILE = path.join(DOCS_DIR, "ads-ready-checklist.md");
const RISK_FILE = path.join(DOCS_DIR, "ads-risk-appstore.md");

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function rel(absPath) {
  return toPosix(path.relative(ROOT, absPath));
}

function includesText(value, needle) {
  return String(value || "").toLowerCase().includes(String(needle || "").toLowerCase());
}

function hasPath(map, pathPart) {
  const part = String(pathPart || "").toLowerCase();
  return (map.fileSummaries || []).some((entry) => String(entry.file || "").toLowerCase().includes(part));
}

async function existsRel(relPath) {
  try {
    await fs.access(path.join(ROOT, relPath));
    return true;
  } catch {
    return false;
  }
}

function findHits(map, predicate) {
  return (map.keywordHits || []).filter(predicate);
}

function formatHit(hit) {
  return `- ${hit.file}:${hit.line}: ${String(hit.snippet || "").trim()}`;
}

function topHits(hits, limit = 20) {
  return hits.slice(0, limit).map(formatHit).join("\n");
}

function dedupeDeps(entries) {
  const out = new Map();
  for (const dep of entries || []) {
    const key = `${dep.name}@${dep.version}`;
    if (!out.has(key)) out.set(key, { name: dep.name, version: dep.version });
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function detectVerdict(realSdkDeps, hasRewardedAdsModule) {
  if (realSdkDeps.length > 0) return "provider real present";
  if (hasRewardedAdsModule) return "provider abstraction (stub only)";
  return "stub only";
}

function riskLevel(count) {
  if (count === 0) return "low";
  if (count <= 5) return "medium";
  return "high";
}

async function main() {
  const raw = await fs.readFile(MAP_FILE, "utf8");
  const map = JSON.parse(raw);

  const hasRewardedAdsModule = await existsRel("src/logic/rewardedAds.js");
  const hasWalletModule = await existsRel("src/logic/walletV1.js");
  const hasRewardedModal = await existsRel("src/ui/today/RewardedAdModal.jsx");
  const hasWalletPersistence = (await existsRel("src/logic/state/normalizers.js")) && (await existsRel("src/logic/state/migrations.js"));
  const hasMicroWatchAdCta = findHits(
    map,
    (hit) =>
      (includesText(hit.file, "microaction") || includesText(hit.file, "home") || includesText(hit.file, "today")) &&
      (includesText(hit.snippet, "micro-watch-ad") || includesText(hit.snippet, "regarder une vidéo") || includesText(hit.snippet, "watch ad"))
  ).length > 0;
  const hasAdsE2E = await existsRel("tests/e2e/micro-actions.coins-and-ads.spec.js");

  const trackingHits = findHits(
    map,
    (hit) =>
      hit.keywords?.includes("tracking") ||
      hit.keywords?.includes("idfa") ||
      hit.keywords?.includes("att") ||
      hit.keywords?.includes("consent") ||
      hit.keywords?.includes("gdpr")
  );

  const adUiHits = findHits(
    map,
    (hit) =>
      includesText(hit.file, "microaction") ||
      includesText(hit.file, "home") ||
      includesText(hit.file, "today") ||
      includesText(hit.file, "topmenupopover") ||
      includesText(hit.file, "paywall") ||
      includesText(hit.file, "rewardedad")
  );

  const providerMentionHits = findHits(
    map,
    (hit) =>
      hit.keywords?.includes("admob") ||
      hit.keywords?.includes("unity") ||
      hit.keywords?.includes("interstitial") ||
      hit.keywords?.includes("banner")
  );

  const envAdHits = (map.envHits || []).filter(
    (hit) => hit.vars?.some((v) => includesText(v, "ADS") || includesText(v, "ADMOB") || includesText(v, "UNITY"))
  );

  const realSdkDeps = dedupeDeps([...(map.packageJsonSdkDeps || []), ...(map.packageLockSdkDeps || [])]);
  const verdict = detectVerdict(realSdkDeps, hasRewardedAdsModule);
  const trackingRisk = riskLevel(trackingHits.length);

  const auditMd = [
    "# Ads Audit",
    "",
    `_Generated: ${new Date().toISOString()}_`,
    "",
    "## Verdict",
    `- Status: ${verdict}`,
    `- Real ad SDK detected: ${realSdkDeps.length ? "yes" : "no"}`,
    `- Provider abstraction present: ${hasRewardedAdsModule ? "yes" : "no"}`,
    "",
    "## Section 1: Ce qui est déjà en place",
    `- Wallet module: ${hasWalletModule ? "present (src/logic/walletV1.js)" : "missing"}`,
    `- Rewarded ads abstraction: ${hasRewardedAdsModule ? "present (src/logic/rewardedAds.js)" : "missing"}`,
    `- Rewarded modal UI: ${hasRewardedModal ? "present (src/ui/today/RewardedAdModal.jsx)" : "missing"}`,
    `- Persistance UI (normalizers/migrations): ${hasWalletPersistence ? "present" : "missing"}`,
    `- CTA UI Regarder une vidéo: ${hasMicroWatchAdCta ? "present" : "not detected"}`,
    `- Tests e2e ads/wallet: ${hasAdsE2E ? "present (tests/e2e/micro-actions.coins-and-ads.spec.js)" : "missing"}`,
    "",
    "## Section 2: Ce qui manque pour brancher un provider réel",
    "- Aucun SDK provider réel détecté (AdMob/Unity/IronSource/etc.) dans package.json / package-lock.json.",
    "- Pas de couche explicite provider=stub|real pilotée par env dédiée ads.",
    "- Pas de stratégie explicite de preload/load-state provider (ready, unavailable, timeout).",
    "- Pas de fallback réseau/offline documenté pour ad load/show/reward.",
    "- Pas de télémétrie provider standardisée (impression/click/reward/fail) dédiée ads.",
    "",
    "## Section 3: Où l’UI déclenche les ads",
    adUiHits.length ? topHits(adUiHits, 25) : "- Aucun point UI ads trouvé.",
    "",
    "## Section 4: Risque / conformité App Store",
    `- Hits tracking/consent/ATT/IDFA: ${trackingHits.length}`,
    `- Niveau de risque estimé (statique): ${trackingRisk}`,
    `- SDK ads réels détectés: ${realSdkDeps.length}`,
    `- Variables d’environnement ads détectées: ${envAdHits.length}`,
    "",
    "### Observations conformité",
    "- Aucune intégration provider ads réelle détectée: risque ATT/IDFA immédiat réduit côté code actuel.",
    "- Des mentions tracking/consent peuvent exister dans docs/tests; à vérifier avant release native avec SDK réel.",
    "- La séparation stub/réel n’est pas explicitement câblée par configuration runtime ads (env flag dédié).",
    "",
    "## Section 5: Plan minimal recommandé (non appliqué)",
    "1. Introduire un adapter adsProvider (stub + real) avec interface unique loadRewarded/showRewarded.",
    "2. Ajouter un switch config explicite (ADS_PROVIDER=stub|real) et garde-fou fail-safe.",
    "3. Standardiser les états UI provider (loading/unavailable/rewarded/dismissed/error).",
    "4. Ajouter logs structurés ads (load start/success/fail, show start/fail, reward granted).",
    "5. Prévoir policy consent/ATT avant intégration SDK réel (iOS + Android).",
    "6. Ajouter tests e2e provider unavailable et reward denied en plus des cas happy path.",
    "7. Documenter les limites journalières + synchronisation backend éventuelle anti-abus.",
    "8. Prévoir fallback hors ligne (désactivation CTA + message explicite).",
    "",
    "## Données brutes",
    `- Map JSON: ${rel(path.join(DOCS_DIR, "ads-map.json"))}`,
    "- Commandes utilisées:",
    "  - node scripts/ads-audit-scan.mjs && node scripts/ads-audit-report.mjs",
    "",
  ].join("\n");

  const checklistMd = [
    "# Ads Ready Checklist",
    "",
    `_Generated: ${new Date().toISOString()}_`,
    "",
    "## Core architecture",
    `- [${hasRewardedAdsModule ? "x" : " "}] Rewarded abstraction module exists (src/logic/rewardedAds.js)`,
    `- [${hasWalletModule ? "x" : " "}] Wallet module exists (src/logic/walletV1.js)`,
    "- [ ] Real provider adapter implemented (AdMob/Unity)",
    "- [ ] Runtime switch stub|real documented and tested",
    "",
    "## UI + UX",
    `- [${hasMicroWatchAdCta ? "x" : " "}] Watch-ad CTA detected in UI`,
    `- [${hasRewardedModal ? "x" : " "}] Rewarded modal/stub flow exists`,
    "- [ ] Provider unavailable UX fully specified and localized",
    "",
    "## Persistence + guards",
    `- [${hasWalletPersistence ? "x" : " "}] Wallet persistence path exists (normalizers/migrations)`,
    "- [ ] Anti-abuse strategy documented for production",
    "- [ ] Server-side reward verification strategy (if needed)",
    "",
    "## Compliance",
    "- [ ] ATT flow integrated (iOS real SDK case)",
    "- [ ] Consent/GDPR flow integrated",
    "- [ ] Privacy policy + tracking disclosure aligned with implementation",
    "",
    "## Testing",
    `- [${hasAdsE2E ? "x" : " "}] Ads/wallet e2e test detected`,
    "- [ ] Provider real integration tests",
    "- [ ] Failure-path tests (timeout/no-fill/network)",
    "",
  ].join("\n");

  const riskMd = [
    "# Ads App Store Risk Audit",
    "",
    `_Generated: ${new Date().toISOString()}_`,
    "",
    "## Summary",
    `- Verdict: ${verdict}`,
    `- Real SDK ads detected: ${realSdkDeps.length}`,
    `- Tracking/ATT/consent keyword hits: ${trackingHits.length}`,
    "",
    "## Potential risks",
    "1. Tracking declarations mismatch: if real SDK is added without ATT/consent flow, review risk increases.",
    "2. Consent flow absent in runtime: static scan did not find a concrete runtime pipeline tied to ads provider behavior.",
    "3. No explicit provider switch: stub vs real separation appears implicit.",
    "",
    "## Evidence (tracking/consent hits)",
    trackingHits.length ? topHits(trackingHits, 30) : "- No tracking/ATT/IDFA/consent/GDPR hits found in scanned lines.",
    "",
    "## Provider-related references",
    providerMentionHits.length
      ? topHits(providerMentionHits, 20)
      : "- No provider-specific keywords (admob/unity/interstitial/banner) detected.",
    "",
    "## SDK dependency findings",
    realSdkDeps.length
      ? realSdkDeps.map((dep) => `- ${dep.name}@${dep.version}`).join("\n")
      : "- No ad/tracking SDK dependency detected in package manifests.",
    "",
    "## Recommendation (non-applied)",
    "- Keep stub path as default.",
    "- Add explicit runtime flag + adapter layer before integrating any SDK.",
    "- Define ATT/consent/privacy checklist as release gate for native builds.",
    "",
  ].join("\n");

  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(AUDIT_FILE, `${auditMd}\n`, "utf8");
  await fs.writeFile(CHECKLIST_FILE, `${checklistMd}\n`, "utf8");
  await fs.writeFile(RISK_FILE, `${riskMd}\n`, "utf8");

  console.log(`[ads-audit-report] wrote ${rel(AUDIT_FILE)}`);
  console.log(`[ads-audit-report] wrote ${rel(CHECKLIST_FILE)}`);
  console.log(`[ads-audit-report] wrote ${rel(RISK_FILE)}`);
  console.log(`[ads-audit-report] verdict: ${verdict}`);
}

main().catch((error) => {
  console.error("[ads-audit-report] failed", error);
  process.exit(1);
});
