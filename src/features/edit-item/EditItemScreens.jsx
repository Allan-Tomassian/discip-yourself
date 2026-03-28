import React from "react";
import { GateButton, GateFooter, GateSection } from "../../shared/ui/gate/Gate";
import { GateInput, GateTextarea } from "../../shared/ui/gate/GateForm";
import Select from "../../ui/select/Select";
import DatePicker from "../../ui/date/DatePicker";
import { LABELS } from "../../ui/labels";
import {
  DAY_OPTIONS,
  MEASURE_OPTIONS,
  PRIORITY_OPTIONS,
  QUANTITY_PERIODS,
  REPEAT_OPTIONS,
  getMeasurePlaceholder,
} from "./editItemShared";
import "./editItem.css";

function SectionSurface({ title, description, main = false, children }) {
  const cardClassName = main
    ? "GateMainSection GateMainSectionCard GateSurfacePremium GateCardPremium"
    : "GateSurfacePremium GateCardPremium GateSecondarySectionCard";
  return (
    <GateSection title={title} description={description} collapsible={false} className={cardClassName}>
      <div className="editItemSectionGrid">{children}</div>
    </GateSection>
  );
}

function Field({ label, helper = "", children }) {
  return (
    <div className="editItemField">
      <div className="editItemFieldLabel">{label}</div>
      {children}
      {helper ? <div className="editItemFieldHelper">{helper}</div> : null}
    </div>
  );
}

function InlineCard({ title, text, action = null }) {
  return (
    <div className="GateInlineMetaCard editItemInlineCard">
      <div className="GateRoleCardTitle">{title}</div>
      <div className="editItemInlineCardRow">
        <div className="editItemInlineMeta">{text}</div>
        {action}
      </div>
    </div>
  );
}

function TimeModeField({
  label,
  hasMultipleSlots,
  slotCount,
  timeMode,
  onTimeModeChange,
  timeValue,
  onTimeChange,
}) {
  if (hasMultipleSlots) {
    return (
      <Field
        label={label}
        helper="Ce plan utilise plusieurs créneaux hérités. Ajuste-les depuis la structure de planification si nécessaire."
      >
        <InlineCard
          title="Créneaux existants"
          text={`${slotCount} créneau${slotCount > 1 ? "x" : ""} restent déjà associés à cette action.`}
        />
      </Field>
    );
  }

  return (
    <Field label={label}>
      <div className="editItemTimeModeGroup">
        <Select value={timeMode} onChange={(event) => onTimeModeChange(event.target.value)}>
          <option value="NONE">Dans la journée</option>
          <option value="FIXED">À heure fixe</option>
        </Select>
        {timeMode === "FIXED" ? (
          <GateInput type="time" value={timeValue} onChange={(event) => onTimeChange(event.target.value)} />
        ) : (
          <div className="editItemFieldHelper">Sans heure fixe. L’action garde juste une place dans la journée.</div>
        )}
      </div>
    </Field>
  );
}

