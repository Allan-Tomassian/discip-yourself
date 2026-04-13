# Session Guidance Boundary

Session Guidance is a local-first session engine.

## Core boundary
- `sessionBlueprintV1` is the durable action-level session contract.
- `sessionRunbook` is the execution artifact derived from the blueprint.
- `guidedSpatialState` is local runtime navigation/progression over the runbook.
- `sessionToolPlan` is operational support derived from the runbook.

## Operation classes
- `prepare`: enriches a preview before execution.
- `adjust`: patches an existing runbook during preview or active runtime.
- `tool`: returns an artifact or utility for the current segment.

## Availability rule
- The session must stay fully executable without backend AI.
- Backend session guidance is optional.
- If `/ai/session-guidance` is unavailable, the app falls back to local runbook, local adjustments, and local tools.

## Persistence rule
- Cloud keeps only server-safe `activeSession` core.
- `guidedRuntimeV1` stays local to the device.
- Coach backend never reads guided spatial/runtime details.

## Safety rule
- `prepare` can enrich the runbook and tool plan.
- `adjust` can patch the runbook.
- `tool` must never re-plan the session or mutate the runbook contract.
