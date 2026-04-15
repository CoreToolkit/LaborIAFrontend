import React from "react";
import { AlertTriangle } from "lucide-react";
import { SkillGap } from "@/types/matching";
import { cn } from "@/utils/cn";

interface SkillGapBadgeProps {
  gap: SkillGap;
}

const getToneClass = (importanceWeight: number): string => {
  if (importanceWeight >= 8) return "border-red-200 bg-red-50 text-red-700";
  if (importanceWeight >= 5) return "border-amber-200 bg-amber-50 text-amber-700";

  return "border-blue-200 bg-blue-50 text-blue-700";
};

const getLabel = (importanceWeight: number): string => {
  if (importanceWeight >= 8) return "Alta";
  if (importanceWeight >= 5) return "Media";

  return "Baja";
};

export function SkillGapBadge({ gap }: SkillGapBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        getToneClass(gap.importance_weight)
      )}
      title={`Importancia ${getLabel(gap.importance_weight)} (${gap.importance_weight})`}
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      {gap.skill_name}
      <span className="font-semibold">({gap.importance_weight})</span>
    </span>
  );
}
