# UI FOUNDATIONS — DISCIP YOURSELF

## 1. Product visual intent

Discip Yourself is not a playful habit tracker, not a gaming app, and not a generic productivity dashboard.

It must feel like:
- disciplined
- premium
- lucid
- calm
- mentally sharp
- structured
- modern
- intentional

It must not feel like:
- childish
- cheap motivational app
- generic startup dashboard
- over-gamified
- visually noisy
- overly futuristic
- decorative without purpose

Core visual promise:
A premium discipline system with emotional depth, visual restraint, and strong internal coherence.

---

## 2. Brand atmosphere

### Emotional territory
- self-mastery
- control
- consistency
- clarity
- resilience
- elevation
- introspection

### Visual territory
- dark premium surfaces
- cold refined highlights
- subtle depth
- soft light diffusion
- high legibility
- intentional spacing
- quiet confidence

---

## 3. Art direction

### Art direction name
**Cold Discipline Premium**

### Style expression
- dark and deep base
- refined blue-steel accent
- subtle luminous dust in backgrounds
- glass/mineral feeling used with restraint
- rounded geometry with consistency
- no excessive neon
- no loud gradients
- no visual gimmicks

### Design references
- premium fintech clarity
- elite wellness precision
- Apple-level restraint
- modern system-driven mobile UI

---

## 4. Core design principles

1. Clarity before effect
2. Consistency before originality
3. One strong action per screen
4. Visual depth must support hierarchy
5. Motion must feel controlled, never playful
6. Surface treatments must repeat across the app
7. Every screen must feel part of one language
8. No page may invent its own UI primitives
9. Tokens drive visuals, not local improvisation
10. Premium means restraint, not excess

---

## 5. Color system

### Semantic meaning
Discipline is represented by:
- deep control
- cold clarity
- stable power
- internal intensity

### Primary palette
- Background / main: `#0B1020`
- Background / elevated: `#11182A`
- Surface / primary: `#12192B`
- Surface / secondary: `#182235`
- Surface / tertiary: `#1D2940`

### Text
- Text / primary: `#F5F7FB`
- Text / secondary: `#9AA6BF`
- Text / tertiary: `#6F7B95`

### Accent
- Accent / primary: `#4C7DFF`
- Accent / pressed: `#3558D8`
- Accent / soft glow: `rgba(76, 125, 255, 0.18)`

### Status
- Success: `#17B26A`
- Warning: `#F79009`
- Error: `#F04438`
- Info: `#4C7DFF`

### Borders
- Border / subtle: `rgba(255,255,255,0.08)`
- Border / medium: `rgba(255,255,255,0.12)`
- Border / strong: `rgba(255,255,255,0.18)`

### Overlay / backdrop
- Backdrop / soft: `rgba(5, 8, 18, 0.42)`
- Backdrop / medium: `rgba(5, 8, 18, 0.56)`
- Backdrop / strong: `rgba(5, 8, 18, 0.72)`

### Category accents
Each category can have its own accent, but category colors must:
- stay controlled
- avoid oversaturation
- remain compatible with the base dark palette
- never replace the core product accent system

---

## 6. Background system

### Global background behavior
Backgrounds must feel alive but nearly silent.

### Allowed background treatments
- deep gradient wash
- subtle luminous dust
- ultra-soft radial halos
- faint atmospheric grain
- occasional blurred color bloom

### Luminous dust rules
- very low contrast
- very low density
- very slow movement if animated
- no sharp particles
- no starfield effect
- no obvious looping pattern
- must disappear behind content hierarchy

### Forbidden
- visible moving particle fields
- strong glitter effect
- gaming/sci-fi atmosphere
- strong animated nebula backgrounds
- high-contrast texture

---

## 7. Surface language

### Surface behavior
All surfaces must come from one family.

### Surface types
#### A. Base surface
Used for most cards and blocks
- dark
- soft border
- subtle depth
- no loud glass

#### B. Elevated surface
Used for highlighted panels or important zones
- slightly brighter
- stronger border
- mild glow or shadow

#### C. Overlay surface
Used for drawers, sheets, modal layers
- controlled blur
- darker backdrop
- stronger separation from background

### Surface rules
- no page-specific card invention
- one card family, multiple semantic levels
- depth must come from system tokens, not local hacks

---

## 8. Shape language

### Global geometry
Rounded, stable, premium, modern.

### Radius scale
- XS: `10px`
- SM: `12px`
- MD: `14px`
- LG: `16px`
- XL: `20px`
- 2XL: `24px`
- Full: `999px`

### Usage
- Inputs: MD / 14
- Primary buttons: LG / 16
- Cards: XL / 20
- Bottom sheets / drawers: 2XL / 24
- Pills / tags: Full

### Rule
No arbitrary radius values outside the approved scale.

---

## 9. Typography system

### Tone
Typography must feel:
- clean
- calm
- controlled
- premium
- readable

### Font
- Primary font: Inter

### Scale
- Display title: 28 / semibold
- Screen title: 22–24 / semibold
- Section title: 18 / semibold
- Body strong: 16 / medium
- Body: 14–15 / regular
- Meta: 12–13 / medium
- Micro label: 11–12 / medium

### Typography rules
- avoid too many sizes
- titles must not compete with each other
- uppercase is reserved for micro labels / badge labels only
- line height must support calm reading
- no decorative typography

---

## 10. Spacing system

### Core spacing scale
- 4
- 8
- 12
- 16
- 20
- 24
- 32
- 40

