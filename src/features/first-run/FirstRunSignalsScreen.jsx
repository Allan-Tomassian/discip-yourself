import React from "react";
import {
  AppChip,
  AppInput,
  ChoiceCard,
  FieldGroup,
  GhostButton,
  PrimaryButton,
} from "../../shared/ui/app";
import { USER_AI_CATEGORY_META } from "../../domain/userAiProfile";
import FirstRunCommandSurface from "./FirstRunCommandSurface";

const DAY_OPTIONS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "M" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 7, label: "D" },
];

const CAPACITY_OPTIONS = [
  {
    id: "reprise",
    title: "Reprise",
    description: "Je reconstruis sans me griller.",
  },
  {
    id: "stable",
    title: "Stable",
    description: "Je peux tenir un rythme sérieux.",
  },
  {
    id: "forte",
    title: "Forte",
    description: "Je peux absorber une charge dense.",
  },
];

const CATEGORY_SIGNAL_DESCRIPTIONS = Object.freeze({
  health: "Énergie, corps, rythme.",
  business: "Projet, revenus, exécution.",
  learning: "Compétence, étude, progression.",
  productivity: "Focus, organisation, constance.",
  personal: "Vie perso, cadre, équilibre.",
  finance: "Argent, clarté, décisions.",
});

function SignalBoardSection({ title, description, className = "", children }) {
  return (
    <section className={["firstRunSignalBoardSection", className].filter(Boolean).join(" ")}>
      <div className="firstRunSignalBoardHeader">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="firstRunSignalBoardBody">{children}</div>
    </section>
  );
}

function WindowEditorCard({
  title,
  windowValue,
  onPatch,
  onRemove,
  removeLabel,
}) {
  const safeWindow = windowValue && typeof windowValue === "object" ? windowValue : {};
  const selectedDays = Array.isArray(safeWindow.daysOfWeek) ? safeWindow.daysOfWeek : [];

  const toggleDay = (day) => {
    const nextDays = selectedDays.includes(day)
      ? selectedDays.filter((value) => value !== day)
      : [...selectedDays, day];
    onPatch({ daysOfWeek: nextDays });
  };

  return (
    <div className="firstRunWindowCard">
      <div className="firstRunWindowCardHeader">
        <div className="firstRunWindowCardTitle">{title}</div>
        <GhostButton onClick={onRemove}>{removeLabel}</GhostButton>
      </div>

      <div className="firstRunWindowFields">
        <div className="firstRunWindowTopRow">
          <FieldGroup label="Repère" className="firstRunCompactField firstRunWindowLabelField">
            <AppInput
              value={safeWindow.label || ""}
              placeholder="Ex. travail"
              onChange={(event) => onPatch({ label: event.target.value })}
            />
          </FieldGroup>
          <FieldGroup label="Début" className="firstRunCompactField">
            <AppInput
              type="time"
              value={safeWindow.startTime || ""}
              onChange={(event) => onPatch({ startTime: event.target.value })}
            />
          </FieldGroup>
          <FieldGroup label="Fin" className="firstRunCompactField">
            <AppInput
              type="time"
              value={safeWindow.endTime || ""}
              onChange={(event) => onPatch({ endTime: event.target.value })}
            />
          </FieldGroup>
        </div>

        <div className="firstRunDayRow">
          {DAY_OPTIONS.map((dayOption, index) => (
            <AppChip
              className="firstRunDayChip"
              key={`${dayOption.value}_${index}`}
              active={selectedDays.includes(dayOption.value)}
              onClick={() => toggleDay(dayOption.value)}
            >
              {dayOption.label}
            </AppChip>
          ))}
        </div>
      </div>
    </div>
  );
}

