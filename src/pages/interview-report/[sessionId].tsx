import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Minus,
  Star,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/Layout";
import PrivateRoute from "@/components/PrivateRoute";
import { getInterviewReport, NotFoundError } from "@/services/interviewReportService";
import {
  InterviewReportResponse,
  QuestionEvaluation,
  BadgeUnlocked,
  SessionComparison,
} from "@/types/interviewReport";
import { getAccessToken } from "@/utils/session";

// ─── helpers ──────────────────────────────────────────────────────────────────

const scoreColor = (score: number | null): string => {
  if (score === null) return "text-slate-500";
  return "text-[#1A237E]";
};

const scoreLabel = (score: number | null): string => {
  if (score === null) return "Sin datos";
  if (score >= 70) return "Excelente";
  if (score >= 50) return "En progreso";
  return "Necesita mejorar";
};

const formatDate = (raw: string): string => {
  try {
    return new Date(raw).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
};

// ─── subcomponents ────────────────────────────────────────────────────────────

interface BreakdownBarProps {
  label: string;
  value: number;
}

function BreakdownBar({ label, value }: BreakdownBarProps) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="capitalize text-slate-600">{label}</span>
        <span className="font-medium text-slate-500">{value}%</span>
      </div>
      <progress
        className="h-1.5 w-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-blue-600 [&::-moz-progress-bar]:bg-blue-600"
        max={100}
        value={safe}
        aria-label={`${label}: ${value}%`}
      />
    </div>
  );
}

