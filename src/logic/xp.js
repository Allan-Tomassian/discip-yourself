// XP & Leveling – V2 (scalable, safe, deterministic)

// XP required grows progressively but stays readable
export function xpForNextLevel(level) {
  return Math.round(100 + level * 120 + Math.pow(level, 1.25) * 20);
}

// Central XP grant function
// - supports multipliers (streaks, difficulty, priority)
// - prevents negative XP
// - guarantees deterministic leveling
export function addXp(profile, baseGain, options = {}) {
  const {
    multiplier = 1,
    maxGain = 1000, // safety cap per action
  } = options;

  const safeBase = Math.max(0, baseGain);
  const gain = Math.min(safeBase * multiplier, maxGain);

  let xp = (profile.xp || 0) + gain;
  let level = profile.level || 1;

  while (xp >= xpForNextLevel(level)) {
    xp -= xpForNextLevel(level);
    level += 1;
  }

  return {
    ...profile,
    xp,
    level,
  };
}

// Utility helpers (used later by rewards / objectives)

// Small consistent XP (habits, routine)
// reserved for future use
export function xpRoutine() {
  return 10;
}

// Medium XP (objective progress step)
// reserved for future use
export function xpObjectiveStep() {
  return 25;
}

// Large XP (objective completed)
// reserved for future use
export function xpObjectiveCompleted() {
  return 120;
}