function WindowActionGroup({
  title,
  description,
  itemLabel = "Fenêtre",
  windows,
  addLabel,
  removeLabel,
  emptyLabel,
  onAdd,
  onPatch,
  onRemove,
}) {
  const safeWindows = Array.isArray(windows) ? windows : [];

  return (
    <div className="firstRunWindowActionGroup">
      <div className="firstRunWindowActionRow">
        <div className="firstRunWindowActionText">
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        <GhostButton size="sm" className="firstRunWindowActionButton" onClick={onAdd}>
          {addLabel}
        </GhostButton>
      </div>
      <div className="firstRunWindowList">
        {safeWindows.length ? (
          safeWindows.map((windowValue, index) => (
            <WindowEditorCard
              key={windowValue.id || `window_${index}`}
              title={`${itemLabel} ${index + 1}`}
              windowValue={windowValue}
              removeLabel={removeLabel}
              onPatch={(patch) => onPatch(windowValue.id, patch)}
              onRemove={() => onRemove(windowValue.id)}
            />
          ))
        ) : (
          <div className="firstRunEmptyHint">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

export default function FirstRunSignalsScreen({
  data,
  draftAnswers,
  canContinue,
  onBack,
  onContinue,
  onPrimaryGoalChange,
  onCapacityChange,
  onTogglePriorityCategory,
  onAddUnavailableWindow,
  onPatchUnavailableWindow,
  onRemoveUnavailableWindow,
  onAddPreferredWindow,
  onPatchPreferredWindow,
  onRemovePreferredWindow,
}) {
  const safeDraftAnswers = draftAnswers && typeof draftAnswers === "object" ? draftAnswers : {};
  const selectedCategoryIds = Array.isArray(safeDraftAnswers.priorityCategoryIds)
    ? safeDraftAnswers.priorityCategoryIds
    : [];

  return (
    <FirstRunCommandSurface
      data={data}
      testId="first-run-screen-signals"
      activeStep="signals"
      eyebrow="Tes signaux"
      title={
        <>
          Quels sont tes <strong>plus grands freins&nbsp;?</strong>
        </>
      }
      subtitle={
        <>
          Sélectionne ce qui te correspond.
          <br />
          On construira ton système autour de ça.
        </>
      }
      footer={
        <>
          <GhostButton onClick={onBack}>Retour</GhostButton>
          <PrimaryButton disabled={!canContinue} onClick={onContinue}>
            Générer les plans
          </PrimaryButton>
        </>
      }
      bodyClassName="firstRunSignalsBody"
      className="firstRunCommandSurface--signals"
    >
      <div className="firstRunSectionStack">
        <SignalBoardSection
          title="Cap principal"
          description="Ce que ton système doit faire avancer en premier."
          className="firstRunSignalSection firstRunSignalSection--goal"
        >
          <AppInput
            className="firstRunPrimaryGoalInput"
            aria-label="Objectif principal"
            data-testid="first-run-primary-goal-input"
            value={safeDraftAnswers.primaryGoal || ""}
            placeholder="Ex. remettre mon projet en mouvement"
            onChange={(event) => onPrimaryGoalChange(event.target.value)}
          />
        </SignalBoardSection>

        <SignalBoardSection
          title="Capacité actuelle"
          description="Choisis une charge réaliste. Le système doit tenir quand la motivation baisse."
          className="firstRunSignalSection firstRunSignalSection--capacity"
        >
          <div className="firstRunCapacitySegmentRow">
            {CAPACITY_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.id}
                className="firstRunChoiceCard firstRunCapacityCard firstRunCapacitySegment"
                title={option.title}
                description={option.description}
                selected={safeDraftAnswers.currentCapacity === option.id}
                onClick={() => onCapacityChange(option.id)}
              />
            ))}
          </div>
        </SignalBoardSection>

        <SignalBoardSection
          title="Zones à reprendre en main"
          description="Choisis jusqu’à 3 domaines. Ils deviennent les premiers axes de ton système."
          className="firstRunSignalSection firstRunSignalSection--categories"
        >
          <div className="firstRunChoiceGrid firstRunCategoryGrid">
            {Object.values(USER_AI_CATEGORY_META).map((categoryMeta) => {
              const selected = selectedCategoryIds.includes(categoryMeta.id);
              const selectionIndex = selectedCategoryIds.indexOf(categoryMeta.id);
              return (
                <ChoiceCard
                  key={categoryMeta.id}
                  className={`firstRunChoiceCard firstRunCategoryCard ${selected ? "is-selected" : "is-idle"}`}
                  title={categoryMeta.label}
                  description={CATEGORY_SIGNAL_DESCRIPTIONS[categoryMeta.id] || ""}
                  selected={selected}
                  disabled={!selected && selectedCategoryIds.length >= 3}
                  badge={selected ? `#${selectionIndex + 1}` : null}
                  onClick={() => onTogglePriorityCategory(categoryMeta.id)}
                />
              );
            })}
          </div>
        </SignalBoardSection>

        <SignalBoardSection
          title="Contraintes & créneaux"
          description="Pose seulement les moments qui changent vraiment ton plan."
          className="firstRunSignalSection firstRunSignalSection--windows"
        >
          <div className="firstRunWindowCommandGrid">
            <WindowActionGroup
              title="Contraintes horaires"
              description="Moments à éviter."
              itemLabel="Indisponibilité"
              windows={safeDraftAnswers.unavailableWindows}
              addLabel="Ajouter une indisponibilité"
              removeLabel="Retirer"
              emptyLabel="Aucune pour l’instant."
              onAdd={onAddUnavailableWindow}
              onPatch={onPatchUnavailableWindow}
              onRemove={onRemoveUnavailableWindow}
            />

            <WindowActionGroup
              title="Créneaux favorables"
              description="Moments naturellement plus accessibles."
              itemLabel="Créneau"
              windows={safeDraftAnswers.preferredWindows}
              addLabel="Ajouter un créneau favorable"
              removeLabel="Retirer"
              emptyLabel="Ajoute-en un si tu en as déjà un en tête."
              onAdd={onAddPreferredWindow}
              onPatch={onPatchPreferredWindow}
              onRemove={onRemovePreferredWindow}
            />
          </div>
        </SignalBoardSection>
      </div>
    </FirstRunCommandSurface>
  );
}
