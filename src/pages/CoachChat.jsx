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
      headerSubtitle={initialMode === "structure" ? "Structurer un projet avant de créer réellement." : "Conversation rapide, orientée action"}
    >
      <CoachConversationSurface controller={controller} mode="page" />
    </ScreenShell>
  );
}
