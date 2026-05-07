import { useCallback, useEffect, useRef, useState } from "react";
import { getUserMetrics } from "@/services/metricsService";
import { getRecommendations } from "@/services/matchingService";
import { UserMetricsResponse } from "@/types/metrics";
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
  recommendations: string | null;
}

export interface UseProgressDashboardResult {
  metrics: UserMetricsResponse | null;
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
  const [recommendations, setRecommendations] = useState<RoleRecommendation[]>([]);

  const [metricsLoading, setMetricsLoading] = useState(true);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);

  const [error, setError] = useState<ProgressDashboardErrors>({
    metrics: null,
    recommendations: null,
  });

  const fetchCountRef = useRef(0);

  const fetchAll = useCallback(async () => {
    const token = getAccessToken();
    const sessionMsg = "Sesión expirada. Inicia sesión nuevamente.";

    if (!token) {
      setMetricsLoading(false);
      setRecommendationsLoading(false);
      setError({ metrics: sessionMsg, recommendations: sessionMsg });
      return;
    }

    const run = ++fetchCountRef.current;

    setMetricsLoading(true);
    setRecommendationsLoading(true);
    setError({ metrics: null, recommendations: null });

    const mk = cacheKey(token, "metrics");
    const rk = cacheKey(token, "recommendations");

    const cached = {
      metrics: readCache<UserMetricsResponse>(mk),
      recommendations: readCache<RoleRecommendation[]>(rk),
    };

    if (cached.metrics) { setMetrics(cached.metrics); setMetricsLoading(false); }
    if (cached.recommendations) { setRecommendations(cached.recommendations); setRecommendationsLoading(false); }

    const fetches = [
      cached.metrics
        ? Promise.resolve()
        : getUserMetrics(token)
            .then((d) => { if (run === fetchCountRef.current) { setMetrics(d); writeCache(mk, d); } })
            .catch((e) => { if (run === fetchCountRef.current) setError((prev) => ({ ...prev, metrics: toMsg(e, "No se pudieron cargar las métricas.") })); })
            .finally(() => { if (run === fetchCountRef.current) setMetricsLoading(false); }),

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

  const isLoading = metricsLoading || recommendationsLoading;

  return {
    metrics,
    recommendations,
    badges: [],
    isLoading,
    error,
    refetch: fetchAll,
  };
}
