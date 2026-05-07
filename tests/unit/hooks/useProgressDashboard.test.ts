import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProgressDashboard } from "@/hooks/useProgressDashboard";

const mockMetrics = {
  avg_score: 78,
  score_by_skill: { correctness: 82, clarity: 74 },
  total_interviews: 12,
  last_updated: "2026-05-01",
};

const mockRecommendations = [
  {
    role_id: "1",
    role_name: "Frontend Developer",
    total_score: 85,
    category: "tech" as const,
    seniority_level: "mid" as const,
    min_english_level: "B2" as const,
  },
];

vi.mock("@/utils/session", () => ({
  getAccessToken: vi.fn(() => "fake-token-for-testing"),
}));

vi.mock("@/services/metricsService", () => ({
  getUserMetrics: vi.fn(),
}));

vi.mock("@/services/matchingService", () => ({
  getRecommendations: vi.fn(),
}));

import * as metricsService from "@/services/metricsService";
import * as matchingService from "@/services/matchingService";
import { clearProgressDashboardCache } from "@/hooks/useProgressDashboard";

beforeEach(() => {
  vi.clearAllMocks();
  clearProgressDashboardCache();
});

describe("useProgressDashboard", () => {
  it("starts in loading state", () => {
    vi.mocked(metricsService.getUserMetrics).mockReturnValue(new Promise(() => {}));
    vi.mocked(matchingService.getRecommendations).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useProgressDashboard());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.metrics).toBeNull();
    expect(result.current.recommendations).toEqual([]);
    expect(result.current.badges).toEqual([]);
    expect(result.current.error.metrics).toBeNull();
    expect(result.current.error.recommendations).toBeNull();
  });

  it("populates data on successful fetch", async () => {
    vi.mocked(metricsService.getUserMetrics).mockResolvedValue(mockMetrics);
    vi.mocked(matchingService.getRecommendations).mockResolvedValue(mockRecommendations);

    const { result } = renderHook(() => useProgressDashboard());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.metrics).toEqual(mockMetrics);
    expect(result.current.recommendations).toEqual(mockRecommendations);
    expect(result.current.error.metrics).toBeNull();
    expect(result.current.error.recommendations).toBeNull();
  });

  it("sets per-section error without blocking other sections", async () => {
    vi.mocked(metricsService.getUserMetrics).mockRejectedValue(new Error("Server error"));
    vi.mocked(matchingService.getRecommendations).mockResolvedValue(mockRecommendations);

    const { result } = renderHook(() => useProgressDashboard());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error.metrics).toBe("Server error");
    expect(result.current.metrics).toBeNull();

    expect(result.current.error.recommendations).toBeNull();
    expect(result.current.recommendations).toEqual(mockRecommendations);
  });
});
