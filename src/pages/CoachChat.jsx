import React from "react";
import ScreenShell from "./_ScreenShell";
import { CoachConversationSurface, useCoachConversationController } from "../features/coach/CoachPanel";

export default function CoachChat({
  data,
  setData,
  setTab,
  sourceTab = "today",
}) {
  const controller = useCoachConversationController({
    data,
    setData,
    setTab,
    surfaceTab: sourceTab,
  });

  return (
    <ScreenShell
      data={data}
      pageId="coach-chat"
      headerTitle="Coach"
      headerSubtitle="Conversation rapide, orientée action"
    >
      <CoachConversationSurface controller={controller} mode="page" />
    </ScreenShell>
  );
}
