# AGENTS.md Addendum — Today Premium Redesign

## Product direction

Discip Yourself is a premium discipline app.  
The Today screen is the main cockpit for execution.

## Design rules

- Today is not a generic dashboard.
- Today is not a todo list.
- Green = execution / control / validation.
- Purple = AI only.
- Orange/red = risk / late states only.
- White/off-white = primary commitment CTA.
- No cheap gamification.
- No confetti.
- No generic todo-list UI.
- No yellow default accents.
- No global manual + creation button.

## Today navigation

Bottom navigation items:
- Objectifs
- Planning
- Home
- Coach IA
- Ajuster

Home is centered and always green.  
Home returns to Today from any page.  
Coach IA keeps a purple AI identity.  
Other nav icons must be visually homogeneous and neutral unless selected.

## Creation / adjustment

Manual global creation via a standalone + button should be removed.  
Creation or adjustment should go through:
- Coach IA;
- Ajuster;
- Planning.

## Profile

Avatar opens a user menu:
- Profil;
- Paramètres;
- Abonnement;
- Support;
- Déconnexion.

## Implementation workflow

- Audit before implementation.
- Propose a plan before code changes.
- Keep scope narrow per phase.
- Reuse existing data flow when safe.
- Remove obsolete components only after identifying dependencies.
- Run lint/typecheck/tests/build when available.
- Provide screenshots after visual implementation.
- Respect reduced motion.
- Do not add heavy dependencies without approval.
