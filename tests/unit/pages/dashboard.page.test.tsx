import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRouter } from "next/router";
import { DashboardContent } from "@/pages/dashboard";
import { useProfile } from "@/hooks/useProfile";
import { getRecommendations, recalculateRecommendations } from "@/services/matchingService";
import { getAccessToken } from "@/utils/session";
import { RoleRecommendation } from "@/types/matching";

vi.mock("next/router", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: vi.fn(),
}));

vi.mock("@/services/matchingService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/matchingService")>();

  return {
    ...actual,
    getRecommendations: vi.fn(),
    recalculateRecommendations: vi.fn(),
  };
});

vi.mock("@/utils/session", () => ({
  getAccessToken: vi.fn(),
  clearTokens: vi.fn(),
  clearProvider: vi.fn(),
}));

vi.mock("@/utils/profileOnboarding", () => ({
  hasSkippedOnboarding: vi.fn(() => false),
  profileNeedsOnboarding: vi.fn(() => false),
}));

const pushMock = vi.fn();
const replaceMock = vi.fn();

const makeRole = (overrides?: Partial<RoleRecommendation>): RoleRecommendation => ({
  role_id: crypto.randomUUID(),
  role_name: "Role",
  total_score: 50,
  category: "tech",
  seniority_level: "mid",
  min_english_level: "B2",
  skill_gaps: [],
  ...overrides,
});

describe("DashboardContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useRouter).mockReturnValue({
      push: pushMock,
      replace: replaceMock,
    } as unknown as ReturnType<typeof useRouter>);

    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      updateProfile: vi.fn(),
      addExperience: vi.fn(),
      updateExperience: vi.fn(),
      deleteExperience: vi.fn(),
      addSkill: vi.fn(),
      updateSkill: vi.fn(),
      deleteSkill: vi.fn(),
      updatePreferencias: vi.fn(),
    });

    vi.mocked(getAccessToken).mockReturnValue("test-token");
    vi.mocked(getRecommendations).mockResolvedValue([]);
    vi.mocked(recalculateRecommendations).mockResolvedValue();
  });

  it("renders matching summary with computed values", async () => {
    vi.mocked(getRecommendations).mockResolvedValue([
      makeRole({ role_id: "r1", role_name: "Role 80", total_score: 80 }),
      makeRole({ role_id: "r2", role_name: "Role 60", total_score: 60 }),
    ]);

    render(<DashboardContent />);

    expect(await screen.findByText("Role 80")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText("70%")).toBeInTheDocument();
  });

  it("recalculates matching when cached recommendations are empty", async () => {
    vi.mocked(getRecommendations)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeRole({ role_id: "post-get-role", role_name: "Calculated Role", total_score: 74 }),
      ]);

    render(<DashboardContent />);

    expect(await screen.findByText("Calculated Role")).toBeInTheDocument();
    expect(recalculateRecommendations).toHaveBeenCalledTimes(1);
    expect(getRecommendations).toHaveBeenCalledTimes(2);
  });

  it("navigates to websocket interview room from quick action", async () => {
    const user = userEvent.setup();

    render(<DashboardContent />);

    await user.click(screen.getByRole("button", { name: /Entrar/i }));

    expect(pushMock).toHaveBeenCalledWith("/interviewPageEnter");
  });

  it("shows fallback summary when there are no recommendations", async () => {
    vi.mocked(getRecommendations).mockResolvedValue([]);

    render(<DashboardContent />);

    expect(await screen.findByText(/Sin datos/i)).toBeInTheDocument();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });

  it("shows generic fetch error and retry action", async () => {
    vi.mocked(getRecommendations).mockRejectedValue(new Error("Not Found"));

    render(<DashboardContent />);

    expect(await screen.findByText(/No pudimos cargar tu resumen de matching/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reintentar/i })).toBeInTheDocument();
  });

  it("retries loading recommendations when retry is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(getRecommendations)
      .mockRejectedValueOnce(new Error("Not Found"))
      .mockResolvedValueOnce([
        makeRole({ role_id: "retry-role", role_name: "Recovered Role", total_score: 77 }),
      ]);

    render(<DashboardContent />);
    await screen.findByText(/No pudimos cargar tu resumen de matching/i);
    await user.click(screen.getByRole("button", { name: /Reintentar/i }));

    await waitFor(() => {
      expect(getRecommendations).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText("Recovered Role")).toBeInTheDocument();
  });
});
