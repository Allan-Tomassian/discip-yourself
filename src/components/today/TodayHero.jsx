import React from "react";
import { Check } from "lucide-react";
import CommandSurface from "./CommandSurface";

export default function TodayHero({
  modeLabel = "MODE EXÉCUTION",
  dateLabel = "",
  scoreLabel = "--%",
  deltaLabel = "Point de départ",
  statusTitle = "Tu es en contrôle.",
  statusDetail = "Ne casse pas le rythme maintenant.",
  doneBlocksCount = 0,
  plannedBlocksCount = 0,
}) {
  const scoreText = String(scoreLabel || "--%").trim() || "--%";
  const scoreHasPercent = scoreText.endsWith("%");
  const scoreMain = scoreHasPercent ? scoreText.slice(0, -1) : scoreText;
  const safeDone = Number.isFinite(doneBlocksCount) ? Math.max(0, doneBlocksCount) : 0;
  const safeTotal = Number.isFinite(plannedBlocksCount) ? Math.max(0, plannedBlocksCount) : 0;
  const progressTotal = Math.min(Math.max(safeTotal, 0), 4);
  const progressPips = Array.from({ length: progressTotal }, (_, index) => index);
  const progressCopy = safeTotal
    ? `${safeDone} / ${safeTotal} blocs terminés`
    : "Aucun bloc structuré";

  return (
    <CommandSurface className="todayDiagnosticHero" tone="execution" data-testid="today-hero-card">
      <div className="todayHeroTopline">
        <span className="todaySurfaceEyebrow">
          <span className="todaySurfaceDot" aria-hidden="true" />
          {modeLabel}
        </span>
        {dateLabel ? <span className="todayHeroDateCode">{dateLabel}</span> : null}
      </div>

      <div className="todayHeroScoreCluster">
        <div className="todayHeroScore">
          <span className="todayHeroScoreMain">{scoreMain}</span>
          {scoreHasPercent ? <span className="todayHeroScorePercent">%</span> : null}
        </div>
        <div className="todayHeroScoreLabel">Discipline score</div>
        <div className="todayHeroDelta">{deltaLabel}</div>
      </div>

      <div className="todayHeroStatus">
        <h2>{statusTitle}</h2>
        {statusDetail ? <p>{statusDetail}</p> : null}
      </div>

      <div className="todayHeroProgress">
        <div className="todayHeroProgressText">
          <span>Progression du jour</span>
          <strong>{progressCopy}</strong>
        </div>
        {progressPips.length ? (
          <div className="todayHeroProgressRail" aria-hidden="true">
            {progressPips.map((index) => {
              const complete = index < safeDone;
              const active = index === safeDone && safeDone < safeTotal;
              return (
                <span
                  key={index}
                  className={`todayHeroProgressPip${complete ? " is-complete" : ""}${active ? " is-active" : ""}`}
                >
                  {complete ? <Check size={14} strokeWidth={2.3} /> : index + 1}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </CommandSurface>
  );
}
