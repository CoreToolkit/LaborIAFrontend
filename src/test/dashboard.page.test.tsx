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
  match_score: 50,
  description: "Role description",
  category: "backend",
  seniority_level: "junior",
  min_english_level: "b1",
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

  it("renders top 5 roles sorted by match score descending by default", async () => {
    vi.mocked(getRecommendations).mockResolvedValue([
      makeRole({ role_id: "r1", role_name: "Role 30", match_score: 30 }),
      makeRole({ role_id: "r2", role_name: "Role 90", match_score: 90 }),
      makeRole({ role_id: "r3", role_name: "Role 70", match_score: 70 }),
      makeRole({ role_id: "r4", role_name: "Role 50", match_score: 50 }),
      makeRole({ role_id: "r5", role_name: "Role 80", match_score: 80 }),
      makeRole({ role_id: "r6", role_name: "Role 20", match_score: 20 }),
    ]);

    render(<DashboardContent />);

    await screen.findByText(/Top roles para ti/i);

    expect(screen.queryByRole("heading", { name: "Role 20" })).not.toBeInTheDocument();

    const roleHeadings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(roleHeadings).toEqual(["Role 90", "Role 80", "Role 70", "Role 50", "Role 30"]);
  });

  it("filters roles by selected category", async () => {
    const user = userEvent.setup();

    vi.mocked(getRecommendations).mockResolvedValue([
      makeRole({ role_id: "b1", role_name: "Backend Jr", category: "backend" }),
      makeRole({ role_id: "d1", role_name: "Data Jr", category: "data" }),
    ]);

    render(<DashboardContent />);

    await screen.findByRole("heading", { name: "Backend Jr" });

    await user.selectOptions(screen.getByLabelText(/Filtrar por categoria/i), "backend");

    expect(screen.getByRole("heading", { name: "Backend Jr" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Data Jr" })).not.toBeInTheDocument();
  });

  it("shows empty state when there are no recommendations", async () => {
    vi.mocked(getRecommendations).mockResolvedValue([]);

    render(<DashboardContent />);

    expect(await screen.findByText(/Aun no hay recomendaciones/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Complete Profile/i })).toBeInTheDocument();
  });

  it("navigates to interview start when CTA is clicked", async () => {
    const user = userEvent.setup();

    vi.mocked(getRecommendations).mockResolvedValue([
      makeRole({ role_id: "cta-role", role_name: "Frontend Jr", category: "frontend" }),
    ]);

    render(<DashboardContent />);

    await screen.findByRole("heading", { name: "Frontend Jr" });
    await user.click(screen.getByRole("button", { name: /Start Interview Preparation/i }));

    expect(pushMock).toHaveBeenCalledWith("/interview/start?role_id=cta-role");
  });

  it("shows generic fetch error and retry action", async () => {
    vi.mocked(getRecommendations).mockRejectedValue(new Error("Not Found"));

    render(<DashboardContent />);

    expect(await screen.findByText(/No pudimos cargar tus recomendaciones/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reintentar/i })).toBeInTheDocument();
  });

  it("applies demand sorting from dropdown", async () => {
    const user = userEvent.setup();

    vi.mocked(getRecommendations).mockResolvedValue([
      makeRole({ role_id: "a", role_name: "Role A", match_score: 60, demand_score: 10 }),
      makeRole({ role_id: "b", role_name: "Role B", match_score: 55, demand_score: 70 }),
      makeRole({ role_id: "c", role_name: "Role C", match_score: 80, demand_score: 40 }),
    ]);

    render(<DashboardContent />);

    await screen.findByRole("heading", { name: "Role C" });

    await user.selectOptions(screen.getByLabelText(/Ordenar recomendaciones/i), "demand-desc");

    await waitFor(() => {
      const ordered = screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent);
      expect(ordered).toEqual(["Role B", "Role C", "Role A"]);
    });
  });
});
