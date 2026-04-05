export function createHomeNavigationHandlers({ openLibraryDetail, setTab }) {
  return {
    onOpenLibrary() {
      if (typeof openLibraryDetail === "function") openLibraryDetail();
    },
    onOpenPilotage() {
      if (typeof setTab === "function") setTab("insights");
    },
  };
}
