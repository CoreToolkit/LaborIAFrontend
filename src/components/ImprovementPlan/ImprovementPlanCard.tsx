import React from "react";
import { ImprovementPlanItem, ImprovementPlanPriority, ImprovementPlanStatus } from "@/types/improvementPlan";

const PRIORITY_CONFIG: Record<ImprovementPlanPriority, { label: string; className: string }> = {
  high:   { label: "Alta",  className: "bg-red-100 text-red-700 border border-red-200" },
  medium: { label: "Media", className: "bg-amber-100 text-amber-700 border border-amber-200" },
  low:    { label: "Baja",  className: "bg-slate-100 text-slate-600 border border-slate-200" },
};

const STATUS_CONFIG: Record<ImprovementPlanStatus, { label: string; className: string }> = {
  pending:     { label: "Pendiente",   className: "bg-slate-100 text-slate-500" },
  in_progress: { label: "En progreso", className: "bg-blue-100 text-blue-700" },
  completed:   { label: "Completado",  className: "bg-green-100 text-green-700" },
};

const RESOURCE_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  course:   { label: "Curso",    className: "bg-blue-100 text-blue-700" },
  practice: { label: "Práctica", className: "bg-green-100 text-green-700" },
  article:  { label: "Artículo", className: "bg-purple-100 text-purple-700" },
};

function resourceTypeConfig(type: string) {
  return RESOURCE_TYPE_CONFIG[type] ?? { label: type, className: "bg-slate-100 text-slate-600" };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

interface ImprovementPlanCardProps {
  item: ImprovementPlanItem;
}

export function ImprovementPlanCard({ item }: ImprovementPlanCardProps) {
  const progress = item.target_score > 0
    ? Math.min(Math.round((item.current_score / item.target_score) * 100), 100)
    : 0;

  const priority = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.low;
  const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;

  const barColor = item.status === "completed"
    ? "bg-green-500"
    : item.status === "in_progress"
    ? "bg-blue-500"
    : "bg-slate-300";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 leading-tight">{item.skill}</h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${priority.className}`}>
            {priority.label}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${status.className}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500">Progreso</span>
          <span className="text-xs font-semibold text-slate-700">
            {Math.round(item.current_score)} / {Math.round(item.target_score)}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          {/* eslint-disable-next-line react/forbid-component-props */}
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-slate-400 text-right">{progress}%</p>
      </div>

      {/* Completed date */}
      {item.completed_at && (
        <p className="text-[11px] text-green-600 font-medium">
          ✓ Completado el {formatDate(item.completed_at)}
        </p>
      )}

      {/* Why improve this */}
      <div className="rounded-lg border px-3 py-2.5 space-y-1 bg-blue-50 border-blue-100">
        <p className="text-[11px] font-semibold text-slate-700">¿Por qué mejorar esto?</p>
        {item.ai_feedback ? (
          <p className="text-[11px] text-blue-700 leading-relaxed">{item.ai_feedback}</p>
        ) : (
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Completa más entrevistas para recibir feedback personalizado.
          </p>
        )}
      </div>

      {/* Resources */}
      {item.resources.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Recursos recomendados</p>
          <ul className="flex flex-col gap-1.5">
            {item.resources.map((r, i) => {
              const rType = resourceTypeConfig(r.type);
              return (
                <li key={i} className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${rType.className}`}>
                    {rType.label}
                  </span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline truncate"
                  >
                    {r.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
