# UI/DA Audit (Gate Only Target)
Generated: 2026-02-17T11:46:36.304Z

## Reference Gate
Source of truth: `src/shared/ui/gate/Gate.jsx`, `src/shared/ui/gate/gate.css`
Visual references: `src/components/CategoryGateModal.jsx`, `src/ui/create/CreateFlowModal.jsx`

## Global Coherence
- UI files scanned: 54
- Gate present: 20 (37.04%)
- Non-Gate present: 46 (85.19%)
- Gate-only files: 8 (14.81%)
- Mixed-system files: 23

## Routes And Reachable Views
| Route | Tab |
| --- | --- |
| / | today |
| /account | account |
| /data | data |
| /pilotage | - |
| /preferences | preferences |
| /privacy | privacy |
| /session | session |
| /settings | preferences |
| /subscription | subscription |
| /support | support |
| /terms | terms |

| Tab | Component | Module |
| --- | --- | --- |
| (import-only) | Onboarding | src/pages/Onboarding.jsx |
| account | Account | src/pages/Account.jsx |
| category-detail | CategoryDetailView | src/pages/CategoryDetailView.jsx |
| category-progress | CategoryProgress | src/pages/CategoryProgress.jsx |
| create-goal | CreateV2Outcome | src/pages/CreateV2Outcome.jsx |
| create-habit-anytime | CreateV2HabitAnytime | src/pages/CreateV2HabitAnytime.jsx |
| create-habit-oneoff | CreateV2HabitOneOff | src/pages/CreateV2HabitOneOff.jsx |
| create-habit-recurring | CreateV2HabitRecurring | src/pages/CreateV2HabitRecurring.jsx |
| create-habit-type | CreateV2HabitType | src/pages/CreateV2HabitType.jsx |
| create-link-outcome | CreateV2LinkOutcome | src/pages/CreateV2LinkOutcome.jsx |
| create-outcome-next | CreateV2OutcomeNextAction | src/pages/CreateV2OutcomeNextAction.jsx |
| create-pick-category | CreateV2PickCategory | src/pages/CreateV2PickCategory.jsx |
| data | DataPage | src/pages/Data.jsx |
| edit-item | EditItem | src/pages/EditItem.jsx |
| library | Categories | src/pages/Categories.jsx |
| library | CategoryView | src/pages/CategoryView.jsx |
| pilotage | Pilotage | src/pages/Pilotage.jsx |
| preferences | Preferences | src/pages/Preferences.jsx |
| privacy | Privacy | src/pages/Privacy.jsx |
| session | SessionMVP | src/pages/SessionMVP.jsx |
| subscription | Subscription | src/pages/Subscription.jsx |
| support | Support | src/pages/Support.jsx |
| terms | Terms | src/pages/Terms.jsx |
| today | Home | src/pages/Home.jsx |

## Modals Popovers Overlays
| Type | Components |
| --- | --- |
| Modals | CategoryGateModal, CreateFlowModal, Modal, PaywallModal |
| Popovers | TopMenuPopover |
| Drawers | - |
| Overlays | DiagnosticOverlay, TourOverlay |
| Transient Views | CategoryDetailView, CategoryGateModal, CategoryManageInline, CategoryProgress, CategoryRail, CategoryView, CreateFlowModal, CreateV2HabitAnytime, CreateV2HabitOneOff, CreateV2HabitRecurring, CreateV2Habits, CreateV2HabitType, CreateV2LinkOutcome, CreateV2Outcome, CreateV2OutcomeNextAction, CreateV2PickCategory, EditItem, EditItemPanel, Onboarding, ProgressRing, SessionMVP |

## Pages Inventory
| Page | Systems | JSX Components | CSS Imports | Legacy Primitives |
| --- | --- | --- | --- | --- |
| src/pages/_ScreenShell.jsx | - | 1 | - | - |
| src/pages/Account.jsx | gate | 4 | - | - |
| src/pages/Categories.jsx | legacy | 8 | - | Button, Card, Input, Textarea |
| src/pages/CategoryDetailView.jsx | legacy | 4 | - | Button, Card |
| src/pages/CategoryProgress.jsx | legacy | 4 | - | Button, Card |
| src/pages/CategoryView.jsx | glass, legacy | 5 | - | Button, Card |
| src/pages/CreateV2HabitAnytime.jsx | - | 1 | - | - |
| src/pages/CreateV2HabitOneOff.jsx | - | 1 | - | - |
| src/pages/CreateV2HabitRecurring.jsx | - | 1 | - | - |
| src/pages/CreateV2Habits.jsx | gate, legacy | 17 | - | Button, Input, Textarea |
| src/pages/CreateV2HabitType.jsx | gate, legacy | 4 | - | Button |
| src/pages/CreateV2LinkOutcome.jsx | gate, legacy | 7 | - | Button, Input |
| src/pages/CreateV2Outcome.jsx | gate, legacy | 7 | - | Button, Input |
| src/pages/CreateV2OutcomeNextAction.jsx | gate, legacy | 4 | - | Button |
| src/pages/CreateV2PickCategory.jsx | gate, legacy | 5 | - | Button |
| src/pages/Data.jsx | glass, legacy, liquid | 3 | - | Button |
| src/pages/EditItem.jsx | legacy | 8 | - | Button, Card, Input, Textarea |
| src/pages/Home.jsx | glass, legacy | 11 | - | Button, Card, SelectMenu, Textarea |
| src/pages/Onboarding.jsx | legacy | 6 | - | Button, Card, Input, Textarea |
| src/pages/Pilotage.jsx | legacy | 9 | - | Button, Card, Input |
| src/pages/Preferences.jsx | gate | 5 | - | - |
| src/pages/Privacy.jsx | glass, legacy, liquid | 3 | - | Button |
| src/pages/Session.jsx | gate, legacy | 4 | - | Button |
| src/pages/SessionMVP.jsx | legacy | 3 | - | Button, Card |
| src/pages/Subscription.jsx | glass, legacy, liquid | 3 | - | Button |
| src/pages/Support.jsx | glass, liquid | 2 | - | - |
| src/pages/Terms.jsx | glass, legacy, liquid | 3 | - | Button |

