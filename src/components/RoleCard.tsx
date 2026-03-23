import React from "react";
import { ArrowRight, Briefcase, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatchProgressBar } from "@/components/MatchProgressBar";
import { SkillGapBadge } from "@/components/SkillGapBadge";
import { RoleRecommendation } from "@/types/matching";

interface RoleCardProps {
  role: RoleRecommendation;
  onStartInterview: (roleId: string) => void;
  onViewDetail: (roleId: string) => void;
}

const toCategoryLabel = (category: string): string => {
  return category.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export function RoleCard({ role, onStartInterview, onViewDetail }: RoleCardProps) {
  const topSkillGaps = role.skill_gaps ? [...role.skill_gaps]
    .sort((a, b) => b.importance_weight - a.importance_weight)
    .slice(0, 3) : [];

  return (
    <article
      className="group rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-border"
      role="button"
      tabIndex={0}
      onClick={() => onViewDetail(role.role_id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onViewDetail(role.role_id);
        }
      }}
      aria-label={`Ver detalle de ${role.role_name}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{role.role_name}</h3>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Briefcase className="h-4 w-4" />
            <span>{toCategoryLabel(role.category)}</span>
            {role.seniority_level && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-foreground font-medium">
                {role.seniority_level}
              </span>
            )}
          </div>
        </div>
        <Eye className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
      </div>

      <div className="mb-4">
        <MatchProgressBar score={role.total_score} />
      </div>

      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Top Skill Gaps
        </p>
        <div className="flex flex-wrap gap-2">
          {topSkillGaps.length > 0 ? (
            topSkillGaps.map((gap) => (
              <SkillGapBadge
                key={`${role.role_id}-${gap.skill_name}-${gap.importance_weight}`}
                gap={gap}
              />
            ))
          ) : (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Sin brechas críticas detectadas
            </span>
          )}
        </div>
      </div>

      <Button
        className="w-full"
        onClick={(event) => {
          event.stopPropagation();
          onStartInterview(role.role_id);
        }}
      >
        Start Interview Preparation
        <ArrowRight className="h-4 w-4" />
      </Button>
    </article>
  );
}
