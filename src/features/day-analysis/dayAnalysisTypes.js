export const DAY_ANALYSIS_VERSION = 1;

export const DAY_ANALYSIS_ACTION_TYPE = Object.freeze({
  REDUCE_DURATION: "reduce_duration",
  MOVE_LATER_TODAY: "move_later_today",
  MOVE_TOMORROW: "move_tomorrow",
  RECOVER_BLOCK: "recover_block",
  ADD_SHORT_BLOCK: "add_short_block",
  SIMPLIFY_NEXT_ACTION: "simplify_next_action",
  OPEN_COACH: "open_coach",
  OPEN_PLANNING: "open_planning",
  NO_CHANGE: "no_change",
});

export const DAY_ANALYSIS_SUPPORT_STATUS = Object.freeze({
  APPLICABLE: "applicable",
  RECOVERY_SHEET: "recovery_sheet",
  REVIEW_ONLY: "review_only",
  NAVIGATION_ONLY: "navigation_only",
  NO_CHANGE: "no_change",
  UNAVAILABLE: "unavailable",
});

export const DAY_ANALYSIS_TARGET_TYPE = Object.freeze({
  OCCURRENCE: "occurrence",
  ACTION: "action",
  OBJECTIVE: "objective",
  DAY: "day",
  COACH: "coach",
  PLANNING: "planning",
});

export const DAY_ANALYSIS_DETERMINISTIC_KIND = Object.freeze({
  RECOVERY: "recovery",
  PLANNING_REPAIR: "planning_repair",
  NAVIGATION: "navigation",
  REVIEW_ONLY: "review_only",
  NO_CHANGE: "no_change",
});