## Features Inventory
| Feature File | Systems | JSX Components | CSS Imports |
| --- | --- | --- | --- |
| src/features/account/accountGate.css | - | 0 | - |
| src/features/calendar/calendar.css | - | 0 | - |
| src/features/create-flow/createFlow.css | - | 0 | - |
| src/features/library/CategoryManageInline.jsx | legacy | 5 | - |
| src/features/library/library.css | - | 0 | - |
| src/features/navigation/topMenuGate.css | gate, glass | 0 | - |
| src/features/paywall/paywall.css | - | 0 | - |
| src/features/pilotage/pilotage.css | - | 0 | - |
| src/features/pilotage/radarModel.js | - | 0 | - |
| src/features/preferences/preferencesGate.css | - | 0 | - |
| src/features/session/session.css | - | 0 | - |
| src/features/today/today.css | - | 0 | - |

## Mixed Hotspots
| Score | File | Kind | Systems | Legacy/Liquid Usage |
| --- | --- | --- | --- | --- |
| 21 | src/components/ThemePicker.jsx | component | glass, legacy, liquid | Button, LiquidGlassSurface, SelectMenu |
| 21 | src/pages/Data.jsx | page | glass, legacy, liquid | Button, LiquidGlassSurface |
| 21 | src/pages/Privacy.jsx | page | glass, legacy, liquid | Button, LiquidGlassSurface |
| 21 | src/pages/Subscription.jsx | page | glass, legacy, liquid | Button, LiquidGlassSurface |
| 21 | src/pages/Terms.jsx | page | glass, legacy, liquid | Button, LiquidGlassSurface |
| 20 | src/pages/Home.jsx | page | glass, legacy | Button, Card, SelectMenu, Textarea |
| 17 | src/components/EditItemPanel.jsx | component | glass, legacy | Button, Input, Textarea |
| 17 | src/pages/CategoryView.jsx | page | glass, legacy | Button, Card |
| 15 | src/App.jsx | other | glass, legacy | Button, Card |
| 15 | src/components/AdvancedDrawer.jsx | component | glass, legacy | Button |
| 15 | src/pages/CreateV2Habits.jsx | page | gate, legacy | Button, Input, Textarea |
| 14 | src/pages/CreateV2LinkOutcome.jsx | page | gate, legacy | Button, Input |
| 14 | src/pages/CreateV2Outcome.jsx | page | gate, legacy | Button, Input |
| 14 | src/pages/Support.jsx | page | glass, liquid | LiquidGlassSurface |
| 13 | src/components/CategoryGateModal.jsx | component | gate, legacy | Input, Modal |
| 13 | src/pages/CreateV2HabitType.jsx | page | gate, legacy | Button |
| 13 | src/pages/CreateV2OutcomeNextAction.jsx | page | gate, legacy | Button |
| 13 | src/pages/CreateV2PickCategory.jsx | page | gate, legacy | Button |
| 13 | src/pages/Onboarding.jsx | page | legacy | Button, Card, Input, Textarea |
| 13 | src/pages/Session.jsx | page | gate, legacy | Button |

## Legacy Class Usage
| Class | Usage Count | Sample Usage Files |
| --- | --- | --- |
| liquidSurfaceBody | 6 | src/components/ThemePicker.jsx, src/pages/Data.jsx, src/pages/Privacy.jsx, src/pages/Subscription.jsx |
| liquidSurfaceHeader | 6 | src/components/ThemePicker.jsx, src/pages/Data.jsx, src/pages/Privacy.jsx, src/pages/Subscription.jsx |
| liquidSurfaceHeaderText | 6 | src/components/ThemePicker.jsx, src/pages/Data.jsx, src/pages/Privacy.jsx, src/pages/Subscription.jsx |
| liquidSurfaceSubtitle | 6 | src/components/ThemePicker.jsx, src/pages/Data.jsx, src/pages/Privacy.jsx, src/pages/Subscription.jsx |
| liquidSurfaceTitle | 6 | src/components/ThemePicker.jsx, src/pages/Data.jsx, src/pages/Privacy.jsx, src/pages/Subscription.jsx |
| liquidPageStack | 5 | src/pages/Data.jsx, src/pages/Privacy.jsx, src/pages/Subscription.jsx, src/pages/Support.jsx |
| modalBackdrop | 5 | src/App.jsx, src/components/AdvancedDrawer.jsx, src/components/EditItemPanel.jsx, src/components/PaywallModal.jsx |
| drawerBackdrop | 2 | src/components/AdvancedDrawer.jsx, src/components/EditItemPanel.jsx |
| drawerHeader | 2 | src/components/AdvancedDrawer.jsx, src/components/EditItemPanel.jsx |
| drawerPanel | 2 | src/components/AdvancedDrawer.jsx, src/components/EditItemPanel.jsx |
| liquidActionsRow | 2 | src/components/ThemePicker.jsx, src/pages/Subscription.jsx |
| liquidNote | 2 | src/components/ThemePicker.jsx, src/pages/Data.jsx |
| liquidActionsCol | 1 | src/pages/Data.jsx |
| navMenuBars | 1 | src/components/TopNav.jsx |
| navMenuTrigger | 1 | src/components/TopNav.jsx |
| panelNarrow | 1 | src/pages/CategoryView.jsx |
