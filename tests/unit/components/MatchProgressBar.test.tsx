import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MatchProgressBar } from "@/components/MatchProgressBar";

describe("MatchProgressBar", () => {
  it("renders color-coded level labels by score", () => {
    const { rerender } = render(<MatchProgressBar score={45} />);
    expect(screen.getByText("Bajo")).toBeInTheDocument();

    rerender(<MatchProgressBar score={70} />);
    expect(screen.getByText("Medio")).toBeInTheDocument();

    rerender(<MatchProgressBar score={88} />);
    expect(screen.getByText("Alto")).toBeInTheDocument();
  });

  it("shows explanatory tooltip on click", async () => {
    const user = userEvent.setup();

    render(<MatchProgressBar score={75} />);

    await user.hover(screen.getByRole("button", { name: /Explicacion del match score/i }));

    expect(screen.getByText(/Tu match score considera:/i)).toBeInTheDocument();
  });
});
