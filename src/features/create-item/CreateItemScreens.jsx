import React, { useState } from "react";
import { CATEGORY_UI_COPY, LABELS } from "../../ui/labels";
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
  ChoiceCard,
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
} from "../edit-item/editItemShared";
import "./createItem.css";

function resolveSelectedCategoryLabel(controller) {
  const option = Array.isArray(controller?.categoryOptions)
    ? controller.categoryOptions.find((entry) => entry.id === controller.selectedCategoryId)
    : null;
  return option?.name || "Catégorie";
}

function CategoryRoutingCard({ controller, relationLabel = "Cette action sera créée dans cette catégorie." }) {
  const selectedLabel = resolveSelectedCategoryLabel(controller);
  return (
    <AppInlineMetaCard
      title="Catégorie actuelle"
      text={
        controller?.selectedSuggestion
          ? `${selectedLabel} est suggérée. Active-la avant de confirmer si tu veux en faire un chantier durable.`
          : `${selectedLabel}. ${relationLabel}`
      }
    />
  );
}

function SuggestedCategoryCard({ controller, text }) {
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

function CategorySelectField({ controller }) {
  return (
    <FieldGroup label={CATEGORY_UI_COPY.fieldLabel} className="editItemField">
      <AppSelect value={controller.selectedCategoryId} onChange={(event) => controller.setSelectedCategoryId(event.target.value)}>
        {controller.categoryOptions.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
            {cat.suggested ? " (suggestion)" : ""}
          </option>
        ))}
      </AppSelect>

      {!controller.isCreatingCategory ? (
        <div className="editItemInlineCardRow">
          <GhostButton size="sm" onClick={controller.openCategoryCreator}>
            {CATEGORY_UI_COPY.newCategory}
          </GhostButton>
        </div>
      ) : (
        <div className="editItemCategoryCreate">
          <AppInput
            value={controller.newCategoryName}
            onChange={(event) => controller.setNewCategoryName(event.target.value)}
            placeholder={CATEGORY_UI_COPY.newCategoryPlaceholder}
          />
          <div className="editItemCategoryCreateActions">
            <GhostButton size="sm" onClick={controller.cancelCategoryCreator}>
              {CATEGORY_UI_COPY.cancelCreateCategory}
            </GhostButton>
            <PrimaryButton size="sm" onClick={controller.createInlineCategory}>
              {CATEGORY_UI_COPY.createCategory}
            </PrimaryButton>
          </div>
          {controller.categoryCreationError ? (
            <div className="editItemErrorText">{controller.categoryCreationError}</div>
          ) : null}
        </div>
      )}
    </FieldGroup>
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
        helper="Ce plan utilise plusieurs creneaux herites. Ajuste-les depuis la structure de planification si necessaire."
        className="editItemField"
      >
        <AppInlineMetaCard
          title="Creneaux existants"
          text={`${slotCount} creneau${slotCount > 1 ? "x" : ""} restent deja associes a cette action.`}
        />
      </FieldGroup>
    );
  }

  return (
    <FieldGroup label={label} helper={helper} className="editItemField">
      <div className="editItemTimeModeGroup">
        <AppSelect value={timeMode} onChange={(event) => onTimeModeChange(event.target.value)}>
          <option value="NONE">Dans la journee</option>
          <option value="FIXED">A heure fixe</option>
        </AppSelect>
        {timeMode === "FIXED" ? (
          <AppInput type="time" value={timeValue} onChange={(event) => onTimeChange(event.target.value)} />
        ) : (
          <div className="editItemFieldHelper">Sans heure fixe. L&apos;action garde juste une place dans la journee.</div>
        )}
      </div>
    </FieldGroup>
  );
}

