import React, { useMemo, useState } from "react";
import { Badge, Button, Card, Input, Textarea } from "../components/UI";
import ScreenShell from "./_ScreenShell";
import { BRAND_ACCENT } from "../theme/themeTokens";
import { LABELS } from "../ui/labels";

const ACCENT = `var(--accent, ${BRAND_ACCENT})`;
const BORDER_DEFAULT = "var(--border)";
const SURFACE_SOFT = "var(--surface)";

function normalizePermission(value) {
  if (value === "granted" || value === "denied") return value;
  return "unknown";
}

function permissionLabel(value) {
  if (value === "granted") return "Autorisé";
  if (value === "denied") return "Refusé";
  return "En attente";
}

export default function Onboarding({ data, setData, onDone, planOnly = false }) {
  const safeData = data && typeof data === "object" ? data : {};
  const profile = safeData.profile || {};
  const ui = safeData.ui || {};

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(profile.name || "");
  const [why, setWhy] = useState(profile.whyText || "");
  const [planChoice, setPlanChoice] = useState(profile.plan === "premium" ? "premium" : "free");
  const [permissions, setPermissions] = useState(() => ({
    notifications: normalizePermission(ui.permissions?.notifications),
    calendar: normalizePermission(ui.permissions?.calendar),
    health: normalizePermission(ui.permissions?.health),
  }));

  const slides = useMemo(
    () => [
      {
        key: "welcome",
        title: "Discip-Yourself",
        subtitle: "Clarté · Discipline · Exécution",
        content: (
          <div className="col">
            <div className="titleSm">Un cadre simple. Une exécution quotidienne.</div>
            <div className="small" style={{ marginTop: 8 }}>
              Tu définis ce qui compte. L’app transforme le reste en actions concrètes, au bon moment.
            </div>
            <div className="small2" style={{ marginTop: 10, opacity: 0.9 }}>
              60 secondes pour configurer. Ensuite : tu exécutes.
            </div>
          </div>
        ),
      },
      {
        key: "why",
        title: "Le principe",
        subtitle: "Moins de décisions. Plus d’action.",
        content: (
          <div className="col">
            <div className="titleSm">Tu supprimes le flou.</div>
            <div className="small" style={{ marginTop: 8 }}>
              Pas de surcharge. Pas de listes interminables. Tu clarifies ton intention et tu suis un plan lisible.
            </div>
            <div className="card" style={{ marginTop: 12, padding: 12, background: SURFACE_SOFT, border: `1px solid ${BORDER_DEFAULT}`, borderRadius: 14 }}>
              <div className="small">{LABELS.goal} : te faire gagner du temps mental et verrouiller l’exécution.</div>
            </div>
          </div>
        ),
      },
      {
        key: "how",
        title: "Le système",
        subtitle: `Catégorie → ${LABELS.goal} → ${LABELS.action} → Aujourd’hui`,
        content: (
          <div className="col">
            {[
              { n: "1", t: "Catégorie", d: "Le domaine de ta vie (ex : Finance, Santé)." },
              { n: "2", t: LABELS.goal, d: "Le résultat à atteindre, sur une période." },
              { n: "3", t: "Action", d: "Le comportement concret à exécuter." },
              { n: "4", t: "Aujourd’hui", d: "La liste exacte de ce qui est attendu maintenant." },
            ].map((x) => (
              <div key={x.n} className="row" style={{ gap: 10, alignItems: "flex-start", padding: "10px 0" }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 9,
                    display: "grid",
                    placeItems: "center",
                    border: `1px solid ${BORDER_DEFAULT}`,
                    color: "rgba(255,255,255,.92)",
                    background: SURFACE_SOFT,
                    flex: "0 0 auto",
                    fontWeight: 700,
                  }}
                >
                  {x.n}
                </div>
                <div>
                  <div className="titleSm" style={{ lineHeight: 1.1 }}>{x.t}</div>
                  <div className="small" style={{ marginTop: 4 }}>{x.d}</div>
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        key: "permissions",
        title: "Autorisations",
        subtitle: "Tu gardes le contrôle",
        content: (
          <div className="col">
            <div className="small" style={{ marginBottom: 10 }}>
              Tu peux tout activer plus tard. Rien n’est obligatoire.
            </div>
            {[
              {
                key: "notifications",
                title: "Notifications",
                description: "Rappels utiles quand tu as prévu un créneau.",
              },
              {
                key: "calendar",
                title: "Calendrier",
                description: "Synchronisation des séances (optionnel).",
              },
              {
                key: "health",
                title: "Santé",
                description: "Données d’activité (optionnel).",
              },
            ].map((item) => {
              const status = permissions[item.key];
              return (
                <div
                  key={item.key}
                  className="listItem"
                  style={{
                    border: `1px solid ${BORDER_DEFAULT}`,
                    borderRadius: 16,
                    padding: 14,
                    background: SURFACE_SOFT,
                  }}
                >
                  <div>
                    <div className="titleSm">{item.title}</div>
                    <div className="small">{item.description}</div>
                    <div className="small2" style={{ marginTop: 4, opacity: 0.9 }}>
                      Statut : {permissionLabel(status)}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <Button
                      variant={status === "granted" ? "primary" : "ghost"}
                      onClick={() => setPermissions((prev) => ({ ...prev, [item.key]: "granted" }))}
                    >
                      Autoriser
                    </Button>
                    <Button
                      variant={status === "unknown" ? "primary" : "ghost"}
                      onClick={() => setPermissions((prev) => ({ ...prev, [item.key]: "unknown" }))}
                    >
                      Plus tard
                    </Button>
                    <Button
                      variant={status === "denied" ? "primary" : "ghost"}
                      onClick={() => setPermissions((prev) => ({ ...prev, [item.key]: "denied" }))}
                    >
                      Refuser
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ),
      },
      {
        key: "engagement",
        title: "Engagement",
        subtitle: "Un cap. Une phrase.",
        content: (
          <div className="col">
            <div>
              <div className="small" style={{ marginBottom: 6 }}>Prénom</div>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ton prénom" />
            </div>
            <div>
              <div className="small" style={{ marginBottom: 6 }}>Ton “Pourquoi”</div>
              <Textarea
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="Ex : Je veux reprendre le contrôle et exécuter sans négocier."
              />
              <div className="small2" style={{ marginTop: 8, opacity: 0.9 }}>
                Cette phrase s’affichera quand tu auras besoin de te recentrer.
              </div>
            </div>
          </div>
        ),
      },
    ],
    [firstName, why, permissions]
  );

  const totalSteps = slides.length;
  const current = slides[step];
  const cleanFirstName = (firstName || "").trim();
  const cleanWhy = (why || "").trim();
  const canFinish = Boolean(cleanFirstName && cleanWhy);

  const finishOnboarding = () => {
    setData((prev) => {
      const prevUi = prev.ui || {};
      const nextProfile = { ...(prev.profile || {}) };
      if (cleanFirstName) nextProfile.name = cleanFirstName;
      if (cleanWhy) {
        nextProfile.whyText = cleanWhy;
        nextProfile.whyUpdatedAt = new Date().toISOString();
      }
      return {
        ...prev,
        profile: nextProfile,
        ui: {
          ...prevUi,
          onboardingCompleted: true,
          onboardingSeenVersion: 2,
          tutorialEnabled: true,
          tutorialStep: 0,
          permissions: {
            notifications: permissions.notifications,
            calendar: permissions.calendar,
            health: permissions.health,
          },
          onboardingStep: 0,
          showPlanStep: false,
        },
      };
    });
    if (typeof onDone === "function") onDone();
  };

  if (planOnly) {
    return (
      <ScreenShell data={safeData} pageId="onboarding" headerTitle="Abonnement" headerSubtitle="Choisis ton plan">
        <Card accentBorder>
          <div className="p18">
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="titleSm">Choisis ton plan</div>
                <div className="small">Aucune facturation ici. Tu pourras changer plus tard.</div>
              </div>
              <Badge>Plan</Badge>
            </div>

            <div className="mt14 grid2">
              <Card accentBorder style={{ borderColor: planChoice === "free" ? ACCENT : BORDER_DEFAULT }}>
                <div className="p18 col">
                  <div className="titleSm">Gratuit</div>
                  <div className="small2">L’essentiel pour démarrer.</div>
                  <Button
                    variant={planChoice === "free" ? "primary" : "ghost"}
                    onClick={() => setPlanChoice("free")}
                  >
                    {planChoice === "free" ? "Sélectionné" : "Choisir Gratuit"}
                  </Button>
                </div>
              </Card>

              <Card
                accentBorder
                style={{ borderColor: planChoice === "premium" ? ACCENT : BORDER_DEFAULT }}
              >
                <div className="p18 col">
                  <div className="titleSm">Premium</div>
                  <div className="small2">Liberté totale et réglages avancés.</div>
                  <Button
                    variant={planChoice === "premium" ? "primary" : "ghost"}
                    onClick={() => setPlanChoice("premium")}
                  >
                    {planChoice === "premium" ? "Sélectionné" : "Choisir Premium"}
                  </Button>
                </div>
              </Card>
            </div>

            <div className="mt12">
              <Button
                onClick={() => {
                  setData((prev) => {
                    const prevUi = prev.ui || {};
                    const nextProfile = { ...(prev.profile || {}), plan: planChoice };
                    return {
                      ...prev,
                      profile: nextProfile,
                      ui: {
                        ...prevUi,
                        onboardingCompleted: prevUi.onboardingCompleted,
                        onboardingStep: 3,
                        showPlanStep: false,
                      },
                    };
                  });
                  if (typeof onDone === "function") onDone();
                }}
              >
                Accéder à l’app
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="onboarding"
      headerTitle={current.title || "Discip-Yourself"}
      headerSubtitle={`${current.subtitle} · ${step + 1}/${totalSteps}`}
    >
      <Card accentBorder>
        <div className="p18 col">
          {current.content}
          {step === totalSteps - 1 && !canFinish ? (
            <div className="small2" style={{ marginTop: 10 }}>
              Remplis ton prénom et une phrase pour terminer.
            </div>
          ) : null}
          <div className="row" style={{ marginTop: 14, justifyContent: "space-between", alignItems: "center" }}>
            <Button variant="ghost" onClick={finishOnboarding}>
              Ignorer
            </Button>
            <Button
              disabled={step === totalSteps - 1 && !canFinish}
              onClick={() => {
                if (step < totalSteps - 1) {
                  setStep(step + 1);
                  return;
                }
                if (!canFinish) return;
                finishOnboarding();
              }}
            >
              Continuer
            </Button>
          </div>
        </div>
      </Card>
    </ScreenShell>
  );
}
