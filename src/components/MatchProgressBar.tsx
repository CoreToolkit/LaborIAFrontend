import React from "react";
import { Info } from "lucide-react";
import { matchingFactorsExplanation } from "@/services/matchingService";
import { cn } from "@/utils/cn";

interface MatchProgressBarProps {
  score: number;
}

const getToneClass = (score: number): string => {
  if (score < 50) return "bg-red-500";
  if (score <= 75) return "bg-amber-500";

  return "bg-emerald-500";
};

const getLabelClass = (score: number): string => {
  if (score < 50) return "text-red-700 bg-red-50 border-red-200";
  if (score <= 75) return "text-amber-700 bg-amber-50 border-amber-200";

  return "text-emerald-700 bg-emerald-50 border-emerald-200";
};

const getLabel = (score: number): string => {
  if (score < 50) return "Bajo";
  if (score <= 75) return "Medio";

  return "Alto";
};

export function MatchProgressBar({ score }: MatchProgressBarProps) {
  const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);
  const clampedScore = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  const shownScore = Number(clampedScore.toFixed(1));
  const filledSegments = Math.max(0, Math.min(20, Math.round((clampedScore / 100) * 20)));
  const toneClass = getToneClass(clampedScore);
  const tooltipText = matchingFactorsExplanation;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {`${shownScore}% Match`}
          </span>
          <div
            className="relative"
            onMouseEnter={() => setIsTooltipOpen(true)}
            onMouseLeave={() => setIsTooltipOpen(false)}
          >
            <button
              type="button"
              aria-label="Explicacion del match score"
              onClick={() => setIsTooltipOpen((prev) => !prev)}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Info className="h-4 w-4" />
            </button>
            {isTooltipOpen && (
              <div className="absolute left-0 top-8 z-20 w-72 rounded-lg border border-border bg-card p-3 text-xs text-foreground shadow-lg">
                {tooltipText}
              </div>
            )}
          </div>
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs font-semibold",
            getLabelClass(clampedScore)
          )}
        >
          {getLabel(clampedScore)}
        </span>
      </div>

      <div className="w-full rounded-full bg-muted p-1">
        <div className="flex gap-1">
          {Array.from({ length: 20 }).map((_, index) => (
            <span
              // Index-based segment rendering avoids inline-width styles.
              key={`segment-${index}`}
              className={cn(
                "h-2 flex-1 rounded-full",
                index < filledSegments ? toneClass : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
