# COMPOSITION FOUNDATIONS — DISCIP YOURSELF

This document complements [UI_FOUNDATIONS.md](./UI_FOUNDATIONS.md).

UI foundations define tokens, primitives, and visual language.
Composition foundations define when visible surfaces appear, how much visual weight they carry, and how deep composition is allowed to go.

## 1. Composition intent

The app must feel:
- calm
- breathable
- premium
- ordered
- intentional

The app must not feel:
- boxed-in
- over-encapsulated
- equally elevated everywhere
- structurally heavy
- noisy from repeated containers

Hierarchy should come from:
1. purpose
2. spacing
3. typography
4. surface elevation

Surface elevation is the last tool, not the first.

## 2. Surface roles

### Structural
Structural blocks organize content.

Examples:
- labels
- helper context
- empty-state text
- passive summaries
- grouping wrappers

Default treatment:
- flat
- no elevated card

### Actionable
Actionable blocks contain meaningful controls or decisions.

Examples:
- forms
- CTA zones
- toggle groups
- mode switches
- approval or confirmation areas

Default treatment:
- one dominant surface when the section is action-led

### Comparative
Comparative blocks present sibling objects the user scans to choose, buy, rank, inspect, or reorder.

Examples:
- category rows
- choice cards
- shop items
- selectable alternatives

Default treatment:
- the row or card is the object
- do not wrap comparison objects in a second structural card unless the parent surface is true synthesis

### Informational
Informational blocks present dense synthesis or diagnostic content.

Examples:
- today hero
- planning calendar section
- pilotage summary
- dense stats panels

Default treatment:
- one anchored surface when density or synthesis justifies it

## 3. Global laws

### Flat by default
Descriptive copy, helper context, empty-state text, low-density status, and structural grouping stay flat.

### Visible surface justified
A visible surface is justified only when the user must:
- decide
- compare
- act
- parse dense synthesized information

### Dominant surface
Each section gets at most one dominant surface when it is the section's primary synthesis, decision, or action zone.

### Comparative/selectable surface
Child row cards are allowed only when the row itself is the object being compared, selected, ranked, purchased, or inspected.

### Informational micro-surface
`AppInlineMetaCard`, `FeedbackMessage`, and similar light blocks are allowed, but they should not sit inside a second structural card unless the parent is a true dominant surface.

## 4. Maximum surface depth

- Depth `0`: flat section, no visible container
- Depth `1`: one dominant surface
- Depth `2`: allowed only when the child surface is independently actionable or comparative
- Depth `3+`: non-compliant

Disallowed patterns:
- `SectionHeader + AppCard + single AppInlineMetaCard`
- parent card around a list of row cards when the rows are the real objects
- dominant surface plus secondary panel plus mini-stat cards
- passive helper cards inside already elevated sections
- equal elevation for primary and secondary surfaces

## 5. Allowed exceptions

These may remain visibly surfaced when they are the primary object:
- `AppFormSection`
- `ChoiceCard`
- `AccentCategoryRow`
- `AccentItem`
- shop cards
- message bubbles
- error states
- explicit selectable alternatives

These exceptions do not override the depth rule.

## 6. Section defaults

### Utility and legal pages
- default flat
- use one dominant surface only for real forms or dense action areas

### Main workspaces
- one dominant surface per major section
- support content inside the section should be flat unless it is comparative or independently actionable

### Library
- category rows and action rows are the objects
- wrapper cards should not compete with the rows

### Overlays
- the sheet, drawer, or panel is the dominant surface
- interior child cards are allowed only for product offers, message objects, or distinct selectable items

## 7. Enforcement

Composition compliance is complete only when:
- every audited section is explicitly flat, dominant-surface, or comparative/selectable
- no audited surface exceeds depth `2`
- no section uses visible containers for purely structural content
- exceptions are explicit and documented
- visual contract tests reflect the law

## 8. Current rollout targets

The remaining rollout is focused on:
- utility and settings pages
- library root and category workspace
- secondary pilotage panels
- secondary dock/support panels

Main create/edit/onboarding flows, coach message bubbles, and core execution surfaces remain intentionally unchanged unless their role changes.
