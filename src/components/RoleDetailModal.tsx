import React from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillGapBadge } from "@/components/SkillGapBadge";
import { RoleRecommendation } from "@/types/matching";
import { useRoleDetail } from "@/hooks/useRoleDetail";

interface RoleDetailModalProps {
  isOpen: boolean;
  roleId: string | null;
  fallbackRole: RoleRecommendation | null;
  onClose: () => void;
  onStartInterview: (roleId: string) => void;
}

const formatLabel = (value: string | null | undefined): string => {
  if (!value) return "No definido";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export function RoleDetailModal({
  isOpen,
  roleId,
  fallbackRole,
  onClose,
  onStartInterview,
}: RoleDetailModalProps) {
  const { detail, isLoading, error, reload } = useRoleDetail(roleId, isOpen);

  if (!isOpen) return null;

  const role = detail || fallbackRole;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white shadow-xl flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex-shrink-0 sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">Detalle del rol</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar detalle de rol"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-6 px-6 py-5">
            {isLoading && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando detalle del rol...
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p>{error}</p>
                <Button className="mt-3" size="sm" variant="outline" onClick={() => void reload()}>
                  Reintentar
                </Button>
              </div>
            )}

            {role && (
              <>
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">{role.role_name}</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {(detail?.long_description || role.description || "Sin descripcion disponible.").trim()}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{formatLabel(role.category)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seniority</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{formatLabel(role.seniority_level)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ingles minimo</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{formatLabel(role.min_english_level)}</p>
                  </div>
                </div>

                <section>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Skills requeridas</h4>
                  {detail?.required_skills && detail.required_skills.length > 0 ? (
                    <ul className="space-y-2">
                      {detail.required_skills.map((skill) => (
                        <li
                          key={`${role.role_id}-required-${skill.skill_name}`}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                        >
                          <span className="text-sm text-slate-800">{skill.skill_name}</span>
                          <span className="text-xs text-slate-500">
                            {skill.required_level ? `Nivel ${skill.required_level}` : "Nivel por definir"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-600">No hay skills requeridas publicadas para este rol.</p>
                  )}
                </section>

                <section>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Brechas detectadas</h4>
                  <div className="flex flex-wrap gap-2">
                    {role.skill_gaps && role.skill_gaps.length > 0 ? (
                      role.skill_gaps.map((gap) => (
                        <SkillGapBadge key={`${role.role_id}-gap-${gap.skill_name}`} gap={gap} />
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">No hay brechas criticas para este rol.</p>
                    )}
                  </div>
                </section>

                <section>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Tecnologias sugeridas</h4>
                  {detail?.required_technologies && detail.required_technologies.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {detail.required_technologies.map((technology) => (
                        <span
                          key={`${role.role_id}-tech-${technology.technology_name}`}
                          className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                        >
                          {technology.technology_name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">No hay tecnologias publicadas para este rol.</p>
                  )}
                </section>
              </>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            onClick={() => { if (roleId) onStartInterview(roleId); }}
            disabled={!roleId}
          >
            Start Interview
          </Button>
        </div>
      </div>
    </div>
  );
}
