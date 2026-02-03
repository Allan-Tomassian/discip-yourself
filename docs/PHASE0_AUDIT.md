# PHASE0_AUDIT

## 1) État global (source de vérité)

**Définition + init**
- `src/logic/state.js`
  - `initialData()` : construit l'état global par défaut.
  - `demoData()` : data de démo.
  - `migrate(prev)` : normalise/assainit les structures, apply migrations legacy.
  - `usePersistedState(React)` : hydrate via `loadState()` et persiste via `saveState()`.

**Top‑level keys (schéma actuel)**
- `profile` : `{ name, lastName, whyText, whyImage, whyUpdatedAt, plan, xp, level, rewardClaims, entitlements? }`
- `ui` : voir section dédiée (inclut `activeSession`, `selectedDate`, thèmes, drafts, etc.)
- `categories` : liste de catégories
- `goals` : liste d’objectifs/actions (legacy + normalisés)
- `habits` : legacy (fusionné dans `goals` via migration)
- `reminders` : rappels
- `sessions` : array (nettoyé/vidé par `migrate` en fin de pipeline)
- `occurrences` : occurrences planifiées
- `checks` : objets legacy (reset à `{}` en fin de migration)
- `microChecks` : micro‑actions par date

**UI (champs critiques)**
Extraits clés (voir `initialData()`):
- `ui.blocksSchemaVersion`, `ui.blocksByPage`, `ui.blocks` (ordre blocs Home)
- `ui.selectedCategoryId` (legacy), `ui.selectedCategoryByView` (home/library/plan/pilotage)
- `ui.pageThemes`, `ui.pageAccents`, `ui.pageThemeHome`, `ui.accentHome`
- `ui.activeGoalId`, `ui.mainGoalId`, `ui.selectedGoalByCategory`
- `ui.onboardingCompleted`, `ui.onboardingSeenVersion`, `ui.onboardingStep`
- `ui.tourSeenVersion`, `ui.tourStepIndex`, `ui.tourForceStart`
- `ui.permissions` (notifications/calendar/health)
- `ui.creationFlowVersion`, `ui.createDraft`
- `ui.showPlanStep`, `ui.soundEnabled`
- `ui.selectedDate`, `ui.selectedHabits`
- `ui.sessionDraft`, `ui.activeSession`

Référence : `src/logic/state.js:1008+`

---

## 2) Hydratation / persistance (localStorage + format)

**Persistance globale**
- `src/utils/storage.js`
  - `LS_KEY = "discip_yourself_v2"` : clé principale (JSON complet de l’état).
  - `LS_KEY__bak` : backup automatique de l’état précédent.
  - `LS_KEY__meta` : méta (lastSavedAt, lastBytes, lastError, etc.).
  - Format : JSON sérialisé de l’état global (`initialData()`/`migrate()`), via `saveState(state)`.
- Hydratation : `loadState()` dans `usePersistedState()` (`src/logic/state.js:1638+`).

**Bootstrap thème avant render**
- `src/main.jsx` lit `LS_KEY` pour appliquer le thème/accents avant le premier paint.
- Fallback legacy theme keys (localStorage) :
  - `discip_theme`, `discipTheme`, `themeId`, `theme`, `appTheme`, `selectedTheme`, `dy_theme`.

**Autres clés localStorage (Home)**
- `todayBlocksOrder` : legacy order des blocs (supprimé après migration).
- Notes quotidiennes:
  - `dailyNote:<categoryId>:<YYYY-MM-DD>` (ou `dailyNote:<YYYY-MM-DD>` sans catégorie)
  - `dailyNoteMeta:<categoryId>:<YYYY-MM-DD>` (ou `dailyNoteMeta:<YYYY-MM-DD>`)
  - `dailyNoteHistory:<categoryId>` (ou `dailyNoteHistory`)
  - Format history: array d’objets `{ dateKey, note, meta, savedAt }`.

**sessionStorage**
- `library:selectedCategoryTouched` : marqueur pour la sélection de catégorie dans Bibliothèque (`App.jsx`, `Categories.jsx`).

