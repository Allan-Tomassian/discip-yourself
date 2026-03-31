import React from "react";
import ScreenShell from "./_ScreenShell";
import { CoachConversationSurface, useCoachConversationController } from "../features/coach/CoachPanel";

export default function CoachChat({
  data,
  setData,
  setTab,
  sourceTab = "today",
  initialMode = "chat",
  onOpenAssistantCreate,
}) {
  const controller = useCoachConversationController({
    data,
    setData,
    setTab,
    surfaceTab: sourceTab,
    initialMode,
    onOpenAssistantCreate,
  });

  return (
    <ScreenShell
      data={data}
      pageId="coach-chat"
      headerTitle="Coach"
      headerSubtitle={
        initialMode === "structure"
          ? "Transformer une intention en catégorie, direction ou action avant de créer."
          : "Clarifier une intention ou un prochain pas avec le Coach."
      }
    >
      <CoachConversationSurface controller={controller} mode="page" />
    </ScreenShell>
  );
}
