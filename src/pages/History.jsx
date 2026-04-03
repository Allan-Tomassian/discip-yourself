import React, { useMemo } from "react";
import { AppCard, AppScreen, EmptyState, SectionHeader } from "../shared/ui/app";

function sortHistory(left, right) {
  const leftTs = Date.parse(left?.endAt || left?.startAt || "") || 0;
  const rightTs = Date.parse(right?.endAt || right?.startAt || "") || 0;
  if (leftTs !== rightTs) return rightTs - leftTs;
  return String(right?.dateKey || "").localeCompare(String(left?.dateKey || ""));
}

function formatDate(value) {
  const ts = Date.parse(value || "");
  if (!Number.isFinite(ts)) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return value || "";
  }
}

function formatMinutes(value) {
  if (!Number.isFinite(value)) return "0 min";
  return `${Math.max(0, Math.round(value))} min`;
}

function resolveStateLabel(entry) {
  const reason = typeof entry?.endedReason === "string" ? entry.endedReason : "";
  if (reason === "done") return "Terminée";
  if (reason === "blocked") return "Bloquée";
  if (reason === "reported") return "Reportée";
  if (reason === "canceled") return "Annulée";
  return entry?.state === "in_progress" ? "En cours" : "Clôturée";
}

export default function History({ data }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const occurrences = Array.isArray(safeData.occurrences) ? safeData.occurrences : [];
  const sessionHistory = Array.isArray(safeData.sessionHistory) ? safeData.sessionHistory : [];

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const goalsById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const occurrencesById = useMemo(
    () => new Map(occurrences.map((occurrence) => [occurrence.id, occurrence])),
    [occurrences]
  );

  const items = useMemo(
    () =>
      sessionHistory
        .slice()
        .sort(sortHistory)
        .map((entry) => {
          const occurrence = occurrencesById.get(entry?.occurrenceId) || null;
          const goal = goalsById.get(entry?.actionId || occurrence?.goalId || "") || null;
          const category = categoriesById.get(goal?.categoryId || "") || null;
          const plannedMinutes = Number.isFinite(occurrence?.durationMinutes)
            ? occurrence.durationMinutes
            : Number.isFinite(goal?.sessionMinutes)
              ? goal.sessionMinutes
              : null;
          const realMinutes = Number.isFinite(entry?.timerSeconds)
            ? Math.round(entry.timerSeconds / 60)
            : plannedMinutes;
          return {
            id: entry?.id || `${entry?.occurrenceId || ""}:${entry?.dateKey || ""}`,
            title: goal?.title || "Action",
            categoryName: category?.name || "Catégorie",
            dateLabel: formatDate(entry?.endAt || entry?.startAt || ""),
            plannedMinutes,
            realMinutes,
            stateLabel: resolveStateLabel(entry),
            feedbackLabel: entry?.feedbackLevel || "",
            feedbackText: entry?.feedbackText || "",
          };
        }),
    [categoriesById, goalsById, occurrencesById, sessionHistory]
  );

  return (
    <AppScreen
      data={safeData}
      pageId="history"
      backgroundImage={safeData?.profile?.whyImage || ""}
      headerTitle="Historique"
      headerSubtitle="Retrouve tes sessions terminées, reportées ou bloquées."
    >
      <section className="mainPageSection">
        <SectionHeader title="Sessions" subtitle="Lecture chronologique de tes sessions récentes." />
        <AppCard className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="col gap12">
            {items.length ? (
              items.map((item) => (
                <div key={item.id} className="GateInlineMetaCard col gap8">
                  <div className="GateRoleCardMeta">
                    {[item.categoryName, item.dateLabel].filter(Boolean).join(" • ")}
                  </div>
                  <div className="GateRoleCardTitle">{item.title}</div>
                  <div className="GateRoleHelperText">
                    Prévu: {formatMinutes(item.plannedMinutes)} · Réel: {formatMinutes(item.realMinutes)} · {item.stateLabel}
                  </div>
                  {item.feedbackLabel ? (
                    <div className="GateRoleHelperText">
                      Ressenti : {item.feedbackLabel}
                      {item.feedbackText ? ` · ${item.feedbackText}` : ""}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState
                className="GateInlineMetaCard"
                title="Aucune session enregistrée"
                subtitle="L’historique se remplira dès que tu termines, reportes ou bloques une session."
              />
            )}
          </div>
        </AppCard>
      </section>
    </AppScreen>
  );
}