function DaysSelectorField({ value, onToggle }) {
  return (
    <FieldGroup label="Jours" helper="Garde seulement les jours reellement credibles." className="editItemField">
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
              label={index === 0 ? "Heure de rappel" : "Heure supplementaire"}
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
            <option value="IN_APP">Dans l&apos;app</option>
            <option value="NOTIFICATION">Notification</option>
          </AppSelect>
        </FieldGroup>
        <div />
      </div>

      <div className="editItemTwoCol">
        <FieldGroup label="Fenetre debut" helper="Optionnel. Pour eviter un rappel trop tot." className="editItemField">
          <AppInput type="time" value={controller.windowStart} onChange={(event) => controller.setWindowStart(event.target.value)} />
        </FieldGroup>
        <FieldGroup label="Fenetre fin" helper="Optionnel. Pour couper le rappel apres un certain moment." className="editItemField">
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

function ReviewSection({ items = [], unresolvedQuestions = [], title = "Review", description = "" }) {
  if (!items.length && !unresolvedQuestions.length) return null;
  return (
    <AppFormSection title={title} description={description}>
      {unresolvedQuestions.length ? (
        <div className="createItemStack createItemStack--compact">
          {unresolvedQuestions.map((question) => (
            <AppInlineMetaCard
              key={question}
              className="createItemQuestionCard"
              title="A confirmer"
              text={question}
            />
          ))}
        </div>
      ) : null}
      {items.length ? (
        <div className="createItemStack">
          {items.map((item) => (
            <AppInlineMetaCard
              key={item.title}
              className="createItemReviewCard"
              title={item.title}
              text={item.text}
            />
          ))}
        </div>
      ) : null}
    </AppFormSection>
  );
}

function ManualDomainCard({ controller, advancedOpen = false, onToggleAdvanced }) {
  const selectedLabel = resolveSelectedCategoryLabel(controller);
  const selectedSuggestion = controller?.selectedSuggestion || null;
  const domainMeta = selectedSuggestion
    ? "Suggestion disponible. Tu peux la garder telle quelle ou la modifier."
    : "Modifiable si tu veux ajuster la structure avant d’enregistrer.";

  return (
    <AppInlineMetaCard
      className="createItemDomainCard"
      title="Domaine"
      text={selectedLabel}
      meta={domainMeta}
      action={(
        <GhostButton size="sm" onClick={() => onToggleAdvanced?.()}>
          {advancedOpen ? "Masquer" : "Modifier"}
        </GhostButton>
      )}
    />
  );
}

function ManualReviewSection({ items = [], title = "Validation simple", description = "" }) {
  const safeItems = Array.isArray(items) ? items.filter((item) => item?.text) : [];
  if (!safeItems.length) return null;
  return (
    <AppFormSection title={title} description={description}>
      <div className="createItemStack createItemStack--compact">
        {safeItems.map((item) => (
          <AppInlineMetaCard
            key={`${item.title}:${item.text}`}
            className="createItemReviewCard"
            title={item.title}
            text={item.text}
          />
        ))}
      </div>
    </AppFormSection>
  );
}

function ActionManualTimingSection({ controller }) {
  const activePreset = controller.timingPreset || "now";
  const recurringCadence = controller.repeat === "weekly" ? "weekly" : "daily";
  const oneOffTimeEnabled = controller.timeMode === "FIXED";
  const recurringTimeEnabled = controller.timeMode === "FIXED";

  return (
    <AppFormSection
      title="Quand ?"
      description="Choisis le cadre le plus simple pour vraiment lancer cette action."
    >
      <div className="createItemChoiceGrid">
        {[
          {
            id: "now",
            title: "Maintenant",
            description: "Un pas simple à faire aujourd’hui, sans lui ajouter de structure inutile.",
          },
          {
            id: "today",
            title: "Aujourd’hui",
            description: "Tu veux la faire aujourd’hui, avec une heure seulement si cela aide.",
          },
          {
            id: "later",
            title: "Plus tard",
            description: "Tu connais déjà le bon jour, sans figer toute la structure.",
          },
          {
            id: "recurring",
            title: "Récurrent",
            description: "Tu veux un rythme léger, quotidien ou hebdomadaire.",
          },
        ].map((option) => (
          <ChoiceCard
            key={option.id}
            title={option.title}
            description={option.description}
            selected={activePreset === option.id}
            className="createItemChoiceCard"
            onClick={() => controller.selectTimingPreset?.(option.id)}
          />
        ))}
      </div>

      {activePreset === "now" ? (
        <AppInlineMetaCard
          className="createItemInlineHint"
          title="Cadre choisi"
          text="Créée pour aujourd’hui, sans heure imposée."
        />
      ) : null}

      {activePreset === "today" ? (
        <div className="createItemStack createItemStack--compact">
          <AppToggleRow
            checked={oneOffTimeEnabled}
            onChange={(event) => controller.handleOneOffTimeModeChange(event.target.checked ? "FIXED" : "NONE")}
            label="Ajouter une heure précise"
            description="Seulement si cela augmente vraiment tes chances de la faire."
          />
          {oneOffTimeEnabled ? (
            <FieldGroup label="Heure" className="editItemField">
              <AppInput
                type="time"
                value={controller.oneOffTime}
                onChange={(event) => controller.setOneOffTime(event.target.value)}
              />
            </FieldGroup>
          ) : null}
        </div>
      ) : null}

      {activePreset === "later" ? (
        <div className="createItemStack createItemStack--compact">
          <FieldGroup label="Jour" className="editItemField">
            <AppDateField value={controller.oneOffDate} onChange={(event) => controller.setOneOffDate(event.target.value)} />
          </FieldGroup>
          <AppToggleRow
            checked={oneOffTimeEnabled}
            onChange={(event) => controller.handleOneOffTimeModeChange(event.target.checked ? "FIXED" : "NONE")}
            label="Ajouter une heure précise"
            description="Optionnel. Garde l’heure vide si tu veux juste réserver le bon jour."
          />
          {oneOffTimeEnabled ? (
            <FieldGroup label="Heure" className="editItemField">
              <AppInput
                type="time"
                value={controller.oneOffTime}
                onChange={(event) => controller.setOneOffTime(event.target.value)}
              />
            </FieldGroup>
          ) : null}
        </div>
      ) : null}

      {activePreset === "recurring" ? (
        <div className="createItemStack createItemStack--compact">
          <FieldGroup label="Rythme" className="editItemField">
            <div className="createItemChipRow">
              <AppChip active={recurringCadence === "daily"} onClick={() => controller.setRecurringCadence?.("daily")}>
                Quotidien
              </AppChip>
              <AppChip active={recurringCadence === "weekly"} onClick={() => controller.setRecurringCadence?.("weekly")}>
                Hebdomadaire
              </AppChip>
            </div>
          </FieldGroup>
          {recurringCadence === "weekly" ? <DaysSelectorField value={controller.daysOfWeek} onToggle={controller.toggleDay} /> : null}
          <AppToggleRow
            checked={recurringTimeEnabled}
            onChange={(event) => controller.handleRecurringTimeModeChange(event.target.checked ? "FIXED" : "NONE")}
            label="Ajouter une heure précise"
            description="Optionnel. Laisse vide si cette action doit rester souple."
          />
          {recurringTimeEnabled ? (
            <FieldGroup label="Heure" className="editItemField">
              <AppInput
                type="time"
                value={controller.startTime}
                onChange={(event) => controller.setStartTime(event.target.value)}
              />
            </FieldGroup>
          ) : null}
        </div>
      ) : null}
    </AppFormSection>
  );
}

function ActionManualAdvancedSection({ controller }) {
  return (
    <div className="createItemAdvancedStack">
      <AppFormSection
        title="Options avancées"
        description="Affiner seulement si cela aide vraiment à mieux créer ou relancer cette action."
      >
        <div className="editItemTwoCol">
          <CategorySelectField controller={controller} />
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

        <FieldGroup
          label={`${LABELS.goal} lié`}
          helper={`Optionnel. Rattache cette ${LABELS.actionLower} à un ${LABELS.goalLower} seulement si cela clarifie sa place.`}
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

        <FieldGroup
          label="Durée"
          helper="Optionnel. Ajoute-la seulement si une durée claire aide vraiment à la faire."
          className="editItemField"
        >
          <AppInput
            type="number"
            min="1"
            value={controller.sessionMinutes}
            onChange={(event) => controller.setSessionMinutes(event.target.value)}
            placeholder="Minutes"
          />
        </FieldGroup>
      </AppFormSection>

      <ActionReminderSection controller={controller} />
      <ActionQuantitySection controller={controller} />
      <ActionContextSection controller={controller} />
    </div>
  );
}

export function ActionManualCreateScreen({
  controller,
  primaryLabel = "Créer l'action",
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <>
      <AppFormSection
        main
        title="Que veux-tu faire avancer ?"
        description="Commence par l’intention. La structure vient seulement après."
      >
        <FieldGroup label="Intention" className="editItemField">
          <AppInput
            value={controller.title}
            onChange={(event) => controller.setTitle(event.target.value)}
            placeholder="Ex. Envoyer la proposition, appeler Paul, finaliser la page"
          />
        </FieldGroup>
        <ManualDomainCard
          controller={controller}
          advancedOpen={advancedOpen}
          onToggleAdvanced={() => setAdvancedOpen((value) => !value)}
        />
      </AppFormSection>

      <ActionManualTimingSection controller={controller} />

      {advancedOpen ? <ActionManualAdvancedSection controller={controller} /> : null}

      <ManualReviewSection
        title="Validation simple"
        description="Vérifie juste le domaine, le cadre et le moment avant d’enregistrer."
        items={controller.reviewCards}
      />

      <FooterActions
        error={controller.error}
        onCancel={controller.onBack}
        onSave={controller.handleSave}
        primaryLabel={primaryLabel}
      />
    </>
  );
}

function OutcomeManualHorizonSection({ controller }) {
  const activePreset = controller.horizonPreset || "";

  return (
    <AppFormSection
      title="Horizon"
      description="Choisis un horizon crédible. Tu pourras l’affiner si besoin."
    >
      <div className="createItemChoiceGrid">
        {[
          { id: "7", title: "7 jours", description: "Un cap court pour lancer le mouvement." },
          { id: "30", title: "30 jours", description: "Un horizon simple pour structurer le mois." },
          { id: "90", title: "90 jours", description: "Un cap plus large sans figer tout le plan." },
          { id: "none", title: "Sans date cible", description: "Tu veux garder un cap clair sans fixer d’échéance." },
        ].map((option) => (
          <ChoiceCard
            key={option.id}
            title={option.title}
            description={option.description}
            selected={activePreset === option.id}
            className="createItemChoiceCard"
            onClick={() => controller.selectHorizonPreset?.(option.id)}
          />
        ))}
      </div>
      {!activePreset ? (
        <AppInlineMetaCard
          className="createItemInlineHint"
          title="Horizon personnalisé"
          text="Tu gardes des dates ajustées manuellement dans les options avancées."
        />
      ) : null}
    </AppFormSection>
  );
}

function OutcomeManualAdvancedSection({ controller }) {
  return (
    <div className="createItemAdvancedStack">
      <AppFormSection
        title="Options avancées"
        description="Affiner seulement si cela aide vraiment à rendre cet objectif plus lisible."
      >
        <div className="editItemTwoCol">
          <CategorySelectField controller={controller} />
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
      </AppFormSection>

      <OutcomeHorizonSection controller={controller} />
      <OutcomeMeasureSection controller={controller} />
    </div>
  );
}

export function OutcomeManualCreateScreen({
  controller,
  primaryLabel = `Créer l'${LABELS.goalLower}`,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <>
      <AppFormSection
        main
        title="Que veux-tu faire avancer ?"
        description={`Commence par le cap à tenir, pas par la structure détaillée du ${LABELS.goalLower}.`}
      >
        <FieldGroup label="Intention" className="editItemField">
          <AppInput
            value={controller.title}
            onChange={(event) => controller.setTitle(event.target.value)}
            placeholder={`Ex. Lancer la nouvelle offre, remettre du calme dans ma semaine`}
          />
        </FieldGroup>
        <ManualDomainCard
          controller={controller}
          advancedOpen={advancedOpen}
          onToggleAdvanced={() => setAdvancedOpen((value) => !value)}
        />
      </AppFormSection>

      <AppFormSection
        title="Pourquoi ?"
        description={`Donne la raison utile qui rend ce ${LABELS.goalLower} prioritaire maintenant.`}
      >
        <FieldGroup label="Pourquoi" className="editItemField">
          <AppTextarea
            value={controller.notes}
            onChange={(event) => controller.setNotes(event.target.value)}
            placeholder={`Ex. Ce cap me donne une direction claire et évite de disperser mon énergie.`}
          />
        </FieldGroup>
      </AppFormSection>

      <OutcomeManualHorizonSection controller={controller} />

      {advancedOpen ? <OutcomeManualAdvancedSection controller={controller} /> : null}

      <ManualReviewSection
        title="Validation simple"
        description={`Vérifie juste le domaine, l’horizon et la formulation avant de créer l’${LABELS.goalLower}.`}
        items={controller.reviewCards}
      />

      <FooterActions
        error={controller.error}
        onCancel={controller.onBack}
        onSave={controller.handleSave}
        primaryLabel={primaryLabel}
      />
    </>
  );
}

function ActionIdentitySection({
  controller,
  title = "Identite et rattachement",
  description = "Titre, categorie stable, priorite et lien eventuel.",
  showOutcomeLink = true,
}) {
  return (
    <AppFormSection main title={title} description={description}>
      <FieldGroup label="Titre" className="editItemField">
        <AppInput
          value={controller.title}
          onChange={(event) => controller.setTitle(event.target.value)}
          placeholder="Nom de l'action"
        />
      </FieldGroup>

      <div className="editItemTwoCol">
        <CategorySelectField controller={controller} />
        <FieldGroup label="Priorite" className="editItemField">
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
        relationLabel="Elle servira aussi de contexte principal dans Objectifs et Planning."
      />

      <SuggestedCategoryCard
        controller={controller}
        text="Cette categorie n'est pas encore active. Active-la pour en faire un chantier durable."
      />

      {showOutcomeLink ? (
        <FieldGroup
          label={`${LABELS.goal} lié`}
          helper={`Optionnel. Rattache cette ${LABELS.actionLower} à un ${LABELS.goalLower} seulement si cela clarifie vraiment sa place.`}
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
      ) : null}
    </AppFormSection>
  );
}

function ActionPlanningSection({
  controller,
  title = "Planning",
  description = "Quand l'action revient et quel rythme elle suit.",
}) {
  return (
    <AppFormSection title={title} description={description}>
      <FieldGroup label="Cadence" helper="Choisis le rythme le plus credible pour cette action." className="editItemField">
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
          <FieldGroup label="Duree" helper="Optionnel. Laisse vide si la duree reste libre." className="editItemField">
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
            <FieldGroup label="Duree" helper="Optionnel. Laisse vide si la duree reste souple." className="editItemField">
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
        <div className="editItemErrorText">Choisis une heure pour garder ce cadre a heure fixe.</div>
      ) : null}
    </AppFormSection>
  );
}

