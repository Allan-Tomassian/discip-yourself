# Phase 7 UX QA Checklist

## Screens
- Home: Calendar card visible, DayRail centered, Focus card present and readable
- Create: all steps load, required fields visible, no layout shift
- Edit: existing item loads, date fields and select fields render correctly
- Session: current occurrence loads, actions available, no overlay clipping
- Pilotage: metrics cards render and scroll, charts visible

## Overlays
- Select: opens on first click, anchored to trigger, closes on outside click
- DatePicker: opens on first click, calendar grid visible, closes on outside click/ESC
- Calendar (Month view): grid stable, selected day highlighted, next/prev works

## Mobile Responsive
- iPhone Safari: no horizontal overflow, safe area respected, bottom bar does not cover CTAs
- iPhone Safari: DayRail centered on first render without interaction
- iPhone Safari: overlays stay within viewport and are not clipped

## Manual Tests (15+)
1. Home: first load -> DayRail selected date is centered, no jitter.
2. Home: switch Jour/Mois/Jour -> selected date preserved and centered.
3. Home: tap date on rail -> highlight updates, no visual shift.
4. Home: Focus card visible below calendar, CTA not obscured by bottom bar.
5. Create: open Select -> menu positioned correctly without scrolling.
6. Create: open DatePicker -> calendar opens on first click, no left offset.
7. Create: choose date -> value renders as jj/mm/aaaa, stored value is YYYY-MM-DD.
8. Edit: open existing item -> date fields show correct values.
9. Edit: change date -> persists after save.
10. Session: open from Focus card -> occurrence details visible, actions enabled.
11. Pilotage: Discipline card shows bar and values (no NaN/empty).
12. Pilotage: Trend card displays +/- versus prior window.
13. Pilotage: radar chart renders (or fallback if not present) without overlap.
14. Overlays: click outside Select/DatePicker -> closes reliably.
15. Overlays: press ESC on open Select/DatePicker -> closes.
16. Mobile: rotate iPhone portrait/landscape -> DayRail remains centered.
17. Mobile: no horizontal scrolling on body/root.

## Notes
- If any overlay appears offset, verify portal root and positioning logic.
- If date formatting seems off, re-check local date helpers and normalization.
