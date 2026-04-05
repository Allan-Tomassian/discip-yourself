import React from "react";
import { LABELS } from "../../ui/labels";
import {
  AppChip,
  AppDateField,
  AppFormSection,
  AppInlineMetaCard,
  AppInput,
  AppSelect,
  AppStickyFooter,
  AppTextarea,
  AppToggleRow,
  FieldGroup,
  GhostButton,
  PrimaryButton,
} from "../../shared/ui/app";
import {
  DAY_OPTIONS,
  MEASURE_OPTIONS,
  PRIORITY_OPTIONS,
  QUANTITY_PERIODS,
  REPEAT_OPTIONS,
  getMeasurePlaceholder,
} from "./editItemShared";
import "./editItem.css";

function resolveSelectedCategoryLabel(controller) {
  const option = Array.isArray(controller?.categoryOptions)
    ? controller.categoryOptions.find((entry) => entry.id === controller.selectedCategoryId)
    : null;
  return option?.name || "Catégorie";
}

function CategoryRoutingCard({ controller, relationLabel = "Cette catégorie restera le contexte principal de cet élément." }) {
  const selectedLabel = resolveSelectedCategoryLabel(controller);
  return (
    <AppInlineMetaCard
      title="Catégorie actuelle"
      text={
        controller?.selectedSuggestion
          ? `${selectedLabel} est suggérée. Active-la avant de confirmer si tu veux l’utiliser durablement.`
          : `${selectedLabel}. ${relationLabel}`
      }
    />
  );
}

function SuggestionNotice({ controller, text }) {
  if (!controller.selectedSuggestion) return null;
  return (
    <AppInlineMetaCard
      title="Catégorie suggérée"
      text={text}
      action={(
        <GhostButton size="sm" onClick={() => controller.activateSuggestedCategory(controller.selectedSuggestion)}>
          Utiliser cette catégorie
        </GhostButton>
      )}
    />
  );
}

function ActionTimeModeField({
  label,
  helper = "",
  hasMultipleSlots,
  slotCount,
  timeMode,
  onTimeModeChange,
  timeValue,
  onTimeChange,
}) {
  if (hasMultipleSlots) {
    return (
      <FieldGroup
        label={label}
        helper="Ce plan utilise plusieurs créneaux hérités. Ajuste-les depuis la structure de planification si nécessaire."
        className="editItemField"
      >
        <AppInlineMetaCard
          title="Créneaux existants"
          text={`${slotCount} créneau${slotCount > 1 ? "x" : ""} restent déjà associés à cette action.`}
        />
      </FieldGroup>
    );
  }

  return (
    <FieldGroup label={label} helper={helper} className="editItemField">
      <div className="editItemTimeModeGroup">
        <AppSelect value={timeMode} onChange={(event) => onTimeModeChange(event.target.value)}>
          <option value="NONE">Dans la journée</option>
          <option value="FIXED">À heure fixe</option>
        </AppSelect>
        {timeMode === "FIXED" ? (
          <AppInput type="time" value={timeValue} onChange={(event) => onTimeChange(event.target.value)} />
        ) : (
          <div className="editItemFieldHelper">Sans heure fixe. L’action garde juste une place dans la journée.</div>
        )}
      </div>
    </FieldGroup>
  );
}

function DaysSelectorField({ value, onToggle }) {
  return (
    <FieldGroup label="Jours" helper="Garde seulement les jours réellement crédibles." className="editItemField">
      <div className="editItemDaysRow">
        {DAY_OPTIONS.map((day) => (
          <AppChip
            key={day.value}
            active={value.includes(day.value)}
            onClick={() => onToggle(day.value)}
            aria-pressed={value.includes(day.value)}
          >
            {day.label}
          </AppChip>
        ))}
      </div>
    </FieldGroup>
  );
}