function ActionReminderSection({ controller }) {
  return (
    <AppFormSection
      title="Rappels"
      description="Un rappel leger, seulement si cette action a deja un rythme clair."
    >
      <AppToggleRow
        checked={controller.remindersEnabled}
        onChange={(event) => controller.setRemindersEnabled(event.target.checked)}
        disabled={!controller.canUseReminders}
        label="Activer les rappels"
      />

      {!controller.canUseReminders ? (
        <div className="editItemFieldHelper">Ajoute d&apos;abord un cadre horaire ou une occurrence planifiable pour utiliser les rappels.</div>
      ) : null}

      <ReminderSettingsBlock controller={controller} />
    </AppFormSection>
  );
}

function ActionQuantitySection({ controller }) {
  return (
    <AppFormSection
      title="Quantification"
      description="Optionnel. Utile seulement si cette action se suit mieux comme un volume."
    >
      <div className="editItemThreeCol">
        <FieldGroup label="Quantite" className="editItemField">
          <AppInput
            type="number"
            min="1"
            value={controller.quantityValue}
            onChange={(event) => controller.setQuantityValue(event.target.value)}
            placeholder="Quantite"
          />
        </FieldGroup>
        <FieldGroup label="Unite" className="editItemField">
          <AppInput
            value={controller.quantityUnit}
            onChange={(event) => controller.setQuantityUnit(event.target.value)}
            placeholder="Unite"
          />
        </FieldGroup>
        <FieldGroup label="Periode" className="editItemField">
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
  );
}