Références : `src/utils/storage.js`, `src/main.jsx`, `src/pages/Home.jsx`, `src/App.jsx`, `src/pages/Categories.jsx`.

---

## 3) Session actuelle (ui.activeSession)

**Où**
- Définie dans l’état global `ui.activeSession` (`src/logic/state.js:initialData`).
- Utilisée dans :
  - `src/pages/Home.jsx` (GO + badge session)
  - `src/pages/Session.jsx` (écran session)
  - `src/App.jsx` (rappels in‑app)

**Champs observés dans le code**
- `id` (string)
- `occurrenceId` (string, si disponible)
- `dateKey` (YYYY‑MM‑DD)
- `objectiveId` (id goal OUTCOME)
- `habitIds` (array goal PROCESS)
- `status` (valeurs: `partial`, `done`, `skipped`)
- `timerStartedAt`, `timerAccumulatedSec`, `timerRunning`
- `startedAt` (optionnel)
- `doneHabitIds` (array)
- `durationSec` (optionnel)
- `finishedAt` (optionnel)

Références : `src/pages/Home.jsx:1268+`, `src/pages/Session.jsx`, `src/App.jsx:1498+`.

---

## 4) Occurrences actuelles (fichiers, fonctions, champs, statuts)

**Sources principales**
- `src/logic/occurrences.js` (CRUD + statuts)
- `src/logic/occurrencePlanner.js` (génération / fenêtre glissante)

**Statuts d’occurrence**
- `STATUS_VALUES` dans `occurrences.js` : `planned`, `done`, `skipped`, `canceled`.
- `STATUS_RANK` dans `occurrencePlanner.js` : `done`, `planned`, `skipped` (priorité pour classement).

**Champs occurrence (observés)**
- `id`, `goalId`, `date` (YYYY‑MM‑DD)
- `start` (HH:mm), `slotKey` (HH:mm)
- `durationMinutes`
- `status` (`planned|done|skipped|canceled`)
- `end` (optionnel)
- `noTime` (optionnel)
- `conflict` (optionnel)
- `doneAt` (timestamp ISO, si status=done)
- `pointsAwarded` (number, si status=done)

**Fonctions clés (source of truth)**
- `ensureWindowForGoal(data, goalId, fromDateKey, days)`
- `ensureWindowForGoals(data, goalIds, fromDateKey, days)`
- `regenerateWindowForGoal(data, goalId, fromDateKey, days)`
- `findOccurrenceForGoalDateDeterministic(occurrences, goalId, dateKey, preferredStart)`
- `setOccurrenceStatus(goalId, dateKey, start, status, {occurrences, goals})`
- `upsertOccurrence(goalId, dateKey, start, durationMinutes, patch, {occurrences, goals})`
- `updateOccurrence(id, patch, {occurrences, goals})`

Références : `src/logic/occurrences.js`, `src/logic/occurrencePlanner.js`.

---

## 5) Routes / navigation vers `/session`

**Routing principal**
- `src/App.jsx` gère `tab` et construit l’URL.
- `/session` peut inclure query params :
  - `cat` (categoryId)
  - `date` (YYYY‑MM‑DD)

**Entrées**
- `Home` appelle `onOpenSession({ categoryId, dateKey })` → `setTab("session", { sessionCategoryId, sessionDateKey })`.
- `Session` lit `?date=...` depuis `window.location.search` (fallbacks sur `ui.selectedDate*`).

Références : `src/App.jsx:177-240`, `src/pages/Home.jsx:1335+`, `src/pages/Session.jsx:96+`.

---

## 6) useEffect qui font `setData` (risque loop)

### Home (`src/pages/Home.jsx`)
- **Hydration legacy blocks**
  - `useEffect` (l.342+) : appelle `setData` pour `ui.blocksByPage.home` + supprime `todayBlocksOrder`.
  - Dépendances: `[legacyOrder, safeData?.ui?.blocksByPage?.home, setData]`.
