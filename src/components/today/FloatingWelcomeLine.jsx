import React from "react";
import { Sparkles } from "lucide-react";

export default function FloatingWelcomeLine({
  children = "Bon retour — aujourd’hui, on avance bloc par bloc.",
}) {
  return (
    <div className="todayFloatingWelcomeLine">
      <Sparkles size={17} strokeWidth={1.9} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
