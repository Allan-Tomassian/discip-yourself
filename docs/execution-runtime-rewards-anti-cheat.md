# Execution Runtime Rewards & Anti-Cheat (Spec)

## Current state (repo-backed)
- Coins rewards are currently tied to micro-actions and rewarded ads:
  - micro done: +2 (`/Users/allan/Desktop/discip-yourself code/src/logic/walletV1.js:4`, `/Users/allan/Desktop/discip-yourself code/src/pages/Home.jsx:1638-1649`)
  - ad reward: +50 (`/Users/allan/Desktop/discip-yourself code/src/logic/walletV1.js:5`, `/Users/allan/Desktop/discip-yourself code/src/pages/Home.jsx:1771-1775`)
- Session completion currently updates occurrence/session history but does not write wallet rewards (`/Users/allan/Desktop/discip-yourself code/src/pages/Session.jsx:399-539`).
- Totem flight feedback is triggered from micro done event bus, not from session validation (`/Users/allan/Desktop/discip-yourself code/src/pages/Home.jsx:1672-1675`, `/Users/allan/Desktop/discip-yourself code/src/ui/totem/TotemDockLayer.jsx:486-490`).

## Canonical reward timing recommendation
- **Award on terminal validation only (`done`)**.
- Never award on `start`.
- No positive reward for `skipped`, `canceled`, `missed`.
- One reward envelope per occurrence terminalization (idempotent).

## Reward envelope (spec)
- `rewardSource`: `session_done | micro_done | ad_reward | challenge_done`
- `entityId`: `occurrenceId` (or micro item id)
- `amount`: integer
- `ts`: timestamp
- `confidence`: `high | medium | low` (optional signal)

## Lightweight anti-cheat policy (non-toxic)
### Acceptable baseline
- Self-report remains allowed.
- No heavy proof (photo/gps/video) in MVP.

### Soft checks
1. Instant complete filter:
   - if `start -> done < 15s`, show confirm prompt, do not hard block.
2. Duration coherence hint:
   - if done far below configured duration repeatedly, mark low-confidence streak (internal only).
3. Duplicate guard:
   - prevent multiple rewards for same occurrence terminal status.
4. Burst detector:
   - if too many rapid completes, downgrade bonus rewards (not base validation credit).

### User-facing friction (minimal)
- One extra confirmation only in suspicious edge cases.
- Keep copy supportive: “Confirmer l’exécution” not punitive language.

## Integration with discipline metrics
- Discipline scoring remains based on expected/done/missed semantics (already canonicalized).
- Reward signals should not rewrite discipline history; they are adjacent incentives.

## Totem feedback placement
- `micro_done`: short totem micro-feedback.
- `session_done`: premium but subtle confirmation (badge + short totem signal).
- No full-screen blocking animations by default.

## Abuse boundaries (MVP)
- Allow manual corrections same day.
- Keep audit trail in `sessionHistory` and wallet events.
- Add tooling to inspect outlier patterns before enforcing strict penalties.
