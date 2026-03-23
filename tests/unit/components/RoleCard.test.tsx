import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RoleCard } from "@/components/RoleCard";
import { RoleRecommendation } from "@/types/matching";

const makeRole = (overrides?: Partial<RoleRecommendation>): RoleRecommendation => ({
  role_id: "role-1",
  role_name: "Backend Developer Jr.",
  total_score: 65,
  category: "tech",
  seniority_level: "junior",
  min_english_level: "B1",
  skill_gaps: [
    { skill_name: "Docker", importance_weight: 4 },
    { skill_name: "FastAPI", importance_weight: 9 },
    { skill_name: "Redis", importance_weight: 7 },
    { skill_name: "Testing", importance_weight: 5 },
  ],
  ...overrides,
});

describe("RoleCard", () => {
  it("renders top 3 skill gaps by importance", () => {
    render(
      <RoleCard
        role={makeRole()}
        onStartInterview={vi.fn()}
        onViewDetail={vi.fn()}
      />
    );

    expect(screen.getByText(/FastAPI/i)).toBeInTheDocument();
    expect(screen.getByText(/Redis/i)).toBeInTheDocument();
    expect(screen.getByText(/Testing/i)).toBeInTheDocument();
    expect(screen.queryByText(/Docker/i)).not.toBeInTheDocument();
  });

  it("calls view detail when card is clicked", async () => {
    const user = userEvent.setup();
    const onViewDetail = vi.fn();

    render(
      <RoleCard
        role={makeRole()}
        onStartInterview={vi.fn()}
        onViewDetail={onViewDetail}
      />
    );

    await user.click(screen.getByRole("button", { name: /Ver detalle de Backend Developer Jr./i }));

    expect(onViewDetail).toHaveBeenCalledWith("role-1");
  });

  it("calls start interview CTA without triggering card click", async () => {
    const user = userEvent.setup();
    const onStartInterview = vi.fn();
    const onViewDetail = vi.fn();

    render(
      <RoleCard
        role={makeRole()}
        onStartInterview={onStartInterview}
        onViewDetail={onViewDetail}
      />
    );

    await user.click(screen.getByRole("button", { name: /Start Interview Preparation/i }));

    expect(onStartInterview).toHaveBeenCalledWith("role-1");
    expect(onViewDetail).not.toHaveBeenCalled();
  });
});
