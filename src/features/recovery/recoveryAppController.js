import { applyRecoveryOption } from "./recoveryRepairModel";

export function commitRecoveryOptionState({ state, occurrenceId, option, now, setData } = {}) {
  const result = applyRecoveryOption({ state, occurrenceId, option, now });
  if (result.ok && result.nextState && result.nextState !== state && typeof setData === "function") {
    setData(result.nextState);
  }
  return result;
}