function EvaluationCard({ evaluation, index }: { evaluation: QuestionEvaluation; index: number }) {
  const [expanded, setExpanded] = React.useState(false);
  const { score_breakdown, topics_covered, topics_missing } = evaluation;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pregunta {index + 1} · {evaluation.category} · {evaluation.difficulty}
          </p>
          <p className="text-sm leading-relaxed text-slate-900">{evaluation.question_text}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className={`text-2xl font-bold ${scoreColor(evaluation.score)}`}>
            {Math.round(evaluation.score)}
          </span>
          <span className="ml-0.5 text-xs text-slate-500">/100</span>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-700">{evaluation.feedback}</p>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
      >
        {expanded ? "Ocultar detalles" : "Ver desglose"}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Breakdown bars */}
          <div className="space-y-2">
            <BreakdownBar label="Corrección" value={score_breakdown.correctness} />
            <BreakdownBar label="Completitud" value={score_breakdown.completeness} />
            <BreakdownBar label="Claridad" value={score_breakdown.clarity} />
            <BreakdownBar label="Ejemplos" value={score_breakdown.examples} />
          </div>

          {/* Topics */}
          {(topics_covered.length > 0 || topics_missing.length > 0) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {topics_covered.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Temas cubiertos
                  </p>
                  <ul className="space-y-1">
                    {topics_covered.map((t) => (
                      <li key={t} className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs text-slate-700">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {topics_missing.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-red-700">
                    <XCircle className="h-3.5 w-3.5" /> Temas faltantes
                  </p>
                  <ul className="space-y-1">
                    {topics_missing.map((t) => (
                      <li key={t} className="rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-xs text-slate-700">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function ComparisonSection({ comparison }: { comparison: SessionComparison }) {
  if (comparison.trend === "first_session") {
    return (
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
        <p className="text-sm font-semibold text-blue-900">¡Esta es tu primera sesión!</p>
        <p className="mt-1 text-xs text-slate-600">Completa más entrevistas para ver tu progreso.</p>
      </div>
    );
  }

  if (!comparison.has_previous || comparison.previous_score === null) {
    return null;
  }

  const improvement = comparison.improvement ?? 0;
  const improved = improvement > 0;
  const declined = improvement < 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Comparación con sesión anterior
      </p>
      <div className="flex items-center gap-6">
        <div>
          <p className="text-xs text-slate-500">Anterior</p>
          <p className="text-2xl font-bold text-slate-900">{Math.round(comparison.previous_score)}</p>
        </div>
        <div className="flex items-center gap-1">
          {improved && <ArrowUp className="h-5 w-5 text-emerald-600" />}
          {declined && <ArrowDown className="h-5 w-5 text-red-600" />}
          {!improved && !declined && <Minus className="h-5 w-5 text-slate-400" />}
          <span
            className={`text-xl font-bold ${improved ? "text-emerald-600" : declined ? "text-red-600" : "text-slate-500"}`}
          >
            {improved ? "+" : ""}{Math.round(improvement)}
          </span>
        </div>
        <div>
          <p className="text-xs text-slate-500">Esta sesión</p>
          <p className={`text-2xl font-bold ${improved ? "text-emerald-600" : declined ? "text-red-600" : "text-slate-900"}`}>
            {comparison.trend === "stable" ? "=" : ""}
          </p>
        </div>
      </div>
      {comparison.trend === "improved" && (
        <p className="mt-2 text-xs text-emerald-700">Mejoraste respecto a tu sesión anterior.</p>
      )}
      {comparison.trend === "declined" && (
        <p className="mt-2 text-xs text-red-700">Bajaste respecto a tu sesión anterior. ¡Sigue practicando!</p>
      )}
      {comparison.trend === "stable" && (
        <p className="mt-2 text-xs text-slate-600">Mantuviste el mismo nivel que tu sesión anterior.</p>
      )}
    </div>
  );
}

function BadgesSection({ badges }: { badges: BadgeUnlocked[] }) {
  if (badges.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
        <Star className="h-4 w-4 text-blue-600" />
        Badges desbloqueados
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm"
          >
            <span className="text-3xl flex-shrink-0">{badge.icon}</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{badge.name}</p>
              <p className="mt-0.5 text-xs text-slate-600">{badge.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BadgeUnlockedModal({
  badges,
  onClose,
}: {
  badges: BadgeUnlocked[];
  onClose: () => void;
}) {
  if (badges.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* sparkle decoration */}
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 shadow-lg text-2xl">
          🏅
        </div>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-500 mb-1">
            ¡Logro desbloqueado!
          </p>
          <h2 className="text-xl font-bold text-slate-900">Badge Unlocked!</h2>
        </div>

        <div className="mt-6 space-y-3">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className="flex items-center gap-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-left"
            >
              <span className="text-4xl">{badge.icon}</span>
              <div>
                <p className="text-sm font-bold text-slate-900">{badge.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{badge.description}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          ¡Genial!
        </button>
      </div>
    </div>
  );
}

// ─── page ──────────────────────────────────────────────────────────────────────

function InterviewReportContent() {
  const router = useRouter();
  const rawId = router.isReady ? router.query.sessionId : undefined;
  const sessionId = typeof rawId === "string" ? parseInt(rawId, 10) : NaN;

  const [report, setReport] = React.useState<InterviewReportResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isNotFound, setIsNotFound] = React.useState(false);
  const [showBadgeModal, setShowBadgeModal] = React.useState(false);

  React.useEffect(() => {
    if (!router.isReady || Number.isNaN(sessionId)) {
      return;
    }

    try {
      sessionStorage.setItem("last_interview_report_id", String(sessionId));
    } catch {
      // ignore
    }
  }, [router.isReady, sessionId]);

  React.useEffect(() => {
    if (!router.isReady) return;

    if (isNaN(sessionId)) {
      setIsNotFound(true);
      setIsLoading(false);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setError("Sesión expirada. Inicia sesión nuevamente.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setIsNotFound(false);
      try {
        const data = await getInterviewReport(sessionId, token);
        if (!cancelled) {
          setReport(data);
          if (data.badges_unlocked.length > 0) setShowBadgeModal(true);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof NotFoundError) {
          setIsNotFound(true);
        } else {
          setError(
            err instanceof Error && err.message.trim()
              ? err.message.trim()
              : "No se pudo cargar el reporte."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [router.isReady, sessionId]);

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-24 gap-4 shadow-sm">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-slate-600">Cargando tu reporte...</p>
        </div>
      );
    }

    if (isNotFound) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-24 gap-4 text-center shadow-sm">
          <AlertCircle className="h-10 w-10 text-slate-400" />
          <p className="text-lg font-semibold text-slate-900">Sesión no encontrada</p>
          <p className="text-sm text-slate-600">No existe un reporte para esta sesión.</p>
          <Button variant="outline" onClick={() => void router.push("/dashboard")} className="mt-2">
            Volver al dashboard
          </Button>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-white py-24 gap-4 text-center shadow-sm">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <p className="max-w-md text-slate-700">{error}</p>
          <Button variant="outline" onClick={() => void router.reload()} className="mt-2">
            Reintentar
          </Button>
        </div>
      );
    }

    if (!report) return null;

    return (
      <div className="space-y-8">
        {/* Score + meta */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="col-span-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Score de la sesión
            </p>
            <div className="flex items-end gap-2">
              <span className={`text-6xl font-bold ${scoreColor(report.session_score)}`}>
                {report.session_score !== null ? Math.round(report.session_score) : "--"}
              </span>
              <span className="mb-2 text-lg text-slate-400">/100</span>
            </div>
            <p className={`mt-1 text-sm font-medium ${scoreColor(report.session_score)}`}>
              {scoreLabel(report.session_score)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Preguntas
            </p>
            <p className="text-3xl font-bold text-slate-900">
              {report.completed_questions}
              <span className="text-lg font-normal text-slate-500"> / {report.total_questions}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">completadas</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fecha
            </p>
            <p className="text-sm leading-relaxed text-slate-700">
              {formatDate(report.session_created_at)}
            </p>
          </div>
        </div>

        {/* Comparison */}
        <ComparisonSection comparison={report.comparison} />

        {/* Badges */}
        <BadgesSection badges={report.badges_unlocked} />

        {/* Per-question feedback */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Feedback por pregunta
          </h2>
          {report.evaluations.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
              No hay evaluaciones disponibles para esta sesión.
            </p>
          ) : (
            <div className="space-y-4">
              {report.evaluations.map((ev, i) => (
                <EvaluationCard key={ev.evaluation_id} evaluation={ev} index={i} />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Reporte de Entrevista - LaborIA</title>
        <meta name="description" content="Reporte detallado de tu sesión de entrevista en LaborIA" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <button
                  type="button"
                  onClick={() => void router.push("/dashboard")}
                  className="inline-flex items-center gap-2 font-medium text-slate-600 transition-colors hover:text-blue-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </button>
                <span className="text-slate-300">/</span>
                <span className="font-semibold text-slate-900">Reporte de entrevista</span>
              </div>
              {report && (
                <span className="text-xs font-medium text-slate-500">Sesión #{report.session_id}</span>
              )}
            </div>
          </section>

          {renderBody()}
        </div>
      </DashboardLayout>

      {report && (
        <BadgeUnlockedModal
          badges={showBadgeModal ? report.badges_unlocked : []}
          onClose={() => setShowBadgeModal(false)}
        />
      )}
    </>
  );
}

export default function InterviewReportPage() {
  return (
    <PrivateRoute>
      <InterviewReportContent />
    </PrivateRoute>
  );
}