function ReminderSettingsBlock({ controller }) {
  if (!controller.remindersEnabled) return null;
  return (
    <div className="appFormSectionBody">
      <div className="editItemReminderList">
        {controller.reminderTimes.map((time, index) => (
          <div key={`${time || "reminder"}-${index}`} className="editItemReminderRow">
            <FieldGroup
              label={index === 0 ? "Heure de rappel" : "Heure supplémentaire"}
              className="editItemField"
            >
              <AppInput
                type="time"
                value={time}
                onChange={(event) => controller.updateReminderTime(index, event.target.value)}
              />
            </FieldGroup>
            {controller.reminderTimes.length > 1 ? (
              <GhostButton size="sm" onClick={() => controller.removeReminderTime(index)}>
                Retirer
              </GhostButton>
            ) : null}
          </div>
        ))}
      </div>

      <div className="editItemInlineCardRow">
        <GhostButton size="sm" onClick={controller.addReminderTime}>
          Ajouter une heure
        </GhostButton>
      </div>

      <div className="editItemTwoCol">
        <FieldGroup label="Canal" className="editItemField">
          <AppSelect value={controller.reminderChannel} onChange={(event) => controller.setReminderChannel(event.target.value)}>
            <option value="IN_APP">Dans l’app</option>
            <option value="NOTIFICATION">Notification</option>
          </AppSelect>
        </FieldGroup>
        <div />
      </div>

      <div className="editItemTwoCol">
        <FieldGroup label="Fenêtre début" helper="Optionnel. Pour éviter un rappel trop tôt." className="editItemField">
          <AppInput type="time" value={controller.windowStart} onChange={(event) => controller.setWindowStart(event.target.value)} />
        </FieldGroup>
        <FieldGroup label="Fenêtre fin" helper="Optionnel. Pour couper le rappel après un certain moment." className="editItemField">
          <AppInput type="time" value={controller.windowEnd} onChange={(event) => controller.setWindowEnd(event.target.value)} />
        </FieldGroup>
      </div>
    </div>
  );
}

function FooterActions({ error, onCancel, onSave, primaryLabel = "Enregistrer", secondaryLabel = "Annuler" }) {
  return (
    <AppStickyFooter error={error}>
      <GhostButton onClick={onCancel}>{secondaryLabel}</GhostButton>
      <PrimaryButton onClick={onSave}>{primaryLabel}</PrimaryButton>
    </AppStickyFooter>
  );
}

