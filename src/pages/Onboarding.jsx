import React, { useMemo, useState } from "react";
import { Badge, Button, Card, Input, Textarea } from "../components/UI";
import ScreenShell from "./_ScreenShell";

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
        title: "Bienvenue",
        subtitle: "Une vision claire",
        content: (
          <div className="col">
            <div className="titleSm">Reste concentré sur l’essentiel.</div>
            <div className="small" style={{ marginTop: 6 }}>
              Discip-Yourself t’aide à transformer l’intention en exécution quotidienne.
            </div>
          </div>
        ),
      },
      {
        key: "why",
        title: "Pourquoi l’app existe",
        subtitle: "Moins d’hésitation, plus d’action",
        content: (
          <div className="col">
            <div className="titleSm">Clarifier, planifier, agir.</div>
            <div className="small" style={{ marginTop: 6 }}>
              Tu poses un cadre simple, puis tu avances sans friction.
            </div>
          </div>
        ),
      },
      {
        key: "how",
        title: "Comment ça marche",
        subtitle: "Catégorie → Objectif → Action → Aujourd’hui",
        content: (
          <div className="col">
            <div className="listItem">
              <div className="titleSm">1. Catégorie</div>
              <div className="small">Le domaine de ta vie.</div>
            </div>
            <div className="listItem">
              <div className="titleSm">2. Objectif</div>
              <div className="small">Le résultat à atteindre.</div>
            </div>
            <div className="listItem">
              <div className="titleSm">3. Action</div>
              <div className="small">Ce que tu fais concrètement.</div>
            </div>
            <div className="listItem">
              <div className="titleSm">4. Aujourd’hui</div>
              <div className="small">Exécute la session du jour.</div>
            </div>
          </div>
        ),
      },
      {
        key: "permissions",
        title: "Autorisations",
        subtitle: "Tu restes maître",
        content: (
          <div className="col">
            {[
              {
                key: "notifications",
                title: "Notifications",
                description: "Rappels doux dans l’app.",
              },
              {
                key: "calendar",
                title: "Calendrier",
                description: "Synchronisation future des séances.",
              },
              {
                key: "health",
                title: "Santé",
                description: "Données d’activité (optionnel).",
              },
            ].map((item) => {
              const status = permissions[item.key];
              return (
                <div key={item.key} className="listItem">
                  <div>
                    <div className="titleSm">{item.title}</div>
                    <div className="small">{item.description}</div>
                    <div className="small2">Statut : {permissionLabel(status)}</div>
                  </div>
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <Button
                      variant={status === "granted" ? "primary" : "ghost"}
                      onClick={() =>
                        setPermissions((prev) => ({ ...prev, [item.key]: "granted" }))
                      }
                    >
                      Autoriser
                    </Button>
                    <Button
                      variant={status === "unknown" ? "primary" : "ghost"}
                      onClick={() =>
                        setPermissions((prev) => ({ ...prev, [item.key]: "unknown" }))
                      }
                    >
                      Plus tard
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
        subtitle: "Une phrase pour toi",
        content: (
          <div className="col">
            <div>
              <div className="small" style={{ marginBottom: 6 }}>
                Prénom
              </div>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <div className="small" style={{ marginBottom: 6 }}>
                Pourquoi
              </div>
              <Textarea
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="Écris une phrase simple."
              />
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
          onboardingStep: 3,
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
              <Card accentBorder style={{ borderColor: planChoice === "free" ? "#7C3AED" : "rgba(255,255,255,.16)" }}>
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
                style={{ borderColor: planChoice === "premium" ? "#7C3AED" : "rgba(255,255,255,.16)" }}
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
      headerTitle={current.title}
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
              Passer
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
