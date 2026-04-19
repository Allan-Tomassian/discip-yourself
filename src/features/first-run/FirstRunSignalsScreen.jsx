import React from "react";
import {
  AppChip,
  AppFormSection,
  AppInput,
  ChoiceCard,
  FieldGroup,
  GhostButton,
  PrimaryButton,
} from "../../shared/ui/app";
import { USER_AI_CATEGORY_META } from "../../domain/userAiProfile";
import FirstRunStepScreen from "./FirstRunStepScreen";

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
    description: "Peu de charge, priorité à la tenue dans la durée.",
  },
  {
    id: "stable",
    title: "Stable",
    description: "Un cadre sérieux mais encore respirable.",
  },
  {
    id: "forte",
    title: "Forte",
    description: "Plus de densité et moins de marge sur la semaine.",
  },
];

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
        <FieldGroup label="Label" className="firstRunCompactField">
          <AppInput
            value={safeWindow.label || ""}
            placeholder="Ex: Travail, sport, deep work"
            onChange={(event) => onPatch({ label: event.target.value })}
          />
        </FieldGroup>

        <div className="firstRunWindowTimeRow">
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

function WindowSection({
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
    <AppFormSection
      title={title}
      description={description}
      className="firstRunFormSection"
      bodyClassName="firstRunFormSectionBody"
    >
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
      <GhostButton className="firstRunSectionAction" onClick={onAdd}>
        {addLabel}
      </GhostButton>
    </AppFormSection>
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
    <FirstRunStepScreen
      data={data}
      testId="first-run-screen-signals"
      title="Quelques signaux essentiels"
      subtitle="On capture juste assez d'information pour préparer deux plans cohérents."
      badge="3/7"
      footer={
        <>
          <GhostButton onClick={onBack}>Retour</GhostButton>
          <PrimaryButton disabled={!canContinue} onClick={onContinue}>
            Générer les plans
          </PrimaryButton>
        </>
      }
      bodyClassName="firstRunSignalsBody"
    >
      <div className="firstRunSectionStack">
        <p className="firstRunSignalsLead">
          On garde l&apos;élan. Ces quelques signaux suffisent pour cadrer la première proposition sans te faire passer par un setup lourd.
        </p>

        <AppFormSection
          title="Objectif immédiat"
          description="Ce que tu veux faire avancer en premier dans les 2 à 6 prochaines semaines."
          className="firstRunFormSection"
          bodyClassName="firstRunFormSectionBody"
        >
          <FieldGroup label="Objectif principal" className="firstRunField">
            <AppInput
              data-testid="first-run-primary-goal-input"
              value={safeDraftAnswers.primaryGoal || ""}
              placeholder="Ex: remettre mon projet en mouvement"
              onChange={(event) => onPrimaryGoalChange(event.target.value)}
            />
          </FieldGroup>
        </AppFormSection>

        <AppFormSection
          title="Capacité actuelle"
          description="Ce niveau borne le plan proposé. Il ne t'engage pas pour la suite."
          className="firstRunFormSection"
          bodyClassName="firstRunFormSectionBody"
        >
          <div className="firstRunChoiceGrid">
            {CAPACITY_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.id}
                className="firstRunChoiceCard"
                title={option.title}
                description={option.description}
                selected={safeDraftAnswers.currentCapacity === option.id}
                onClick={() => onCapacityChange(option.id)}
              />
            ))}
          </div>
        </AppFormSection>

        <AppFormSection
          title="Catégories prioritaires"
          description="Choisis jusqu'à trois domaines. Ils nourriront les deux premières propositions."
          className="firstRunFormSection"
          bodyClassName="firstRunFormSectionBody"
        >
          <div className="firstRunChoiceGrid">
            {Object.values(USER_AI_CATEGORY_META).map((categoryMeta) => {
              const selected = selectedCategoryIds.includes(categoryMeta.id);
              const selectionIndex = selectedCategoryIds.indexOf(categoryMeta.id);
              return (
                <ChoiceCard
                  key={categoryMeta.id}
                  className="firstRunChoiceCard"
                  title={categoryMeta.label}
                  description="Utilisé pour structurer la semaine proposée."
                  selected={selected}
                  disabled={!selected && selectedCategoryIds.length >= 3}
                  badge={selected ? `#${selectionIndex + 1}` : null}
                  onClick={() => onTogglePriorityCategory(categoryMeta.id)}
                />
              );
            })}
          </div>
        </AppFormSection>

        <WindowSection
          title="Indisponibilités"
          description="Les contraintes fixes ou les fenêtres à éviter."
          itemLabel="Indisponibilité"
          windows={safeDraftAnswers.unavailableWindows}
          addLabel="Ajouter une indisponibilité"
          removeLabel="Retirer"
          emptyLabel="Aucune indisponibilité ajoutée pour le moment."
          onAdd={onAddUnavailableWindow}
          onPatch={onPatchUnavailableWindow}
          onRemove={onRemoveUnavailableWindow}
        />

        <WindowSection
          title="Créneaux favorables"
          description="Les moments où tu exécutes le mieux, sans en faire des obligations dures."
          itemLabel="Créneau"
          windows={safeDraftAnswers.preferredWindows}
          addLabel="Ajouter un créneau favorable"
          removeLabel="Retirer"
          emptyLabel="Ajoute un créneau si tu as déjà un moment favorable clair."
          onAdd={onAddPreferredWindow}
          onPatch={onPatchPreferredWindow}
          onRemove={onRemovePreferredWindow}
        />
      </div>
    </FirstRunStepScreen>
  );
}
