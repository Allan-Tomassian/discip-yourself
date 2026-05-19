export const COMMAND_TONES = Object.freeze([
  "neutral",
  "execution",
  "ai",
  "attention",
  "critical",
  "disabled",
  "offline",
]);

const COMMAND_TONE_SET = new Set(COMMAND_TONES);

export function normalizeCommandTone(tone) {
  return COMMAND_TONE_SET.has(tone) ? tone : "neutral";
}

export function commandToneClassName(base, tone) {
  return `${base}--tone-${normalizeCommandTone(tone)}`;
}
