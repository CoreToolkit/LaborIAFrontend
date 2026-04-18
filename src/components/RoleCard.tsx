import React from "react";
import { ArrowRight, Briefcase, MoreVertical } from "lucide-react";
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
      className="relative flex flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-blue-600/30 cursor-pointer"
      onClick={() => onViewDetail(role.role_id)}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900">{role.role_name}</h3>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <Briefcase className="h-4 w-4" />
            <span>{toCategoryLabel(role.category)}</span>
            {role.seniority_level && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 font-medium text-xs">
                {role.seniority_level}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label={`Ver detalle de ${role.role_name}`}
          title={`Ver detalle de ${role.role_name}`}
          className="text-slate-400 transition-colors hover:text-slate-600"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetail(role.role_id);
          }}
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-4">
        <MatchProgressBar score={role.total_score} />
      </div>

      <div className="mb-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              Sin brechas críticas detectadas
            </span>
          )}
        </div>
      </div>

      <Button
        className="w-full"
        onClick={(e) => {
          e.stopPropagation();
          onStartInterview(role.role_id);
        }}
      >
        Start Interview Preparation
        <ArrowRight className="h-4 w-4" />
      </Button>
    </article>
  );
}
