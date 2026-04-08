import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CREATE_MENU_COPY } from "../../ui/labels";

function resolveMenuStyle(anchorRect) {
  if (typeof window === "undefined") {
    return { right: 24, bottom: 104, width: 320 };
  }

  const width = Math.min(344, window.innerWidth - 32);
  if (!anchorRect) {
    return { right: 24, bottom: 104, width };
  }

  const top = Math.min(anchorRect.bottom + 10, window.innerHeight - 248);
  const left = Math.max(16, Math.min(anchorRect.right - width, window.innerWidth - width - 16));
  return { top, left, width };
}

export default function LovableCreateMenu({
  open = false,
  anchorRect = null,
  onClose,
  onSubmitCapture,
  onResumeDraft,
  hasDraft = false,
}) {
  const menuStyle = useMemo(() => resolveMenuStyle(anchorRect), [anchorRect]);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef(null);

  const handleSubmit = useCallback(() => {
    const normalizedDraft = draft.trim();
    if (!normalizedDraft) return;
    onSubmitCapture?.(normalizedDraft);
    setDraft("");
  }, [draft, onSubmitCapture]);

  useEffect(() => {
    if (!open) {
      setDraft("");
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSubmit, onClose, open]);

  if (!open) return null;

  return (
    <div className="lovableMenuOverlay" role="presentation">
      <div className="lovableMenuBackdrop" onClick={() => onClose?.()} />
      <div
        className="lovableMenu lovableCaptureMenu"
        data-testid="universal-capture-surface"
        style={menuStyle}
        role="dialog"
        aria-modal="true"
        aria-label={CREATE_MENU_COPY.menuAriaLabel}
      >
        <label className="lovableCapturePrompt" htmlFor="lovable-universal-capture-input">
          {CREATE_MENU_COPY.promptTitle}
        </label>
        <textarea
          ref={textareaRef}
          id="lovable-universal-capture-input"
          className="lovableCaptureTextarea"
          data-testid="universal-capture-input"
          placeholder={CREATE_MENU_COPY.inputPlaceholder}
          value={draft}
          rows={3}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="lovableCaptureFooter">
          {hasDraft && !draft.trim() ? (
            <button
              type="button"
              className="lovableCaptureResume"
              data-testid="universal-capture-resume-draft"
              onClick={() => onResumeDraft?.()}
            >
              <span className="lovableCaptureResumeLabel">{CREATE_MENU_COPY.resumeDraftLabel}</span>
              <span className="lovableCaptureResumeMeta">{CREATE_MENU_COPY.resumeDraftMeta}</span>
            </button>
          ) : (
            <span className="lovableCaptureSpacer" aria-hidden="true" />
          )}
          <button
            type="button"
            className="lovableCaptureSubmit"
            data-testid="universal-capture-submit"
            onClick={handleSubmit}
            disabled={!draft.trim()}
          >
            {CREATE_MENU_COPY.submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
