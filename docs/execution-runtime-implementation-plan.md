# Execution Runtime Implementation Plan (Sequenced)

## Lot A — Logic hardening (SSoT completion)
### Objective
- Unify execution runtime semantics so `activeSession` and occurrence status are aligned at start/end.

### Probable files touched
- `/Users/allan/Desktop/discip-yourself code/src/pages/Home.jsx`
- `/Users/allan/Desktop/discip-yourself code/src/pages/Session.jsx`
- `/Users/allan/Desktop/discip-yourself code/src/logic/sessionResolver.js`
- `/Users/allan/Desktop/discip-yourself code/src/logic/occurrences.js`
- `/Users/allan/Desktop/discip-yourself code/src/logic/occurrenceStatus.js`
- `/Users/allan/Desktop/discip-yourself code/src/logic/sessionsV2.js`

### Risks
- Regression on today/session handoff.
- Status transitions might affect pilotage metrics if not idempotent.

### Tests to add/update
- Unit: start sets `in_progress`, finish/cancel terminal transitions idempotent.
- Unit: resolver behavior with `in_progress` occurrences.
- E2E: Today start -> Session -> done/skipped -> Today/Pilotage consistency.

### Validation criteria
- One canonical runtime path, no semantic split planned/partial during active execution.

---

## Lot B — Runtime UX model (guided vs free execution)
### Objective
- Introduce hybrid execution flow without changing core planning model.

### Probable files touched
- `/Users/allan/Desktop/discip-yourself code/src/pages/Home.jsx`
- `/Users/allan/Desktop/discip-yourself code/src/pages/Session.jsx`
- `/Users/allan/Desktop/discip-yourself code/src/ui/focus/FocusCard.jsx`
- `/Users/allan/Desktop/discip-yourself code/src/features/session/session.css`

### Risks
- UX complexity for beginners if mode choice is too early.
- Duplication between focus and session surfaces.

### Tests to add/update
- E2E: no-duration task start path.
- E2E: duration-defined guided path.
- Unit: fallback duration selection and pending validation transitions.

### Validation criteria
- Beginner can execute in <=2 taps from Today.

---

## Lot C — Notifications runtime
### Objective
- Add reliable reminder layer for validation/resume while avoiding spam.

### Probable files touched
- `/Users/allan/Desktop/discip-yourself code/src/logic/reminders.js`
- `/Users/allan/Desktop/discip-yourself code/src/hooks/useRemindersLoop.js`
- `/Users/allan/Desktop/discip-yourself code/src/pages/Onboarding.jsx` (permissions UX only)
- `/Users/allan/Desktop/discip-yourself code/src/logic/state/normalizers.js` (notification prefs keys)

### Risks
- Permission handling complexity across platforms.
- Reminder duplication if occurrence + runtime reminders overlap.

### Tests to add/update
- Unit: reminder dedupe and rate limits.
- E2E: runtime reminder state transitions (mock timers).

### Validation criteria
- User gets at most policy-defined reminders and can always stop them.

---

## Lot D — Rewards and anti-cheat soft controls
### Objective
- Tie rewards to validated execution and add non-intrusive integrity guards.

### Probable files touched
- `/Users/allan/Desktop/discip-yourself code/src/pages/Session.jsx`
- `/Users/allan/Desktop/discip-yourself code/src/logic/walletV1.js`
- `/Users/allan/Desktop/discip-yourself code/src/components/WalletBadge.jsx`
- `/Users/allan/Desktop/discip-yourself code/src/ui/totem/TotemDockLayer.jsx`

### Risks
- Perceived punishment if anti-cheat copy is poorly framed.
- Double-reward bug if idempotency is missing.

### Tests to add/update
- Unit: one reward per occurrence done.
- Unit: suspicious instant-complete path does not hard block.
- E2E: session done triggers wallet delta and no duplicate on refresh.

### Validation criteria
- Reward issuance predictable, auditable, and not exploitable by rapid toggles.

---

## Lot E — Premium extensions
### Objective
- Add advanced execution tooling without fragmenting the core loop.

### Probable files touched
- `/Users/allan/Desktop/discip-yourself code/src/pages/Session.jsx`
- `/Users/allan/Desktop/discip-yourself code/src/pages/Pilotage.jsx`
- `/Users/allan/Desktop/discip-yourself code/src/features/pilotage/radarModel.js`
- `/Users/allan/Desktop/discip-yourself code/src/components/TopMenuPopover.jsx`

### Risks
- Feature creep before core loop is stable.
- Increased cognitive load.

### Tests to add/update
- E2E: premium toggle behavior and fallback for free users.
- Unit: premium presets/config do not alter baseline runtime semantics.

### Validation criteria
- Premium adds depth without altering beginner success path.
