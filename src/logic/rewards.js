import { computeGlobalAvgForDay, computeGlobalAvgForWeek, computeStreakDays } from "./habits";

export const REWARDS = [
  { id: "rw_lvl_2", title: "Niveau 2", type: "LEVEL", threshold: 2, shareText: "Je viens de passer niveau 2." },
  { id: "rw_lvl_5", title: "Niveau 5", type: "LEVEL", threshold: 5, shareText: "Niveau 5 atteint. Discipline en place." },
  { id: "rw_daily_80", title: "80% aujourd’hui", type: "DAILY_AVG", threshold: 0.8, shareText: "80% aujourd’hui. Je progresse." },
  { id: "rw_weekly_70", title: "70% semaine", type: "WEEKLY_AVG", threshold: 0.7, shareText: "70% cette semaine. Ça devient sérieux." },
  { id: "rw_streak_7", title: "Streak 7 jours", type: "STREAK_DAYS", threshold: 7, shareText: "7 jours de suite. Discipline validée." },
];

export function isRewardUnlocked(reward, data) {
  if (reward.type === "LEVEL") return data.profile.level >= reward.threshold;
  if (reward.type === "DAILY_AVG") return computeGlobalAvgForDay(data, new Date()) >= reward.threshold;
  if (reward.type === "WEEKLY_AVG") return computeGlobalAvgForWeek(data, new Date()) >= reward.threshold;
  if (reward.type === "STREAK_DAYS") return computeStreakDays(data, new Date()) >= reward.threshold;
  return false;
}

export function isRewardClaimed(rewardId, data) {
  return Boolean(data.profile.rewardClaims?.[rewardId]);
}