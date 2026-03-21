import { useEffect, useState } from "react";

function hasWindow() {
  return typeof window !== "undefined";
}

function readReducedMotionPreference() {
  if (!hasWindow() || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function nextTypingSlice(targetText, currentLength, charsPerTick = 2) {
  const text = typeof targetText === "string" ? targetText : "";
  if (!text) return "";
  const safeStep = Number.isFinite(charsPerTick) && charsPerTick > 0 ? Math.floor(charsPerTick) : 1;
  const nextLength = Math.min(text.length, Math.max(0, currentLength) + safeStep);
  return text.slice(0, nextLength);
}

export function shouldBypassTyping({ enabled, prefersReducedMotion, text }) {
  return !enabled || prefersReducedMotion || !String(text || "");
}

export function useTypingReveal(text, { enabled = true, charsPerTick = 2, intervalMs = 20 } = {}) {
  const targetText = typeof text === "string" ? text : "";
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => readReducedMotionPreference());
  const [displayedText, setDisplayedText] = useState(() =>
    shouldBypassTyping({ enabled, prefersReducedMotion: readReducedMotionPreference(), text: targetText })
      ? targetText
      : ""
  );

  useEffect(() => {
    if (!hasWindow() || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (shouldBypassTyping({ enabled, prefersReducedMotion, text: targetText })) {
      setDisplayedText(targetText);
      return undefined;
    }
    setDisplayedText("");
    let cancelled = false;
    const stepMs = Number.isFinite(intervalMs) && intervalMs > 0 ? Math.floor(intervalMs) : 20;
    const id = window.setInterval(() => {
      if (cancelled) return;
      setDisplayedText((current) => {
        const next = nextTypingSlice(targetText, current.length, charsPerTick);
        if (next.length >= targetText.length) {
          window.clearInterval(id);
        }
        return next;
      });
    }, stepMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [charsPerTick, enabled, intervalMs, prefersReducedMotion, targetText]);

  return displayedText;
}
