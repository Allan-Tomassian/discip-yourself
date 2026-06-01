import React, { useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { isPremium } from "../logic/entitlements";
import { STATUS_COPY } from "../ui/labels";
import {
  AppActionRow,
  AppBackButton,
  AppCard,
  AppDialog,
  AppScreen,
  FeedbackMessage,
  GhostButton,
  PrimaryButton,
  SectionHeader,
} from "../shared/ui/app";
import { DATA_IMPORT_CONFIRM_COPY, prepareDataImportState } from "./dataImportModel";
import {
  LOCAL_DATA_RESET_COPY,
  isLocalDataResetEnvironment,
  runLocalDataReset,
} from "./localDataResetModel";

function downloadJsonFile(filename, payload) {
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch {
    // no-op
  }
}

export function DataLocalResetSection({ onRequestReset }) {
  return (
    <section className="mainPageSection" data-testid="data-local-reset-section">
      <SectionHeader
        title={LOCAL_DATA_RESET_COPY.sectionTitle}
        subtitle={LOCAL_DATA_RESET_COPY.sectionSubtitle}
      />
      <div className="mainPageSectionBody">
        <AppCard>
          <div className="col gap12">
            <div className="small2 textMuted">{LOCAL_DATA_RESET_COPY.notice}</div>
            <AppActionRow>
              <GhostButton
                type="button"
                onClick={() => onRequestReset?.("local")}
              >
                {LOCAL_DATA_RESET_COPY.resetLabel}
              </GhostButton>
              <GhostButton
                type="button"
                onClick={() => onRequestReset?.("logout")}
              >
                {LOCAL_DATA_RESET_COPY.logoutResetLabel}
              </GhostButton>
            </AppActionRow>
          </div>
        </AppCard>
      </div>
    </section>
  );
}

export function DataLocalResetConfirmationContent({
  resetType = "",
  pending = false,
  onCancel,
  onConfirm,
}) {
  const isLogoutReset = resetType === "logout";
  return (
    <div className="col gap16" data-testid="data-local-reset-confirmation">
      <div className="col gap6">
        <div className="titleSm">{LOCAL_DATA_RESET_COPY.confirmTitle}</div>
        <div className="small2 textMuted">{LOCAL_DATA_RESET_COPY.notice}</div>
      </div>
      <AppActionRow>
        <GhostButton type="button" onClick={onCancel} disabled={pending}>
          {LOCAL_DATA_RESET_COPY.cancel}
        </GhostButton>
        <PrimaryButton type="button" onClick={onConfirm} disabled={pending}>
          {isLogoutReset ? LOCAL_DATA_RESET_COPY.confirmLogoutResetCta : LOCAL_DATA_RESET_COPY.confirmResetCta}
        </PrimaryButton>
      </AppActionRow>
    </div>
  );
}

export default function Data({
  data,
  setData,
  onOpenPaywall,
  onBack,
  resetEnvironment,
  reloadApp,
}) {
  const { signOut } = useAuth();
  const safeData = data && typeof data === "object" ? data : {};
  const premium = isPremium(safeData);
  const importInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState("");
  const [pendingImport, setPendingImport] = useState(null);
  const [pendingResetType, setPendingResetType] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const showLocalResetControls = isLocalDataResetEnvironment(resetEnvironment);

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const prepared = prepareDataImportState(String(reader.result || ""));
      if (!prepared.ok) {
        setPendingImport(null);
        setImportStatus(STATUS_COPY.importInvalid);
        return;
      }
      setPendingImport({
        fileName: file.name || "fichier JSON",
        data: prepared.data,
      });
      setImportStatus("");
    };
    reader.onerror = () => {
      setPendingImport(null);
      setImportStatus(STATUS_COPY.importReadError);
    };
    reader.readAsText(file);
  }

  function handleConfirmImport() {
    if (!pendingImport?.data) return;
    try {
      setData(() => pendingImport.data);
      setPendingImport(null);
      setImportStatus(STATUS_COPY.importDone);
    } catch {
      setPendingImport(null);
      setImportStatus(STATUS_COPY.importInvalid);
    }
  }

  function handleCancelImport() {
    setPendingImport(null);
  }

  function handleRequestReset(resetType) {
    setPendingResetType(resetType === "logout" ? "logout" : "local");
  }

  function handleCancelReset() {
    if (resetPending) return;
    setPendingResetType("");
  }

  async function handleConfirmReset() {
    if (!pendingResetType || resetPending) return;
    setResetPending(true);
    await runLocalDataReset({
      includeLogout: pendingResetType === "logout",
      signOut,
      reload: reloadApp,
    });
  }

  return (
    <AppScreen
      data={safeData}
      pageId="data"
      headerTitle="Données"
      headerSubtitle="Exporter ou réimporter l’état complet de l’app."
      headerRight={typeof onBack === "function" ? <AppBackButton onClick={onBack} /> : null}
    >
      <section className="mainPageSection">
        <SectionHeader title="Sauvegarde" subtitle="Exporte ou importe l’état complet de l’app." />
        <div className="mainPageSectionBody">
          <AppCard>
            <div className="col gap12">
              <AppActionRow>
                <PrimaryButton
                  onClick={() => {
                    if (!premium) {
                      if (typeof onOpenPaywall === "function") onOpenPaywall("Export des données");
                      return;
                    }
                    downloadJsonFile("discip-yourself-data.json", safeData);
                  }}
                >
                  Exporter mes données (JSON)
                </PrimaryButton>

                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
                    handleImportFile(file);
                    event.target.value = "";
                  }}
                />

                <GhostButton
                  size="sm"
                  onClick={() => {
                    importInputRef.current?.click();
                  }}
                >
                  Importer un fichier JSON
                </GhostButton>
              </AppActionRow>

              {importStatus ? (
                <FeedbackMessage tone={importStatus === STATUS_COPY.importDone ? "success" : "error"}>
                  {importStatus}
                </FeedbackMessage>
              ) : null}
            </div>
          </AppCard>
        </div>
      </section>
      {showLocalResetControls ? (
        <DataLocalResetSection onRequestReset={handleRequestReset} />
      ) : null}
      <AppDialog open={Boolean(pendingImport)} onClose={handleCancelImport} maxWidth={440}>
        <div className="col gap16" data-testid="data-import-confirmation">
          <div className="col gap6">
            <div className="titleSm">{DATA_IMPORT_CONFIRM_COPY.title}</div>
            <div className="small2 textMuted">{DATA_IMPORT_CONFIRM_COPY.text}</div>
            {pendingImport?.fileName ? (
              <div className="small2 textMuted">Fichier : {pendingImport.fileName}</div>
            ) : null}
          </div>
          <AppActionRow>
            <GhostButton type="button" onClick={handleCancelImport}>
              {DATA_IMPORT_CONFIRM_COPY.secondary}
            </GhostButton>
            <PrimaryButton type="button" onClick={handleConfirmImport}>
              {DATA_IMPORT_CONFIRM_COPY.cta}
            </PrimaryButton>
          </AppActionRow>
        </div>
      </AppDialog>
      <AppDialog open={Boolean(pendingResetType)} onClose={handleCancelReset} maxWidth={440}>
        <DataLocalResetConfirmationContent
          resetType={pendingResetType}
          pending={resetPending}
          onCancel={handleCancelReset}
          onConfirm={handleConfirmReset}
        />
      </AppDialog>
    </AppScreen>
  );
}
