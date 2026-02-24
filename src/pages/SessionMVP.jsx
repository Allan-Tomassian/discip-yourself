import React from "react";
import Session from "./Session";

// Legacy compatibility wrapper.
// Runtime session screen is Session (SSoT: ui.activeSession + sessionHistory).
export default function SessionMVP(props) {
  return <Session {...props} />;
}
