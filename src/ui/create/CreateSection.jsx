import React from "react";
import { GateSection } from "../../shared/ui/gate/Gate";
import "../../features/create-flow/createFlow.css";

export default function CreateSection({
  title,
  description,
  children,
  collapsible = true,
  defaultOpen = true,
}) {
  return (
    <GateSection
      title={title}
      description={description}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
    >
      {children}
    </GateSection>
  );
}
