import React from "react";
import { AppSheet, GhostButton, PrimaryButton } from "../../shared/ui/app";

function ArtifactBlock({ block }) {
  if (!block) return null;
  if (block.type === "list") {
    return (
      <div className="sessionToolResultBlock">
        {block.title ? <div className="sessionToolResultBlockTitle">{block.title}</div> : null}
        <ul className="sessionToolResultList">
          {block.items.map((item, index) => (
            <li key={`${item}-${index}`} className="sessionToolResultListItem">
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="sessionToolResultBlock">
      {block.title ? <div className="sessionToolResultBlockTitle">{block.title}</div> : null}
      <div className="sessionToolResultParagraph">{block.text}</div>
    </div>
  );
}

export default function SessionToolResultSheet({
  open = false,
  artifact = null,
  loading = false,
  onClose,
  onCopy,
  onRegenerate,
}) {
  return (
    <AppSheet
      open={open}
      onClose={onClose}
      className="sessionToolResultSheet"
      placement="bottom"
      maxWidth={560}
    >
      <div className="sessionToolResultSheetContent" data-testid="session-tool-result">
        <div className="sessionToolResultHeader">
          <div className="sessionToolResultHeaderText">
            <div className="sessionToolResultTitle">{artifact?.title || "Résultat"}</div>
            <div className="sessionToolResultSubtitle">Utilisable tout de suite sans quitter la séance.</div>
          </div>
          <GhostButton type="button" size="sm" onClick={onClose}>
            Fermer
          </GhostButton>
        </div>
        <div className="sessionToolResultBody">
          {(Array.isArray(artifact?.blocks) ? artifact.blocks : []).map((block, index) => (
            <ArtifactBlock key={`${block?.title || block?.type || "block"}-${index}`} block={block} />
          ))}
        </div>
        <div className="sessionToolResultActions">
          <PrimaryButton type="button" className="sessionToolResultPrimary" onClick={onCopy}>
            Copier
          </PrimaryButton>
          <GhostButton type="button" className="sessionToolResultSecondary" onClick={onRegenerate} disabled={loading}>
            Régénérer
          </GhostButton>
        </div>
      </div>
    </AppSheet>
  );
}