- **Generation fenêtre occurrences**
  - `useEffect` (l.1100+) : `setData` avec `ensureWindowForGoals(...)`.
  - Dépendances: `[ensureProcessIds, selectedDateKey, setData]`.

### Session (`src/pages/Session.jsx`)
- **Attach occurrenceId à la session**
  - `useEffect` (l.208+) : `setData` pour compléter `ui.activeSession.occurrenceId`.
  - Dépendances: `[occurrenceId, selectedOccurrence?.id, session?.id, setData]`.
- **Auto‑end timer (à 0)**
  - `useEffect` (l.225+) : `setData` (occurrence + activeSession).
  - Dépendances: `[isRunning, remainingSec, session?.id, occurrenceId, resolvedDateKey, isEditable]`.

### App (`src/App.jsx`)
- **Init migrate + normalize**
  - `useEffect` (l.351+) : `setData(prev => normalizePriorities(migrate(prev)))`.
  - Dépendances: `[]`.
- **Auto‑activate scheduled goals**
  - `useEffect` (l.361+) : interval → `setData(prev => autoActivateScheduledGoals(prev, new Date()))`.
  - Dépendances: `[setData]`.
- **Close Library detail**
  - `useEffect` (l.660+) : `setData` pour `ui.libraryDetailExpandedId=null`.
  - Dépendances: `[tab, setData]`.
- **Normalize createDraft**
  - `useEffect` (l.669+) : `setData` pour `ui.createDraft`.
  - Dépendances: `[isCreateTab, setData, tab]`.
- **Tab change side‑effects**
  - `useEffect` (l.698+) : `setData` pour `ui.selectedDate` et `ui.selectedCategoryByView`.
  - Dépendances: `[tab, categories, homeActiveCategoryId, safeData?.ui?.selectedCategoryByView?.library, safeData?.ui?.librarySelectedCategoryId, setData]`.
- **Theme reconciliation**
  - `useEffect` (l.781+) : `setData` (promote legacy theme or sync pageThemes.__default).
  - Dépendances: `[safeData?.ui, setData]`.
- **Category rail order**
  - `useEffect` (l.827+) : `setData` pour `ui.categoryRailOrder`.
  - Dépendances: `[categoryIdsKey, categoryRailOrder, safeData?.ui?.categoryRailOrder, setData]`.

---

## 7) Statuts actuels (valeurs exactes observées)

**Session**
- `partial` (en cours)
- `done` (terminée)
- `skipped` (annulée)

**Occurrence**
- `planned`
- `done`
- `skipped`
- `canceled`

Références : `src/pages/Session.jsx`, `src/logic/occurrences.js`, `src/logic/occurrencePlanner.js`.

---

## 8) Points à risques (boucles / non‑idempotence)

- **`useEffect` + `setData`**
  - Les effets listés ci‑dessus doivent être idempotents, sinon risque de boucle.
- **Fenêtre occurrences (Home)**
  - `ensureWindowForGoals` doit éviter de retourner un nouvel objet si rien ne change.
- **Theme reconciliation (App)**
  - Peut écrire à chaque render si `ui.pageThemes.__default` diverge de `ui.theme`.
- **Auto‑end Session**
  - `useEffect` dans `Session.jsx` écrit occurrences + session à l’instant du timer == 0.

---

## 9) Résumé des sources de vérité (fonctions clés)

- **State**: `initialData()`, `migrate(prev)`, `usePersistedState(React)` (`src/logic/state.js`)
- **Storage**: `loadState()`, `saveState(state)` (`src/utils/storage.js`)
- **Occurrences**: `ensureWindowForGoal(s)`, `regenerateWindowForGoal` (`src/logic/occurrencePlanner.js`)
- **Occurrences CRUD**: `addOccurrence`, `updateOccurrence`, `setOccurrenceStatus`, `upsertOccurrence` (`src/logic/occurrences.js`)
- **Routing session**: `setTab(next, opts)` (`src/App.jsx`)