export function ActionEditScreen({ controller }) {
  return (
    <>
      <AppFormSection
        main
        title="Identité et rattachement"
        description="Titre, catégorie, priorité et lien éventuel."
      >
        <FieldGroup label="Titre" className="editItemField">
          <AppInput
            value={controller.title}
            onChange={(event) => controller.setTitle(event.target.value)}
            placeholder="Nom de l’action"
          />
        </FieldGroup>

        <div className="editItemTwoCol">
          <FieldGroup label="Catégorie" className="editItemField">
            <AppSelect value={controller.selectedCategoryId} onChange={(event) => controller.setSelectedCategoryId(event.target.value)}>
              {controller.categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                  {cat.suggested ? " (suggestion)" : ""}
                </option>
              ))}
            </AppSelect>
          </FieldGroup>
          <FieldGroup label="Priorité" className="editItemField">
            <AppSelect value={controller.priority} onChange={(event) => controller.setPriority(event.target.value)}>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
          </FieldGroup>
        </div>

        <CategoryRoutingCard
          controller={controller}
          relationLabel="Elle guidera aussi le contexte visible dans Objectifs, Planning et Aujourd’hui."
        />

        <SuggestionNotice
          controller={controller}
          text="Cette catégorie n’est pas encore active. Active-la avant de l’utiliser durablement."
        />

        <FieldGroup
          label={`${LABELS.goal} lié`}
          helper={`Optionnel. Lie cette ${LABELS.actionLower} à un ${LABELS.goalLower} seulement si cela clarifie vraiment sa place.`}
          className="editItemField"
        >
          <AppSelect value={controller.effectiveSelectedOutcomeId} onChange={(event) => controller.setSelectedOutcomeId(event.target.value)}>
            <option value="">{`Sans ${LABELS.goalLower}`}</option>
            {controller.outcomes.map((outcome) => (
              <option key={outcome.id} value={outcome.id}>
                {outcome.title || LABELS.goal}
              </option>
            ))}
          </AppSelect>
        </FieldGroup>
      </AppFormSection>

      <AppFormSection
        title="Planning"
        description="Quand l’action existe, comment elle revient et combien de temps elle prend."
      >
        <FieldGroup label="Cadence" helper="Choisis le format le plus crédible pour cette action." className="editItemField">
          <AppSelect value={controller.repeat} onChange={(event) => controller.setRepeat(event.target.value)}>
            {REPEAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
        </FieldGroup>

        {controller.repeat === "none" ? (
          <>
            <div className="editItemTwoCol">
              <FieldGroup label="Date" className="editItemField">
                <AppDateField value={controller.oneOffDate} onChange={(event) => controller.setOneOffDate(event.target.value)} />
              </FieldGroup>
              <ActionTimeModeField
                label="Moment"
                hasMultipleSlots={controller.hasMultipleSlots}
                slotCount={controller.timeSlots.length}
                timeMode={controller.timeMode}
                onTimeModeChange={controller.handleOneOffTimeModeChange}
                timeValue={controller.oneOffTime}
                onTimeChange={controller.setOneOffTime}
              />
            </div>
            <FieldGroup label="Durée" helper="Optionnel. Laisse vide si la durée reste libre." className="editItemField">
              <AppInput
                type="number"
                min="1"
                value={controller.sessionMinutes}
                onChange={(event) => controller.setSessionMinutes(event.target.value)}
                placeholder="Minutes"
              />
            </FieldGroup>
          </>
        ) : (
          <>
            {controller.repeat === "weekly" ? <DaysSelectorField value={controller.daysOfWeek} onToggle={controller.toggleDay} /> : null}

            <div className="editItemTwoCol">
              <ActionTimeModeField
                label="Moment"
                hasMultipleSlots={controller.hasMultipleSlots}
                slotCount={controller.timeSlots.length}
                timeMode={controller.timeMode}
                onTimeModeChange={controller.handleRecurringTimeModeChange}
                timeValue={controller.startTime}
                onTimeChange={controller.setStartTime}
              />
              <FieldGroup label="Durée" helper="Optionnel. Laisse vide si la durée reste souple." className="editItemField">
                <AppInput
                  type="number"
                  min="1"
                  value={controller.sessionMinutes}
                  onChange={(event) => controller.setSessionMinutes(event.target.value)}
                  placeholder="Minutes"
                />
              </FieldGroup>
            </div>
          </>
        )}

        {controller.showFixedTimeHint ? (
          <div className="editItemErrorText">Choisis une heure pour garder ce cadre à heure fixe.</div>
        ) : null}
      </AppFormSection>

      <AppFormSection
        title="Rappels"
        description="Un signal simple, seulement si cette action possède déjà un cadre planifiable."
      >
        <AppToggleRow
          checked={controller.remindersEnabled}
          onChange={(event) => controller.setRemindersEnabled(event.target.checked)}
          disabled={!controller.canUseReminders}
          label="Activer les rappels"
        />

        {!controller.canUseReminders ? (
          <div className="editItemFieldHelper">Ajoute d’abord un cadre horaire ou une occurrence planifiable pour utiliser les rappels.</div>
        ) : null}

        <ReminderSettingsBlock controller={controller} />
      </AppFormSection>

      <AppFormSection
        title="Quantification"
        description="Optionnel. Utile seulement si cette action gagne à être suivie comme un volume."
      >
        <div className="editItemThreeCol">
          <FieldGroup label="Quantité" className="editItemField">
            <AppInput
              type="number"
              min="1"
              value={controller.quantityValue}
              onChange={(event) => controller.setQuantityValue(event.target.value)}
              placeholder="Quantité"
            />
          </FieldGroup>
          <FieldGroup label="Unité" className="editItemField">
            <AppInput
              value={controller.quantityUnit}
              onChange={(event) => controller.setQuantityUnit(event.target.value)}
              placeholder="Unité"
            />
          </FieldGroup>
          <FieldGroup label="Période" className="editItemField">
            <AppSelect value={controller.quantityPeriod} onChange={(event) => controller.setQuantityPeriod(event.target.value)}>
              {QUANTITY_PERIODS.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.label}
                </option>
              ))}
            </AppSelect>
          </FieldGroup>
        </div>
      </AppFormSection>

      <AppFormSection
        title="Contexte"
        description="Garde seulement les notes qui aident vraiment à agir ou à reprendre."
      >
        <FieldGroup label="Notes" className="editItemField">
          <AppTextarea
            value={controller.notes}
            onChange={(event) => controller.setNotes(event.target.value)}
            placeholder="Ajoute un contexte utile, pas un journal technique."
          />
        </FieldGroup>
      </AppFormSection>

      <AppFormSection
        title="Zone sensible"
        description="Supprime cette action seulement si sa structure n’a plus lieu d’exister."
      >
        <AppInlineMetaCard
          text="La suppression retire aussi les occurrences et les rappels associés."
          action={(
            <GhostButton className="editItemDangerButton" onClick={controller.handleDelete}>
              Supprimer
            </GhostButton>
          )}
        />
      </AppFormSection>

      <FooterActions error={controller.error} onCancel={controller.onBack} onSave={controller.handleSave} />
    </>
  );
}