### Layout standards
- Screen horizontal padding: `20px`
- Standard section gap: `24px`
- Card inner padding: `16px`
- Large panel padding: `20px`
- Tight cluster gap: `8px`
- Default stack gap: `12px`
- Relaxed stack gap: `16px`

### Rule
No random spacing values unless formally added to tokens.

---

## 11. Shadows, blurs, and glow

### Philosophy
Depth must be subtle and premium.

### Allowed
- soft shadow
- soft internal highlight
- restrained accent glow
- mild blur on overlays

### Forbidden
- heavy drop shadows
- strong outer glow
- multiple stacked shadow recipes per page
- ad hoc blur values

### System rule
All shadows, glows, and blurs must come from centralized tokens.

---

## 12. Buttons

### Primary button
Role:
Main CTA only

Style:
- filled
- accent background
- white text
- radius 16
- height 48–52
- strong clarity
- subtle pressed feedback

### Secondary button
Role:
supportive actions

Style:
- darker surface
- subtle border
- lighter emphasis
- same geometry as primary

### Ghost button
Role:
light contextual actions

Style:
- no heavy container
- careful text contrast
- used sparingly

### Button rules
- one primary style only
- one secondary style only
- no page-local CTA style invention
- icons align to same rhythm
- all states must be defined: default, hover, pressed, disabled, loading

---

## 13. Inputs and form system

### Form philosophy
Forms must feel guided, calm, and premium.

### Input behavior
- same surface family as cards
- same radius family
- same border logic
- one focus style across the app
- one error style across the app
- one helper text style across the app

### Required primitives
- text field
- textarea
- select
- segmented choice
- choice card
- toggle
- date/time selector wrapper
- validation message
- field group wrapper

### Rule
Create, edit, onboarding, and settings must all use the same form system.

---

## 14. Cards

### Card family
All cards belong to one design family.

### Card variants
- Standard card
- Elevated card
- Interactive card
- Choice card
- Metric/stat card

### Shared rules
- same radius family
- same border logic
- same internal spacing logic
- same interaction language
- no feature-specific reinvention unless approved

---

## 15. Navigation

### Navigation feel
Navigation must feel stable and quiet.

### Rules
- one canonical naming system
- remove legacy aliases once migration is complete
- top nav, bottom nav, and drawer must use one motion and one surface language
- active state must be obvious but not loud
- transitions must feel short and intentional

---

## 16. Motion system

### Motion philosophy
Motion must express:
- control
- continuity
- feedback
- hierarchy

Never:
- spectacle
- bounce-heavy playfulness
- distraction

### Motion ladder
- Fast micro feedback: `120ms`
- Standard interaction: `160ms`
- Page/content enter: `220ms`
- Panel/sheet transition: `280ms`
- Gentle atmospheric motion: `8s–16s`

### Easing
Use one primary easing family for the app:
- smooth, calm, controlled
- no playful overshoot by default

### Allowed motion patterns
- fade in
- soft translate Y
- soft translate X for directional transitions
- subtle scale on press
- controlled progress fill
- soft active-state transitions
- staggered appearance for grouped content

### Forbidden
- long theatrical transitions
- strong bounce
- large parallax
- inconsistent motion patterns across screens

---

## 17. Micro-interactions

### Required micro-interactions
- button press feedback
- tab active transition
- toggle transition
- card pressed/hovered state
- progress/meter fill animation
- drawer open/close
- modal/sheet enter/exit
- page content reveal
- skeleton/loading shimmer if used

### Page transition behavior
On page change:
- main container enters with soft fade + slight translate
- main blocks appear in short sequence
- total effect must stay subtle and fast

### Rule
Micro-animations must improve perceived quality, not steal attention.

---

## 18. Loading, empty, and feedback states

### Loading
- consistent skeleton or loader family
- no random spinners per page
- subtle motion
- premium restraint

### Empty states
- calm
- useful
- not cartoonish
- one reusable pattern

### Feedback states
- success, warning, error, info must use shared semantic colors and shared UI patterns

---

## 19. Component architecture rules

### Canonical UI primitives
The app must converge toward one canonical primitive stack.

Required shared primitives:
- AppScreen
- ScreenHeader
- AppCard
- PrimaryButton
- SecondaryButton
- AppInput
- AppTextarea
- AppSelect
- FieldGroup
- ChoiceCard
- MetricRow
- ProgressBar
- SectionHeader
- EmptyState
- AppDrawer
- AppSheet
- StatusBadge

### Rule
No major page may define its own Button/Card/Input wrapper anymore.

---

## 20. Code cleanliness rules

### Mandatory rules
- no hardcoded colors outside token/theme files
- no hardcoded radius outside token/theme files
- no hardcoded shadow/blur recipes outside token/theme files
- no page-local mini design systems
- no legacy aliases kept forever
- no new duplicate primitive layer
- no inline visual style unless strictly justified

### Cleanup principle
Delete before replacing when the existing layer is clearly obsolete.

---

## 21. Preservation rules

### Keep and build upon if valid
- ScreenShell pattern
- Gate / GateForm if selected as canonical base
- strong nav primitives already converging
- auth shell patterns that align to the system
- any shared primitive already structurally sound

### Replace or remove
- compatibility-only UI layers
- dead files
- duplicate wrappers
- page-local primitive reinventions
- ad hoc motion logic

---

## 22. Final quality bar

A senior developer opening this codebase should feel:
- clear visual law
- centralized tokens
- shared primitives
- deliberate motion system
- strong reuse
- low visual entropy
- coherent navigation language
- no obvious UI chaos

A user opening the app should feel:
- premium discipline
- calm intensity
- clarity
- control
- progression
- consistency