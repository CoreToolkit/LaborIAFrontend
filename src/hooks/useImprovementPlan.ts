import { useCallback, useEffect, useRef, useState } from "react";
import {
  refreshImprovementPlan,
  getImprovementPlanHistory,
} from "@/services/improvementPlanService";
import {
  ImprovementPlan,
  ImprovementPlanHistoryEntry,
  ImprovementPlanRefreshReason,
} from "@/types/improvementPlan";

export interface RefreshResult {
  updated: boolean;
  reason: ImprovementPlanRefreshReason;
}
import { getAccessToken } from "@/utils/session";

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

export interface UseImprovementPlanResult {
  plan: ImprovementPlan | null;
  history: ImprovementPlanHistoryEntry[];
  isPlanLoading: boolean;
  isHistoryLoading: boolean;
  isLoading: boolean;
  error: string | null;
  refreshResult: RefreshResult | null;
  refresh: () => void;
}

function toMsg(err: unknown, fallback: string): string {
  return err instanceof Error && err.message.trim() ? err.message.trim() : fallback;
}

export function useImprovementPlan(): UseImprovementPlanResult {
  const [plan, setPlan] = useState<ImprovementPlan | null>(null);
  const [history, setHistory] = useState<ImprovementPlanHistoryEntry[]>([]);
  const [planLoading, setPlanLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null);
  const fetchCountRef = useRef(0);

  const fetchAll = useCallback(async (clearCache = false) => {
    const token = getAccessToken();
    if (!token) {
      setPlanLoading(false);
      setHistoryLoading(false);
      setError("Sesión expirada. Inicia sesión nuevamente.");
      return;
    }

    const run = ++fetchCountRef.current;
    setPlanLoading(true);
    setHistoryLoading(true);
    setError(null);

    const pk = cacheKey(token, "improvement-plan");
    const hk = cacheKey(token, "improvement-plan-history");

    if (clearCache) {
      store.delete(pk);
      store.delete(hk);
    }

    const cachedPlan = readCache<ImprovementPlan>(pk);
    const cachedHistory = readCache<ImprovementPlanHistoryEntry[]>(hk);

    if (cachedPlan) { setPlan(cachedPlan); setPlanLoading(false); }
    if (cachedHistory) { setHistory(cachedHistory); setHistoryLoading(false); }

    await Promise.allSettled([
      cachedPlan
        ? Promise.resolve()
        : refreshImprovementPlan(token)
            .then(({ plan: d, updated, reason }) => {
              if (run === fetchCountRef.current) {
                setPlan(d);
                writeCache(pk, d);
                if (clearCache) setRefreshResult({ updated, reason });
              }
            })
            .catch((e) => {
              if (run === fetchCountRef.current)
                setError(toMsg(e, "No se pudo cargar el plan de mejora."));
            })
            .finally(() => {
              if (run === fetchCountRef.current) setPlanLoading(false);
            }),

      cachedHistory
        ? Promise.resolve()
        : getImprovementPlanHistory(token)
            .then((d) => {
              if (run === fetchCountRef.current) { setHistory(d); writeCache(hk, d); }
            })
            .catch(() => { /* history is non-critical */ })
            .finally(() => {
              if (run === fetchCountRef.current) setHistoryLoading(false);
            }),
    ]);
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return {
    plan,
    history,
    isPlanLoading: planLoading,
    isHistoryLoading: historyLoading,
    isLoading: planLoading || historyLoading,
    error,
    refreshResult,
    refresh: () => void fetchAll(true),
  };
}