export function OutcomeEditScreen({ controller }) {
  return (
    <>
      <AppFormSection
        main
        title="Identité et catégorie"
        description="Titre, catégorie et niveau de priorité."
      >
        <FieldGroup label="Titre" className="editItemField">
          <AppInput
            value={controller.title}
            onChange={(event) => controller.setTitle(event.target.value)}
            placeholder={`Nom du ${LABELS.goalLower}`}
          />
        </FieldGroup>

        <div className="editItemTwoCol">
          <FieldGroup label="Catégorie" className="editItemField">
            <AppSelect value={controller.selectedCategoryId} onChange={(event) => controller.setSelectedCategoryId(event.target.value)}>
              {controller.categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                  {cat.suggested ? " (suggestion)" : ""}
                </option>
              ))}
            </AppSelect>
          </FieldGroup>
          <FieldGroup label="Priorité" className="editItemField">
            <AppSelect value={controller.priority} onChange={(event) => controller.setPriority(event.target.value)}>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
          </FieldGroup>
        </div>

        <CategoryRoutingCard
          controller={controller}
          relationLabel="Cet objectif reste rattaché à cette catégorie pour toute sa progression."
        />

        <SuggestionNotice
          controller={controller}
          text="Cette catégorie n’est pas encore active. Active-la avant d’y rattacher durablement cet objectif."
        />
      </AppFormSection>

      <AppFormSection
        title="Horizon"
        description="Définis une fenêtre crédible pour cet objectif."
      >
        <div className="editItemTwoCol">
          <FieldGroup label="Date de début" className="editItemField">
            <AppDateField value={controller.startDate} onChange={controller.handleOutcomeStartDateChange} />
          </FieldGroup>
          <FieldGroup label="Date cible" helper={`Min. ${controller.minDeadlineKey || "le lendemain de la date de début"}.`} className="editItemField">
            <AppDateField value={controller.deadline} onChange={controller.handleDeadlineChange} />
          </FieldGroup>
        </div>
      </AppFormSection>

      <AppFormSection
        title="Mesure"
        description="Comment lire la progression sans ambiguïté."
      >
        <div className="editItemTwoCol">
          <FieldGroup label="Type de mesure" className="editItemField">
            <AppSelect value={controller.measureType} onChange={(event) => controller.setMeasureType(event.target.value)}>
              <option value="">Aucune mesure</option>
              {MEASURE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
          </FieldGroup>
          <FieldGroup
            label="Cible"
            helper={controller.measureType ? "La cible doit rester simple à lire et à mettre à jour." : "Choisis d’abord un type de mesure si tu veux suivre une cible."}
            className="editItemField"
          >
            <AppInput
              type="number"
              min="1"
              value={controller.targetValue}
              onChange={(event) => controller.setTargetValue(event.target.value)}
              placeholder={controller.measureType ? getMeasurePlaceholder(controller.measureType) : "Valeur"}
              disabled={!controller.measureType}
            />
          </FieldGroup>
        </div>
      </AppFormSection>

      <AppFormSection
        title="Contexte"
        description="Garde une note utile pour préciser ce que cet objectif doit vraiment produire."
      >
        <FieldGroup label="Notes" className="editItemField">
          <AppTextarea
            value={controller.notes}
            onChange={(event) => controller.setNotes(event.target.value)}
            placeholder={`Ce qui rend ce ${LABELS.goalLower} utile, concret ou prioritaire.`}
          />
        </FieldGroup>
      </AppFormSection>

      <AppFormSection
        title="Zone sensible"
        description={`Supprime ce ${LABELS.goalLower} seulement s’il n’a plus de rôle dans la structure.`}
      >
        <AppInlineMetaCard
          text="La suppression retire l’objectif et détache les actions qui y sont liées."
          action={(
            <GhostButton className="editItemDangerButton" onClick={controller.handleDelete}>
              Supprimer
            </GhostButton>
          )}
        />
      </AppFormSection>

      <FooterActions error={controller.error} onCancel={controller.onBack} onSave={controller.handleSave} />
    </>
  );
}
