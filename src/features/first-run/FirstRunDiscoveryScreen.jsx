import React from "react";
import { PrimaryButton } from "../../shared/ui/app";
import FirstRunStepScreen from "./FirstRunStepScreen";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMinutes(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

function formatDate(dateKey) {
  const safeDate = normalizeString(dateKey);
  const match = safeDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return safeDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function resolveOccurrenceTime(occurrence) {
  const direct = normalizeString(occurrence?.start || occurrence?.slotKey);
  if (direct && !occurrence?.noTime) return direct;
  const startAt = normalizeString(occurrence?.startAt);
  const timeMatch = startAt.match(/T(\d{2}:\d{2})/);
  if (timeMatch?.[1] && !occurrence?.noTime) return timeMatch[1];
  return "créneau flexible";
}

function compareOccurrenceTime(left, right) {
  const leftDate = normalizeString(left?.date);
  const rightDate = normalizeString(right?.date);
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  const leftStart = normalizeString(left?.start || left?.slotKey || left?.startAt);
  const rightStart = normalizeString(right?.start || right?.slotKey || right?.startAt);
  return leftStart.localeCompare(rightStart);
}

function resolveFirstBlock(data) {
  const state = data && typeof data === "object" ? data : {};
  const firstRun = state.ui?.firstRunV1 && typeof state.ui.firstRunV1 === "object" ? state.ui.firstRunV1 : {};
  const commitOccurrenceIds = new Set(safeArray(firstRun.commitV1?.createdOccurrenceIds).filter(Boolean));
  const goalsById = new Map(safeArray(state.goals).filter((goal) => goal?.id).map((goal) => [goal.id, goal]));
  const candidateOccurrences = safeArray(state.occurrences)
    .filter((occurrence) => {
      if (!occurrence?.id || !occurrence?.goalId) return false;
      if (commitOccurrenceIds.size && !commitOccurrenceIds.has(occurrence.id)) return false;
      const status = normalizeString(occurrence.status).toLowerCase();
      return !status || status === "planned" || status === "postponed" || status === "rescheduled";
    })
    .sort(compareOccurrenceTime);
  const occurrence = candidateOccurrences[0] || null;
  if (!occurrence) return null;
  const action = goalsById.get(occurrence.goalId) || null;
  const duration = normalizeMinutes(occurrence.durationMinutes || action?.durationMinutes || action?.sessionMinutes);
  return {
    title: normalizeString(action?.title || occurrence.title) || "Premier bloc",
    when: [formatDate(occurrence.date), resolveOccurrenceTime(occurrence)].filter(Boolean).join(" · "),
    duration: duration ? `${duration} min` : "",
  };
}

export default function FirstRunDiscoveryScreen({ data, onComplete }) {
  const firstBlock = resolveFirstBlock(data);

  return (
    <FirstRunStepScreen
      data={data}
      testId="first-run-screen-discovery"
      title="Ton système est prêt"
      subtitle="Ton premier bloc est planifié. Tu peux commencer depuis Home."
      badge=""
      footer={<PrimaryButton onClick={onComplete}>Aller à Home</PrimaryButton>}
      bodyClassName="firstRunDiscoveryBody"
    >
      <div className="firstRunDiscoveryHero">
        <p className="firstRunDiscoveryLead">
          Ton système est activé. Commence par le premier bloc, puis ajuste depuis l’app si nécessaire.
        </p>

        <div className="firstRunSupportList" aria-label="Confirmations du système">
          <div className="firstRunSupportItem">
            <div className="firstRunSupportItemTitle">Objectif créé</div>
            <div className="firstRunSupportItemText">Ton résultat prioritaire est maintenant posé dans le système.</div>
          </div>

          <div className="firstRunSupportItem">
            <div className="firstRunSupportItemTitle">Première action définie</div>
            <div className="firstRunSupportItemText">Une action concrète est prête pour démarrer sans refaire le plan.</div>
          </div>

          <div className="firstRunSupportItem">
            <div className="firstRunSupportItemTitle">Premier bloc planifié</div>
            <div className="firstRunSupportItemText">Home affichera le prochain bloc à exécuter.</div>
          </div>
        </div>

        {firstBlock ? (
          <div className="firstRunFirstBlockSummary" data-testid="first-run-discovery-first-block">
            <span>Premier bloc</span>
            <strong>{firstBlock.title}</strong>
            <em>{[firstBlock.when, firstBlock.duration].filter(Boolean).join(" · ")}</em>
          </div>
        ) : null}
      </div>
    </FirstRunStepScreen>
  );
}