function ActionContextSection({ controller }) {
  return (
    <AppFormSection
      title="Contexte"
      description="Garde seulement le contexte qui aide vraiment a agir ou a reprendre."
    >
      <FieldGroup label="Notes" className="editItemField">
        <AppTextarea
          value={controller.notes}
          onChange={(event) => controller.setNotes(event.target.value)}
          placeholder="Ajoute un contexte utile, sans te noyer dans les details."
        />
      </FieldGroup>
    </AppFormSection>
  );
}

export function ActionCreateScreen({
  controller,
  primaryLabel = "Creer l'action",
  unresolvedQuestions = [],
  additionalReviewCards = [],
}) {
  return (
    <>
      <ActionIdentitySection controller={controller} />
      <ActionPlanningSection controller={controller} />
      <ActionReminderSection controller={controller} />
      <ActionQuantitySection controller={controller} />
      <ActionContextSection controller={controller} />
      <ReviewSection
        title="Avant de creer"
        description="Verifie la categorie, l'objectif eventuel et le rythme."
        unresolvedQuestions={unresolvedQuestions}
        items={[...controller.reviewCards, ...additionalReviewCards]}
      />
      <FooterActions
        error={controller.error}
        onCancel={controller.onBack}
        onSave={controller.handleSave}
        primaryLabel={primaryLabel}
      />
    </>
  );
}

