import React, { useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { todayKey } from "../utils/dates";
import { computeAggregateProgress } from "../logic/goals";
import { getBackgroundCss, getAccentForPage } from "../utils/_theme";

function resolveGoalType(goal) {
  const raw = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
  if (raw === "OUTCOME" || raw === "PROCESS") return raw;
  if (raw === "STATE") return "OUTCOME";
  if (raw === "ACTION" || raw === "ONE_OFF") return "PROCESS";
  const legacy = typeof goal?.kind === "string" ? goal.kind.toUpperCase() : "";
  if (legacy === "OUTCOME") return "OUTCOME";
  if (goal?.metric && typeof goal.metric === "object") return "OUTCOME";
  return "PROCESS";
}

function goalDateKey(goal) {
  if (!goal?.startAt || typeof goal.startAt !== "string") return "";
  return goal.startAt.slice(0, 10);
}

export default function Home({ data, onOpenLibrary }) {
  const [showWhy, setShowWhy] = useState(true);
  const [showSecondary, setShowSecondary] = useState(false);
  const [startedGoalId, setStartedGoalId] = useState(null);
  const safeData = data && typeof data === "object" ? data : {};
  const profile = safeData.profile || {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];

  if (categories.length === 0) {
    return (
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
        backgroundCss={getBackgroundCss({ data: safeData, pageId: "home", image: profile.whyImage || "" })}
        backgroundImage={profile.whyImage || ""}
        headerTitle="Today"
        headerSubtitle="Aucune catégorie"
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small" style={{ marginTop: 6 }}>
              Ajoute une première catégorie pour commencer.
            </div>
            <div className="mt12">
              <Button onClick={() => (typeof onOpenLibrary === \"function\" ? onOpenLibrary() : null)}>
                Ouvrir la bibliothèque
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  if (goals.length === 0) {
    return (
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
        backgroundCss={getBackgroundCss({ data: safeData, pageId: "home", image: profile.whyImage || "" })}
        backgroundImage={profile.whyImage || ""}
        headerTitle="Today"
        headerSubtitle="Aucun objectif"
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucun objectif</div>
            <div className="small" style={{ marginTop: 6 }}>
              Crée un premier objectif pour commencer.
            </div>
            <div className="mt12">
              <Button onClick={() => (typeof onOpenLibrary === "function" ? onOpenLibrary() : null)}>
                Ouvrir la bibliothèque
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const outcomes = goals.filter((g) => resolveGoalType(g) === "OUTCOME");
  const activeOutcomes = outcomes.filter((g) => g.status === "active");
  const mainOutcome = activeOutcomes[0] || outcomes[0] || null;

  const aggregate = useMemo(
    () => computeAggregateProgress({ goals }, mainOutcome?.id),
    [goals, mainOutcome?.id]
  );

  const processActives = goals.filter((g) => g.status === "active" && resolveGoalType(g) === "PROCESS");
  const today = todayKey();
  const dueToday = processActives.filter((g) => goalDateKey(g) === today);

  let primary = dueToday[0] || null;
  if (!primary && processActives.length) {
    primary = [...processActives].sort((a, b) => (Number(b.weight || 0) - Number(a.weight || 0)))[0];
  }

  if (!primary) {
    return (
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
        backgroundCss={getBackgroundCss({ data: safeData, pageId: "home", image: profile.whyImage || "" })}
        backgroundImage={profile.whyImage || ""}
        headerTitle="Today"
        headerSubtitle="Aucune action active"
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune action active</div>
            <div className="small" style={{ marginTop: 6 }}>
              Active un PROCESS dans Plan pour le voir ici.
            </div>
            <div className="mt12">
              <Button onClick={() => (typeof onOpenLibrary === "function" ? onOpenLibrary() : null)}>
                Ouvrir la bibliothèque
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const secondary = processActives.filter((g) => g.id !== primary?.id).slice(0, 2);

  const accent = getAccentForPage(safeData, "home");
  const backgroundImage = profile.whyImage || "";
  const backgroundCss = getBackgroundCss({ data: safeData, pageId: "home", image: backgroundImage });
  const whyText = (profile.whyText || "").trim();
  const whyDisplay = whyText || "Ajoute ton pourquoi dans l’onboarding.";
  const progressPct = Math.round(aggregate.progress * 100);

  const primaryDateKey = primary ? goalDateKey(primary) : "";
  const primaryDateLabel = primaryDateKey
    ? primaryDateKey === today
      ? "Aujourd’hui"
      : `Planifié: ${primaryDateKey}`
    : "";

  return (
    <ScreenShell
      accent={accent}
      backgroundCss={backgroundCss}
      backgroundImage={backgroundImage}
      headerTitle="Today"
      headerSubtitle="Priorité unique"
    >
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <div
          className="small2"
          style={{
            flex: 1,
            minWidth: 0,
            whiteSpace: showWhy ? "normal" : "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {whyDisplay}
        </div>
        <button className="linkBtn" onClick={() => setShowWhy((v) => !v)}>
          {showWhy ? "Masquer" : "Afficher"}
        </button>
      </div>

      <Card accentBorder style={{ marginTop: 12, borderColor: accent }}>
        <div className="p18">
          <div className="titleSm">Action principale du jour</div>
          <div className="small2" style={{ marginTop: 4 }}>
            {primary ? "Priorité unique" : "Aucune action active"}
          </div>

          {primary ? (
              <div className="mt12 col">
                <div style={{ fontWeight: 800, fontSize: 18 }}>{primary.title || "Action"}</div>
                {primaryDateLabel ? <div className="small2">{primaryDateLabel}</div> : null}

              <div className="mt12 row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <Button onClick={() => setStartedGoalId((prev) => (prev === primary.id ? null : primary.id))}>
                  Start
                </Button>
                {startedGoalId === primary.id ? (
                  <div className="small2">Session en cours…</div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt12 small2">Active une action dans Plan.</div>
          )}
        </div>
      </Card>

      <Card accentBorder style={{ marginTop: 12 }}>
        <div className="p18">
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="titleSm">Progression OUTCOME</div>
              <div className="small2">Agrégat principal</div>
            </div>
            <div style={{ fontWeight: 800 }}>{progressPct}%</div>
          </div>
          <div className="progressTrack" style={{ marginTop: 12 }}>
            <div className="progressFill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </Card>

      <div className="mt12">
        <button className="linkBtn" onClick={() => setShowSecondary((v) => !v)}>
          {showSecondary ? "Masquer" : `Secondaires (${secondary.length})`}
        </button>
        {showSecondary ? (
          <div className="mt10 col">
            {secondary.length ? (
              secondary.map((g) => (
                <div key={g.id} className="listItem">
                  <div style={{ fontWeight: 700 }}>{g.title || "Action"}</div>
                  <div className="small2">{g.startAt ? `Planifié: ${goalDateKey(g)}` : "Planifié"}</div>
                </div>
              ))
            ) : (
              <div className="small2">Aucune action secondaire.</div>
            )}
          </div>
        ) : null}
      </div>
    </ScreenShell>
  );
}