function DaysField({ value, onToggle }) {
  return (
    <Field label="Jours" helper="Garde seulement les jours réellement crédibles.">
      <div className="editItemDaysRow">
        {DAY_OPTIONS.map((day) => (
          <button
            key={day.value}
            type="button"
            className={`editItemDayChip${value.includes(day.value) ? " isActive" : ""}`}
            onClick={() => onToggle(day.value)}
          >
            {day.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

function ReminderFields({ controller }) {
  if (!controller.remindersEnabled) return null;
  return (
    <div className="editItemSectionGrid">
      <div className="editItemReminderList">
        {controller.reminderTimes.map((time, index) => (
          <div key={`${time || "reminder"}-${index}`} className="editItemReminderRow">
            <Field label={index === 0 ? "Heure de rappel" : "Heure supplémentaire"}>
              <GateInput
                type="time"
                value={time}
                onChange={(event) => controller.updateReminderTime(index, event.target.value)}
              />
            </Field>
            {controller.reminderTimes.length > 1 ? (
              <GateButton variant="ghost" onClick={() => controller.removeReminderTime(index)}>
                Retirer
              </GateButton>
            ) : null}
          </div>
        ))}
      </div>

      <div className="editItemInlineCardRow">
        <GateButton variant="ghost" onClick={controller.addReminderTime}>
          Ajouter une heure
        </GateButton>
      </div>

      <div className="editItemTwoCol">
        <Field label="Canal">
          <Select value={controller.reminderChannel} onChange={(event) => controller.setReminderChannel(event.target.value)}>
            <option value="IN_APP">Dans l’app</option>
            <option value="NOTIFICATION">Notification</option>
          </Select>
        </Field>
        <div />
      </div>

      <div className="editItemTwoCol">
        <Field label="Fenêtre début" helper="Optionnel. Pour éviter un rappel trop tôt.">
          <GateInput
            type="time"
            value={controller.windowStart}
            onChange={(event) => controller.setWindowStart(event.target.value)}
          />
        </Field>
        <Field label="Fenêtre fin" helper="Optionnel. Pour couper le rappel après un certain moment.">
          <GateInput
            type="time"
            value={controller.windowEnd}
            onChange={(event) => controller.setWindowEnd(event.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function FooterBar({ error, onCancel, onSave }) {
  return (
    <div className="editItemFooterDock">
      <div className="GateMainSection GateMainSectionCard GateSurfacePremium GateCardPremium editItemFooterSurface">
        <div className="editItemFooterStack">
          {error ? <div className="editItemErrorText" role="alert">{error}</div> : null}
          <GateFooter>
            <GateButton variant="ghost" onClick={onCancel}>
              Annuler
            </GateButton>
            <GateButton onClick={onSave}>Enregistrer</GateButton>
          </GateFooter>
        </div>
      </div>
    </div>
  );
}

export function ActionEditScreen({ controller }) {
  const selectedSuggestionCard = controller.selectedSuggestion ? (
    <InlineCard
      title="Catégorie suggérée"
      text="Cette catégorie n’est pas encore active. Active-la avant de l’utiliser durablement."
      action={
        <GateButton variant="ghost" onClick={() => controller.activateSuggestedCategory(controller.selectedSuggestion)}>
          Activer
        </GateButton>
      }
    />
  ) : null;

  return (
    <>
      <SectionSurface
        main
        title="Identité et rattachement"
        description="Titre, catégorie, priorité et lien éventuel."
      >
        <Field label="Titre">
          <GateInput
            value={controller.title}
            onChange={(event) => controller.setTitle(event.target.value)}
            placeholder="Nom de l’action"
          />
        </Field>

        <div className="editItemTwoCol">
          <Field label="Catégorie">
            <Select value={controller.selectedCategoryId} onChange={(event) => controller.setSelectedCategoryId(event.target.value)}>
              {controller.categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                  {cat.suggested ? " (suggestion)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priorité">
            <Select value={controller.priority} onChange={(event) => controller.setPriority(event.target.value)}>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {selectedSuggestionCard}

        <Field
          label={`${LABELS.goal} lié`}
          helper={`Optionnel. Lie cette ${LABELS.actionLower} à un ${LABELS.goalLower} seulement si cela clarifie vraiment sa place.`}
        >
          <Select value={controller.effectiveSelectedOutcomeId} onChange={(event) => controller.setSelectedOutcomeId(event.target.value)}>
            <option value="">{`Sans ${LABELS.goalLower}`}</option>
            {controller.outcomes.map((outcome) => (
              <option key={outcome.id} value={outcome.id}>
                {outcome.title || LABELS.goal}
              </option>
            ))}
          </Select>
        </Field>
      </SectionSurface>

      <SectionSurface
        title="Planification"
        description="Quand l’action existe, comment elle revient et combien de temps elle prend."
      >
        <Field label="Cadence" helper="Choisis le format le plus crédible pour cette action.">
          <Select value={controller.repeat} onChange={(event) => controller.setRepeat(event.target.value)}>
            {REPEAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        {controller.repeat === "none" ? (
          <>
            <div className="editItemTwoCol">
              <Field label="Date">
                <DatePicker value={controller.oneOffDate} onChange={(event) => controller.setOneOffDate(event.target.value)} />
              </Field>
              <TimeModeField
                label="Moment"
                hasMultipleSlots={controller.hasMultipleSlots}
                slotCount={controller.timeSlots.length}
                timeMode={controller.timeMode}
                onTimeModeChange={controller.handleOneOffTimeModeChange}
                timeValue={controller.oneOffTime}
                onTimeChange={controller.setOneOffTime}
              />
            </div>
            <Field label="Durée" helper="Optionnel. Laisse vide si la durée reste libre.">
              <GateInput
                type="number"
                min="1"
                value={controller.sessionMinutes}
                onChange={(event) => controller.setSessionMinutes(event.target.value)}
                placeholder="Minutes"
              />
            </Field>
          </>
        ) : (
          <>
            {controller.repeat === "weekly" ? <DaysField value={controller.daysOfWeek} onToggle={controller.toggleDay} /> : null}

            <div className="editItemTwoCol">
              <TimeModeField
                label="Moment"
                hasMultipleSlots={controller.hasMultipleSlots}
                slotCount={controller.timeSlots.length}
                timeMode={controller.timeMode}
                onTimeModeChange={controller.handleRecurringTimeModeChange}
                timeValue={controller.startTime}
                onTimeChange={controller.setStartTime}
              />
              <Field label="Durée" helper="Optionnel. Laisse vide si la durée reste souple.">
                <GateInput
                  type="number"
                  min="1"
                  value={controller.sessionMinutes}
                  onChange={(event) => controller.setSessionMinutes(event.target.value)}
                  placeholder="Minutes"
                />
              </Field>
            </div>
          </>
        )}

        {controller.showFixedTimeHint ? (
          <div className="editItemErrorText">Choisis une heure pour garder ce cadre à heure fixe.</div>
        ) : null}
      </SectionSurface>

      <SectionSurface
        title="Rappels"
        description="Un signal simple, seulement si cette action possède déjà un cadre planifiable."
      >
        <label className="editItemToggleRow">
          <input
            type="checkbox"
            checked={controller.remindersEnabled}
            onChange={(event) => controller.setRemindersEnabled(event.target.checked)}
            disabled={!controller.canUseReminders}
          />
          <span>Activer les rappels</span>
        </label>

        {!controller.canUseReminders ? (
          <div className="editItemFieldHelper">Ajoute d’abord un cadre horaire ou une occurrence planifiable pour utiliser les rappels.</div>
        ) : null}

        <ReminderFields controller={controller} />
      </SectionSurface>

      <SectionSurface
        title="Quantification"
        description="Optionnel. Utile seulement si cette action gagne à être suivie comme un volume."
      >
        <div className="editItemThreeCol">
          <Field label="Quantité">
            <GateInput
              type="number"
              min="1"
              value={controller.quantityValue}
              onChange={(event) => controller.setQuantityValue(event.target.value)}
              placeholder="Quantité"
            />
          </Field>
          <Field label="Unité">
            <GateInput
              value={controller.quantityUnit}
              onChange={(event) => controller.setQuantityUnit(event.target.value)}
              placeholder="Unité"
            />
          </Field>
          <Field label="Période">
            <Select value={controller.quantityPeriod} onChange={(event) => controller.setQuantityPeriod(event.target.value)}>
              {QUANTITY_PERIODS.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </SectionSurface>

      <SectionSurface
        title="Contexte"
        description="Garde seulement les notes qui aident vraiment à agir ou à reprendre."
      >
        <Field label="Notes">
          <GateTextarea
            value={controller.notes}
            onChange={(event) => controller.setNotes(event.target.value)}
            placeholder="Ajoute un contexte utile, pas un journal technique."
          />
        </Field>
      </SectionSurface>

      <SectionSurface
        title="Zone sensible"
        description="Supprime cette action seulement si sa structure n’a plus lieu d’exister."
      >
        <div className="editItemInlineCardRow">
          <div className="editItemInlineMeta">La suppression retire aussi les occurrences et les rappels associés.</div>
          <GateButton variant="ghost" className="editItemDangerButton" onClick={controller.handleDelete}>
            Supprimer
          </GateButton>
        </div>
      </SectionSurface>

      <FooterBar error={controller.error} onCancel={controller.onBack} onSave={controller.handleSave} />
    </>
  );
}

export function OutcomeEditScreen({ controller }) {
  const selectedSuggestionCard = controller.selectedSuggestion ? (
    <InlineCard
      title="Catégorie suggérée"
      text="Cette catégorie n’est pas encore active. Active-la avant d’y rattacher durablement cet objectif."
      action={
        <GateButton variant="ghost" onClick={() => controller.activateSuggestedCategory(controller.selectedSuggestion)}>
          Activer
        </GateButton>
      }
    />
  ) : null;

  return (
    <>
      <SectionSurface
        main
        title="Identité et catégorie"
        description="Titre, catégorie et niveau de priorité."
      >
        <Field label="Titre">
          <GateInput
            value={controller.title}
            onChange={(event) => controller.setTitle(event.target.value)}
            placeholder={`Nom du ${LABELS.goalLower}`}
          />
        </Field>

        <div className="editItemTwoCol">
          <Field label="Catégorie">
            <Select value={controller.selectedCategoryId} onChange={(event) => controller.setSelectedCategoryId(event.target.value)}>
              {controller.categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                  {cat.suggested ? " (suggestion)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priorité">
            <Select value={controller.priority} onChange={(event) => controller.setPriority(event.target.value)}>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {selectedSuggestionCard}
      </SectionSurface>

      <SectionSurface
        title="Horizon"
        description="Définis une fenêtre crédible pour cet objectif."
      >
        <div className="editItemTwoCol">
          <Field label="Date de début">
            <DatePicker value={controller.startDate} onChange={controller.handleOutcomeStartDateChange} />
          </Field>
          <Field label={`Date cible`} helper={`Min. ${controller.minDeadlineKey || "le lendemain de la date de début"}.`}>
            <DatePicker value={controller.deadline} onChange={controller.handleDeadlineChange} />
          </Field>
        </div>
      </SectionSurface>

      <SectionSurface
        title="Mesure"
        description="Comment lire la progression sans ambiguïté."
      >
        <div className="editItemTwoCol">
          <Field label="Type de mesure">
            <Select value={controller.measureType} onChange={(event) => controller.setMeasureType(event.target.value)}>
              <option value="">Aucune mesure</option>
              {MEASURE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Cible"
            helper={controller.measureType ? "La cible doit rester simple à lire et à mettre à jour." : "Choisis d’abord un type de mesure si tu veux suivre une cible."}
          >
            <GateInput
              type="number"
              min="1"
              value={controller.targetValue}
              onChange={(event) => controller.setTargetValue(event.target.value)}
              placeholder={controller.measureType ? getMeasurePlaceholder(controller.measureType) : "Valeur"}
              disabled={!controller.measureType}
            />
          </Field>
        </div>
      </SectionSurface>

      <SectionSurface
        title="Contexte"
        description="Garde une note utile pour préciser ce que cet objectif doit vraiment produire."
      >
        <Field label="Notes">
          <GateTextarea
            value={controller.notes}
            onChange={(event) => controller.setNotes(event.target.value)}
            placeholder={`Ce qui rend ce ${LABELS.goalLower} utile, concret ou prioritaire.`}
          />
        </Field>
      </SectionSurface>

      <SectionSurface
        title="Zone sensible"
        description={`Supprime ce ${LABELS.goalLower} seulement s’il n’a plus de rôle dans la structure.`}
      >
        <div className="editItemInlineCardRow">
          <div className="editItemInlineMeta">La suppression retire l’objectif et détache les actions qui y sont liées.</div>
          <GateButton variant="ghost" className="editItemDangerButton" onClick={controller.handleDelete}>
            Supprimer
          </GateButton>
        </div>
      </SectionSurface>

      <FooterBar error={controller.error} onCancel={controller.onBack} onSave={controller.handleSave} />
    </>
  );
}
