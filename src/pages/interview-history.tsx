import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  AlertCircle,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  BarChart3,
  Clock3,
  Award,
  Loader2,
  CircleSlash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/Layout";
import PrivateRoute from "@/components/PrivateRoute";
import { getInterviewReportsHistory } from "@/services/interviewReportService";
import { InterviewReportSummary } from "@/types/interviewReport";
import { getAccessToken } from "@/utils/session";

type HistoryStatCardProps = {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
};

const scoreColor = (score: number | null): string => {
  if (score === null) return "text-slate-400";
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
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
};

const getTrendIcon = (trend?: string) => {
  if (trend === "improved") return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (trend === "declined") return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-slate-400" />;
};

function StatusInline({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex min-w-[84px] flex-col items-center justify-center text-center leading-none">
        <div className="flex items-center gap-1.5 text-sm font-medium text-[#616161]">
          <CircleSlash2 className="h-3.5 w-3.5 shrink-0" />
          <span>--</span>
        </div>
        <span className="mt-1 text-[11px] font-medium text-[#616161]">Sin datos</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-[84px] flex-col items-center justify-center text-center leading-none">
      <div className="flex items-center gap-1.5 text-sm font-medium text-[#1A237E]">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span>{Math.round(score)}</span>
      </div>
      <span className="mt-1 text-[11px] font-medium text-[#616161]">En progreso</span>
    </div>
  );
}

function HistoryStatCard({ label, value, description, icon }: HistoryStatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  );
}

function InterviewHistoryContent() {
  const router = useRouter();
  const [reports, setReports] = React.useState<InterviewReportSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const scoredReports = React.useMemo(
    () => reports.filter((report) => report.session_score !== null),
    [reports]
  );

  const averageScore = React.useMemo(() => {
    if (scoredReports.length === 0) return null;

    const sum = scoredReports.reduce((accumulator, report) => accumulator + (report.session_score ?? 0), 0);
    return Math.round(sum / scoredReports.length);
  }, [scoredReports]);

  const latestReport = reports[0] ?? null;
  const completedReports = React.useMemo(
    () => reports.filter((report) => report.completed_questions > 0).length,
    [reports]
  );

  React.useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      setError(null);

      const token = getAccessToken();
      if (!token) {
        setError("Sesión expirada. Inicia sesión nuevamente.");
        setIsLoading(false);
        return;
      }

      try {
        const data = await getInterviewReportsHistory(token);
        setReports(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : "No se pudo cargar el historial de reportes."
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadHistory();
  }, []);

  return (
    <>
      <Head>
        <title>Historial de Reportes - LaborIA</title>
        <meta
          name="description"
          content="Revisa el historial completo de tus reportes de entrevista"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <DashboardLayout>
        <div className="space-y-8">
          <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50 px-6 py-8 shadow-sm">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">
                    Entrevistas
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    Historial de Reportes
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    Revisa tus entrevistas finalizadas, tu evolución y el detalle de cada sesión.
                  </p>
                </div>

                <Button
                  onClick={() => router.push("/interviewPageEnter")}
                  className="w-fit gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Nueva entrevista
                </Button>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HistoryStatCard
              label="Reportes totales"
              value={String(reports.length)}
              description="Sesiones finalizadas disponibles en tu historial"
              icon={<BarChart3 className="h-5 w-5" />}
            />
            <HistoryStatCard
              label="Con score"
              value={String(scoredReports.length)}
              description="Reportes que ya tienen evaluación completa"
              icon={<Award className="h-5 w-5" />}
            />
            <HistoryStatCard
              label="Promedio"
              value={averageScore !== null ? `${averageScore}%` : "--"}
              description="Promedio de score entre los reportes evaluados"
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <HistoryStatCard
              label="Última sesión"
              value={latestReport ? `#${latestReport.session_id}` : "--"}
              description={latestReport ? formatDate(latestReport.session_created_at) : "Sin sesiones"}
              icon={<Clock3 className="h-5 w-5" />}
            />
          </section>

          <main>
            {isLoading && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-600" />
                <p className="text-slate-600">Cargando historial de reportes...</p>
              </div>
            )}

            {!isLoading && error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                  <div>
                    <p className="font-semibold text-red-900">No pudimos cargar tu historial</p>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => window.location.reload()}
                    >
                      Reintentar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!isLoading && !error && reports.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FileText className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900">Aún no tienes reportes</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Cuando completes tu primera entrevista, el reporte aparecerá aquí.
                </p>
                <Button className="mt-5 gap-2" onClick={() => router.push("/interviewPageEnter")}>
                  <FileText className="h-4 w-4" />
                  Realizar tu primera entrevista
                </Button>
              </div>
            )}

            {!isLoading && !error && reports.length > 0 && (
              <div className="space-y-3">
                {reports.map((report) => {
                  const hasScore = report.session_score !== null;
                  const completionLabel = `${report.completed_questions}/${report.total_questions} preguntas`;

                  return (
                    <button
                      key={report.session_id}
                      type="button"
                      onClick={() => router.push(`/interview-report/${report.session_id}`)}
                      className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              Sesión #{report.session_id}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatDate(report.session_created_at)}
                            </span>
                            {report.trend && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                {getTrendIcon(report.trend)}
                                <span className="capitalize">{report.trend}</span>
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                            <span>{completionLabel}</span>
                            <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />
                            <span>{hasScore ? scoreLabel(report.session_score) : "Sin evaluación"}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <StatusInline score={report.session_score} />
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition-colors group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700">
                            <ChevronRight className="h-5 w-5" />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </DashboardLayout>
    </>
  );
}

export default function InterviewHistoryPage() {
  return (
    <PrivateRoute>
      <InterviewHistoryContent />
    </PrivateRoute>
  );
}
