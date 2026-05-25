export const RECOVERY_CONTEXT = Object.freeze({
  MISSED: "missed",
  LATE: "late",
  BLOCKED: "blocked",
  REPORTED: "reported",
  POSTPONED: "postponed",
});

export const RECOVERY_OPTION_TYPE = Object.freeze({
  REDUCE_DURATION: "reduce_duration",
  MOVE_LATER_TODAY: "move_later_today",
  MOVE_TOMORROW: "move_tomorrow",
  CHOOSE_TIME: "choose_time",
  SKIP_ONCE: "skip_once",
  OPEN_COACH_FOR_HELP: "open_coach_for_help",
  OPEN_PLANNING_DETAIL: "open_planning_detail",
});

export const RECOVERY_OPTION_REASON = Object.freeze({
  REDUCE_DURATION: "recovery_reduce_duration",
  MOVE_LATER_TODAY: "recovery_move_later_today",
  MOVE_TOMORROW: "recovery_move_tomorrow",
  CHOOSE_TIME: "recovery_choose_time",
  SKIP_ONCE: "recovery_skip_once",
  OPEN_COACH_FOR_HELP: "recovery_open_coach_for_help",
  OPEN_PLANNING_DETAIL: "recovery_open_planning_detail",
});