function OutcomeIdentitySection({
  controller,
  title = "Identite et categorie",
  description = "Titre, categorie stable et niveau de priorite.",
}) {
  return (
    <AppFormSection main title={title} description={description}>
      <FieldGroup label="Titre" className="editItemField">
        <AppInput
          value={controller.title}
          onChange={(event) => controller.setTitle(event.target.value)}
          placeholder={`Nom du ${LABELS.goalLower}`}
        />
      </FieldGroup>

      <div className="editItemTwoCol">
        <CategorySelectField controller={controller} />
        <FieldGroup label="Priorite" className="editItemField">
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
        relationLabel="Cet objectif deviendra l’ancre principale de cette catégorie."
      />

      <SuggestedCategoryCard
        controller={controller}
        text="Cette categorie n'est pas encore active. Active-la pour y rattacher durablement cet objectif."
      />
    </AppFormSection>
  );
}

function OutcomeHorizonSection({ controller }) {
  return (
    <AppFormSection title="Horizon" description="Donne a cet objectif un horizon credible.">
      <div className="editItemTwoCol">
        <FieldGroup label="Date de debut" className="editItemField">
          <AppDateField value={controller.startDate} onChange={controller.handleOutcomeStartDateChange} />
        </FieldGroup>
        <FieldGroup label="Date cible" helper={`Min. ${controller.minDeadlineKey || "le lendemain de la date de debut"}.`} className="editItemField">
          <AppDateField value={controller.deadline} onChange={controller.handleDeadlineChange} />
        </FieldGroup>
      </div>
    </AppFormSection>
  );
}

