import React from "react";
import { Sparkles } from "lucide-react";

export default function FloatingWelcomeLine({
  children = "Bon retour — aujourd’hui, on avance bloc par bloc.",
  state = "neutral",
  tone = "neutral",
  motionIntensity = "normal",
  isRefreshing = false,
}) {
  const className = [
    "todayFloatingWelcomeLine",
    state ? `today-state-${state}` : "",
    tone ? `today-tone-${tone}` : "",
    motionIntensity ? `today-motion-${motionIntensity}` : "",
    isRefreshing ? "is-refreshing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <Sparkles size={17} strokeWidth={1.9} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
