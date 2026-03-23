import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoleDetailModal } from "@/components/RoleDetailModal";
import { getRoleDetail } from "@/services/matchingService";
import { RoleDetail, RoleRecommendation } from "@/types/matching";
import { getAccessToken } from "@/utils/session";

vi.mock("@/services/matchingService", () => ({
  getRoleDetail: vi.fn(),
}));

vi.mock("@/utils/session", () => ({
  getAccessToken: vi.fn(),
}));

const fallbackRole: RoleRecommendation = {
  role_id: "role-1",
  role_name: "Backend Developer Jr.",
  total_score: 65,
  category: "tech",
  seniority_level: "junior",
  min_english_level: "B1",
  skill_gaps: [{ skill_name: "FastAPI", importance_weight: 9 }],
};

const roleDetail: RoleDetail = {
  ...fallbackRole,
  required_skills: [{ skill_name: "FastAPI", importance_weight: 9, required_level: "intermediate" }],
  required_technologies: [{ technology_name: "Docker", required_level: "basic" }],
};

describe("RoleDetailModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccessToken).mockReturnValue("token");
    vi.mocked(getRoleDetail).mockResolvedValue(roleDetail);
  });

  it("loads role detail when opened and starts interview from modal", async () => {
    const user = userEvent.setup();
    const onStartInterview = vi.fn();

    render(
      <RoleDetailModal
        isOpen={true}
        roleId="role-1"
        fallbackRole={fallbackRole}
        onClose={vi.fn()}
        onStartInterview={onStartInterview}
      />
    );

    expect(await screen.findByText(/Docker/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Start Interview$/i }));

    expect(onStartInterview).toHaveBeenCalledWith("role-1");
  });

  it("shows auth message when token is missing", async () => {
    vi.mocked(getAccessToken).mockReturnValue(null);

    render(
      <RoleDetailModal
        isOpen={true}
        roleId="role-1"
        fallbackRole={fallbackRole}
        onClose={vi.fn()}
        onStartInterview={vi.fn()}
      />
    );

    expect(await screen.findByText(/Tu sesion no es valida/i)).toBeInTheDocument();
    expect(getRoleDetail).not.toHaveBeenCalled();
  });
});