function OutcomeMeasureSection({ controller }) {
  return (
    <AppFormSection
      title="Mesure"
      description="Comment lire la progression sans ambiguite."
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
          helper={controller.measureType ? "La cible doit rester simple a lire et a mettre a jour." : "Choisis d'abord un type de mesure si tu veux suivre une cible."}
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
  );
}

function OutcomeContextSection({ controller }) {
  return (
    <AppFormSection
      title="Contexte"
      description="Garde une note utile pour preciser ce cap."
    >
      <FieldGroup label="Notes" className="editItemField">
        <AppTextarea
          value={controller.notes}
          onChange={(event) => controller.setNotes(event.target.value)}
          placeholder={`Ce qui rend ce ${LABELS.goalLower} utile, concret ou prioritaire.`}
        />
      </FieldGroup>
    </AppFormSection>
  );
}

export function OutcomeCreateScreen({
  controller,
  primaryLabel = `Creer l'${LABELS.goalLower}`,
  unresolvedQuestions = [],
  additionalReviewCards = [],
}) {
  return (
    <>
      <OutcomeIdentitySection controller={controller} />
      <OutcomeHorizonSection controller={controller} />
      <OutcomeMeasureSection controller={controller} />
      <OutcomeContextSection controller={controller} />
      <ReviewSection
        title="Avant de creer"
        description="Verifie la categorie, l'objectif et les mesures utiles."
        unresolvedQuestions={unresolvedQuestions}
        items={[...controller.reviewCards, ...additionalReviewCards]}
      />
      <FooterActions
        error={controller.error}
        onCancel={controller.onBack}
        onSave={controller.handleSave}
        primaryLabel={primaryLabel}
      />
    </>
  );
}

