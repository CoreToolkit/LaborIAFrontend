import Link from "next/link";
import { AlertCircle, RefreshCw, Clock, ChevronRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvaluationHistoryItem } from "@/types/interviewReport";
import { cn } from "@/utils/cn";

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Fecha desconocida";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Ahora mismo";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} día${days > 1 ? "s" : ""}`;
  const weeks = Math.floor(days / 7);
  return `Hace ${weeks} semana${weeks > 1 ? "s" : ""}`;
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-blue-600";
  return "text-red-500";
}

function scoreBg(score: number | null): string {
  if (score === null) return "bg-slate-100";
  if (score >= 75) return "bg-emerald-50 border-emerald-100";
  if (score >= 50) return "bg-blue-50 border-blue-100";
  return "bg-red-50 border-red-100";
}

function truncate(text: string | null, max = 80): string {
  if (!text) return "Pregunta sin texto";
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

function ActivityItem({ item }: { item: EvaluationHistoryItem }) {
  const content = (
    <div className={cn(
      "flex items-center gap-4 rounded-xl border p-4 transition-colors border-slate-100 bg-white",
      item.session_id ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"
    )}>
      <div className={cn(
        "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border text-sm font-bold",
        scoreBg(item.score),
        scoreColor(item.score)
      )}>
        {item.score !== null ? Math.round(item.score) : "—"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{truncate(item.question_text)}</p>
        <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
          <Clock className="h-3 w-3" />
          {relativeTime(item.completed_at)}
        </div>
      </div>
      {item.session_id && <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />}
    </div>
  );

  if (item.session_id) {
    return <Link href={`/interview-report/${item.session_id}`} className="block">{content}</Link>;
  }
  return content;
}

function RecentActivityFeedSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm animate-pulse">
      <div className="h-5 w-44 rounded bg-slate-200 mb-1" />
      <div className="h-3 w-52 rounded bg-slate-100 mb-5" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-100 p-4">
            <div className="h-11 w-11 rounded-full bg-slate-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-full rounded bg-slate-200" />
              <div className="h-2 w-24 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
        <Activity className="h-7 w-7 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600">Sin actividad reciente</p>
      <p className="text-xs text-slate-400 mt-1">
        Completa tu primera entrevista para ver tu historial aquí
      </p>
    </div>
  );
}

interface RecentActivityFeedProps {
  data: EvaluationHistoryItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function RecentActivityFeed({ data, isLoading, error, onRetry }: RecentActivityFeedProps) {
  if (isLoading) return <RecentActivityFeedSkeleton />;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
        <div className="flex items-start gap-2 text-sm text-red-600 mb-3">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
        <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-100" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="h-4 w-4 text-slate-400" />
        <h3 className="text-base font-semibold text-slate-800">Actividad Reciente</h3>
      </div>
      <p className="text-xs text-slate-400 mb-5">Últimas 5 evaluaciones completadas</p>

      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {data.map((item) => <ActivityItem key={item.evaluation_id} item={item} />)}
        </div>
      )}
    </div>
  );
}
