import { createContext, useContext } from "react";

export const BehaviorFeedbackContext = createContext({
  currentSignal: null,
  emitBehaviorFeedback: () => false,
  dismissBehaviorFeedback: () => {},
});

export function useBehaviorFeedback() {
  return useContext(BehaviorFeedbackContext);
}