export function GuidedCreateScreen({
  outcomeController,
  actionController,
  primaryLabel = "Creer la structure",
  unresolvedQuestions = [],
  additionalReviewCards = [],
  error = "",
  onCancel,
  onSave,
}) {
  return (
    <>
      <OutcomeIdentitySection
        controller={outcomeController}
        title="Objectif et categorie"
        description={`Pose d'abord l'objectif dans une categorie stable, puis rattache une premiere ${LABELS.actionLower} credible.`}
      />
      <OutcomeHorizonSection controller={outcomeController} />
      <OutcomeMeasureSection controller={outcomeController} />
      <ActionIdentitySection
        controller={actionController}
        title="Premiere action"
        description="La premiere action doit deja etre credible, simple a executer et facile a relancer."
        showOutcomeLink={false}
      />
      <ActionPlanningSection
        controller={actionController}
        title="Cadre de la premiere action"
        description="Garde le format le plus simple possible pour demarrer."
      />
      <ActionReminderSection controller={actionController} />
      <ActionContextSection controller={actionController} />
      <ReviewSection
        title="Avant de creer"
        description="Tu vas creer un objectif puis sa premiere action liee."
        unresolvedQuestions={unresolvedQuestions}
        items={[...outcomeController.reviewCards, ...actionController.reviewCards, ...additionalReviewCards]}
      />
      <FooterActions
        error={error}
        onCancel={onCancel}
        onSave={onSave}
        primaryLabel={primaryLabel}
      />
    </>
  );
}

export function AssistantCreateScreen({
  controller,
  outcomeController = null,
  primaryLabel = "Valider la proposition",
  error = "",
  onCancel,
  onSave,
}) {
  if (outcomeController) {
    return (
      <GuidedCreateScreen
        outcomeController={outcomeController}
        actionController={controller}
        primaryLabel={primaryLabel}
        unresolvedQuestions={controller.unresolvedQuestions}
        additionalReviewCards={controller.additionalReviewCards}
        error={error}
        onCancel={onCancel}
        onSave={onSave}
      />
    );
  }

  return (
    <ActionCreateScreen
      controller={{
        ...controller,
        error,
        onBack: onCancel,
        handleSave: onSave,
      }}
      primaryLabel={primaryLabel}
      unresolvedQuestions={controller.unresolvedQuestions}
      additionalReviewCards={controller.additionalReviewCards}
    />
  );
}

export default ActionCreateScreen;
