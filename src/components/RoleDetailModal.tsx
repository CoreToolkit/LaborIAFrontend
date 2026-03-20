import React from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillGapBadge } from "@/components/SkillGapBadge";
import { getRoleDetail } from "@/services/matchingService";
import { RoleDetail, RoleRecommendation } from "@/types/matching";
import { getAccessToken } from "@/utils/session";

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
  const [detail, setDetail] = React.useState<RoleDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadDetail = React.useCallback(async () => {
    if (!roleId || !isOpen) {
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setError("Tu sesion no es valida. Inicia sesion nuevamente.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = await getRoleDetail(roleId, token);
      setDetail(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cargar el detalle del rol.";
      setError(message);
      setDetail(null);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, roleId]);

  React.useEffect(() => {
    if (!isOpen) {
      setDetail(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    void loadDetail();
  }, [isOpen, loadDetail]);

  if (!isOpen) return null;

  const role = detail || fallbackRole;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">Detalle del rol</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Cerrar detalle de rol"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {isLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando detalle del rol...
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p>{error}</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => void loadDetail()}>
                Reintentar
              </Button>
            </div>
          )}

          {role && (
            <>
              <div>
                <h3 className="text-2xl font-semibold text-gray-900">{role.role_name}</h3>
                <p className="mt-2 text-sm text-gray-600">
                  {(detail?.long_description || role.description || "Sin descripcion disponible.").trim()}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Categoria</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{formatLabel(role.category)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Seniority</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{formatLabel(role.seniority_level)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ingles minimo</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{formatLabel(role.min_english_level)}</p>
                </div>
              </div>

              <section>
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Skills requeridas</h4>
                {detail?.required_skills && detail.required_skills.length > 0 ? (
                  <ul className="space-y-2">
                    {detail.required_skills.map((skill) => (
                      <li
                        key={`${role.role_id}-required-${skill.skill_name}`}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                      >
                        <span className="text-sm text-gray-800">{skill.skill_name}</span>
                        <span className="text-xs text-gray-500">
                          {skill.required_level ? `Nivel ${skill.required_level}` : "Nivel por definir"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600">No hay skills requeridas publicadas para este rol.</p>
                )}
              </section>

              <section>
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Brechas detectadas</h4>
                <div className="flex flex-wrap gap-2">
                  {role.skill_gaps.length > 0 ? (
                    role.skill_gaps.map((gap) => (
                      <SkillGapBadge key={`${role.role_id}-gap-${gap.skill_name}`} gap={gap} />
                    ))
                  ) : (
                    <p className="text-sm text-gray-600">No hay brechas criticas para este rol.</p>
                  )}
                </div>
              </section>

              <section>
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Tecnologias sugeridas</h4>
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
                  <p className="text-sm text-gray-600">No hay tecnologias publicadas para este rol.</p>
                )}
              </section>
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-gray-200 bg-white px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            onClick={() => {
              if (roleId) {
                onStartInterview(roleId);
              }
            }}
            disabled={!roleId}
          >
            Start Interview
          </Button>
        </div>
      </div>
    </div>
  );
}
