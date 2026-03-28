import React from "react";
import Select from "../../ui/select/Select";
import DatePicker from "../../ui/date/DatePicker";
import { GateButton } from "../../shared/ui/gate/Gate";
import { GateInput, GateTextarea } from "../../shared/ui/gate/GateForm";
import { LABELS } from "../../ui/labels";
import {
  DAY_OPTIONS,
  MEASURE_OPTIONS,
  PRIORITY_OPTIONS,
  QUANTITY_PERIODS,
  REPEAT_OPTIONS,
  getMeasurePlaceholder,
} from "../edit-item/editItemShared";
import {
  DaysField,
  Field,
  FooterBar,
  InlineCard,
  ReminderFields,
  SectionSurface,
  TimeModeField,
} from "../edit-item/EditItemScreens";
import "./createItem.css";

function SuggestedCategoryCard({ controller, text }) {
  if (!controller.selectedSuggestion) return null;
  return (
    <InlineCard
      title="Catégorie suggérée"
      text={text}
      action={
        <GateButton variant="ghost" onClick={() => controller.activateSuggestedCategory(controller.selectedSuggestion)}>
          Activer
        </GateButton>
      }
    />
  );
}

function ReviewSection({ items = [], unresolvedQuestions = [], title = "Review", description = "" }) {
  if (!items.length && !unresolvedQuestions.length) return null;
  return (
    <SectionSurface title={title} description={description}>
      {unresolvedQuestions.length ? (
        <div className="createItemStack createItemStack--compact">
          {unresolvedQuestions.map((question) => (
            <div key={question} className="GateInlineMetaCard createItemQuestionCard">
              <div className="GateRoleCardTitle">À confirmer</div>
              <div className="GateRoleHelperText">{question}</div>
            </div>
          ))}
        </div>
      ) : null}
      {items.length ? (
        <div className="createItemStack">
          {items.map((item) => (
            <div key={item.title} className="GateInlineMetaCard createItemReviewCard">
              <div className="GateRoleCardTitle">{item.title}</div>
              <div className="GateRoleCardMeta">{item.text}</div>
            </div>
          ))}
        </div>
      ) : null}
    </SectionSurface>
  );
}

function ActionIdentitySection({
  controller,
  title = "Identité et rattachement",
  description = "Titre, catégorie, priorité et lien éventuel.",
  showOutcomeLink = true,
}) {
  return (
    <SectionSurface main title={title} description={description}>
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

      <SuggestedCategoryCard
        controller={controller}
        text="Cette catégorie n’est pas encore active. Active-la avant de l’utiliser durablement."
      />

      {showOutcomeLink ? (
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
      ) : null}
    </SectionSurface>
  );
}

function ActionPlanningSection({ controller, title = "Planification", description = "Quand l’action existe, comment elle revient et combien de temps elle prend." }) {
  return (
    <SectionSurface title={title} description={description}>
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
  );
}

function ActionReminderSection({ controller }) {
  return (
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
  );
}

function ActionQuantitySection({ controller }) {
  return (
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
  );
}

function ActionContextSection({ controller }) {
  return (
    <SectionSurface
      title="Contexte"
      description="Garde seulement les notes qui aident vraiment à agir ou à reprendre."
    >
      <Field label="Notes">
        <GateTextarea
          value={controller.notes}
          onChange={(event) => controller.setNotes(event.target.value)}
          placeholder="Ajoute un contexte utile, sans te noyer dans les détails."
        />
      </Field>
    </SectionSurface>
  );
}

export function ActionCreateScreen({
  controller,
  primaryLabel = "Créer l’action",
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
        title="Review"
        description="Vérifie rapidement ce qui va vraiment être créé."
        unresolvedQuestions={unresolvedQuestions}
        items={[...controller.reviewCards, ...additionalReviewCards]}
      />
      <FooterBar
        error={controller.error}
        onCancel={controller.onBack}
        onSave={controller.handleSave}
        primaryLabel={primaryLabel}
      />
    </>
  );
}

function OutcomeIdentitySection({ controller, title = "Identité et catégorie", description = "Titre, catégorie et niveau de priorité." }) {
  return (
    <SectionSurface main title={title} description={description}>
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

      <SuggestedCategoryCard
        controller={controller}
        text="Cette catégorie n’est pas encore active. Active-la avant d’y rattacher durablement cet objectif."
      />
    </SectionSurface>
  );
}

function OutcomeHorizonSection({ controller }) {
  return (
    <SectionSurface title="Horizon" description="Définis une fenêtre crédible pour cet objectif.">
      <div className="editItemTwoCol">
        <Field label="Date de début">
          <DatePicker value={controller.startDate} onChange={controller.handleOutcomeStartDateChange} />
        </Field>
        <Field label="Date cible" helper={`Min. ${controller.minDeadlineKey || "le lendemain de la date de début"}.`}>
          <DatePicker value={controller.deadline} onChange={controller.handleDeadlineChange} />
        </Field>
      </div>
    </SectionSurface>
  );
}

function OutcomeMeasureSection({ controller }) {
  return (
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
  );
}

function OutcomeContextSection({ controller }) {
  return (
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
  );
}

export function OutcomeCreateScreen({
  controller,
  primaryLabel = `Créer l’${LABELS.goalLower}`,
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
        title="Review"
        description="Vérifie rapidement la structure que tu vas poser."
        unresolvedQuestions={unresolvedQuestions}
        items={[...controller.reviewCards, ...additionalReviewCards]}
      />
      <FooterBar
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
  primaryLabel = "Créer la structure",
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
        title="Direction et catégorie"
        description={`Pose d’abord la direction, puis rattache une première ${LABELS.actionLower} crédible.`}
      />
      <OutcomeHorizonSection controller={outcomeController} />
      <OutcomeMeasureSection controller={outcomeController} />
      <ActionIdentitySection
        controller={actionController}
        title="Première action"
        description="La première action doit déjà être crédible, planifiable et simple à relancer."
        showOutcomeLink={false}
      />
      <ActionPlanningSection
        controller={actionController}
        title="Cadre de la première action"
        description="Garde le format le plus simple possible pour démarrer."
      />
      <ActionReminderSection controller={actionController} />
      <ActionContextSection controller={actionController} />
      <ReviewSection
        title="Review"
        description="Tu vas créer un objectif puis sa première action liée."
        unresolvedQuestions={unresolvedQuestions}
        items={[...outcomeController.reviewCards, ...actionController.reviewCards, ...additionalReviewCards]}
      />
      <FooterBar
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
