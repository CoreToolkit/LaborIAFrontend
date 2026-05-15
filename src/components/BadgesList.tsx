import React from "react";
import { UserBadge } from "@/types/interviewReport";

interface BadgesListProps {
  badges: UserBadge[];
  isLoading?: boolean;
}

export function BadgesList({ badges, isLoading = false }: BadgesListProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-base font-semibold text-slate-900">Mis Badges</h2>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : badges.length === 0 ? (
        <p className="text-sm text-slate-500">No hay badges disponibles todavía.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {badges.map((badge) =>
            badge.is_unlocked ? (
              <div
                key={badge.id}
                className="flex flex-col items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center"
              >
                <span className="text-4xl">{badge.icon}</span>
                <p className="text-xs font-semibold text-slate-900 leading-snug">{badge.name}</p>
                <p className="text-[11px] text-slate-500 leading-snug">{badge.description}</p>
              </div>
            ) : (
              <div
                key={badge.id}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center"
              >
                <span className="text-4xl grayscale opacity-40">{badge.icon}</span>
                <p className="text-xs font-semibold text-slate-400 leading-snug">{badge.name}</p>
                <div className="w-full mt-1">
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    {/* eslint-disable-next-line react/forbid-component-props */}
                    <div className="h-full rounded-full bg-blue-400 transition-all duration-500" style={{ width: `${Math.round(badge.progress * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {Math.round(badge.progress * 100)}%
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}
