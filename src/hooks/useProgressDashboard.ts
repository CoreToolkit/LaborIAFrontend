import { useCallback, useEffect, useRef, useState } from "react";
import { getUserMetrics, getMetricsTimeline } from "@/services/metricsService";
import { getRecommendations } from "@/services/matchingService";
import { UserMetricsResponse, TimelinePoint } from "@/types/metrics";
import { RoleRecommendation } from "@/types/matching";
import { BadgeUnlocked } from "@/types/interviewReport";
import { getAccessToken } from "@/utils/session";

// ── Module-level cache (5 min TTL) ───────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry<T> { data: T; ts: number }
const store = new Map<string, CacheEntry<unknown>>();

function readCache<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry || Date.now() - entry.ts > CACHE_TTL) return null;
  return entry.data;
}

function writeCache<T>(key: string, data: T): void {
  store.set(key, { data, ts: Date.now() });
}

function cacheKey(token: string, suffix: string): string {
  return `${token.slice(-12)}_${suffix}`;
}

export function clearProgressDashboardCache(): void {
  store.clear();
}
// ─────────────────────────────────────────────────────────────────────────────

export interface ProgressDashboardErrors {
  metrics: string | null;
  timeline: string | null;
  recommendations: string | null;
}

export interface UseProgressDashboardResult {
  metrics: UserMetricsResponse | null;
  timeline: TimelinePoint[];
  recommendations: RoleRecommendation[];
  badges: BadgeUnlocked[];
  isLoading: boolean;
  error: ProgressDashboardErrors;
  refetch: () => void;
}

function toMsg(err: unknown, fallback: string): string {
  return err instanceof Error && err.message.trim() ? err.message.trim() : fallback;
}

export function useProgressDashboard(): UseProgressDashboardResult {
  const [metrics, setMetrics] = useState<UserMetricsResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [recommendations, setRecommendations] = useState<RoleRecommendation[]>([]);

  const [metricsLoading, setMetricsLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);

  const [error, setError] = useState<ProgressDashboardErrors>({
    metrics: null,
    timeline: null,
    recommendations: null,
  });

  const fetchCountRef = useRef(0);

  const fetchAll = useCallback(async () => {
    const token = getAccessToken();
    const sessionMsg = "Sesión expirada. Inicia sesión nuevamente.";

    if (!token) {
      setMetricsLoading(false);
      setTimelineLoading(false);
      setRecommendationsLoading(false);
      setError({ metrics: sessionMsg, timeline: sessionMsg, recommendations: sessionMsg });
      return;
    }

    const run = ++fetchCountRef.current;

    setMetricsLoading(true);
    setTimelineLoading(true);
    setRecommendationsLoading(true);
    setError({ metrics: null, timeline: null, recommendations: null });

    const mk = cacheKey(token, "metrics");
    const tk = cacheKey(token, "timeline");
    const rk = cacheKey(token, "recommendations");

    const cached = {
      metrics: readCache<UserMetricsResponse>(mk),
      timeline: readCache<TimelinePoint[]>(tk),
      recommendations: readCache<RoleRecommendation[]>(rk),
    };

    if (cached.metrics) { setMetrics(cached.metrics); setMetricsLoading(false); }
    if (cached.timeline) { setTimeline(cached.timeline); setTimelineLoading(false); }
    if (cached.recommendations) { setRecommendations(cached.recommendations); setRecommendationsLoading(false); }

    const fetches = [
      cached.metrics
        ? Promise.resolve()
        : getUserMetrics(token)
            .then((d) => { if (run === fetchCountRef.current) { setMetrics(d); writeCache(mk, d); } })
            .catch((e) => { if (run === fetchCountRef.current) setError((prev) => ({ ...prev, metrics: toMsg(e, "No se pudieron cargar las métricas.") })); })
            .finally(() => { if (run === fetchCountRef.current) setMetricsLoading(false); }),

      cached.timeline
        ? Promise.resolve()
        : getMetricsTimeline(token)
            .then((d) => { if (run === fetchCountRef.current) { setTimeline(d); writeCache(tk, d); } })
            .catch((e) => { if (run === fetchCountRef.current) setError((prev) => ({ ...prev, timeline: toMsg(e, "No se pudo cargar el historial.") })); })
            .finally(() => { if (run === fetchCountRef.current) setTimelineLoading(false); }),

      cached.recommendations
        ? Promise.resolve()
        : getRecommendations(token)
            .then((d) => { if (run === fetchCountRef.current) { setRecommendations(d); writeCache(rk, d); } })
            .catch((e) => { if (run === fetchCountRef.current) setError((prev) => ({ ...prev, recommendations: toMsg(e, "No se pudieron cargar las recomendaciones.") })); })
            .finally(() => { if (run === fetchCountRef.current) setRecommendationsLoading(false); }),
    ];

    await Promise.allSettled(fetches);
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const isLoading = metricsLoading || timelineLoading || recommendationsLoading;

  return {
    metrics,
    timeline,
    recommendations,
    badges: [],
    isLoading,
    error,
    refetch: fetchAll,
  };
}
