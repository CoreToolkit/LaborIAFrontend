import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RoleDashboardFilters } from "@/components/RoleDashboardFilters";

describe("RoleDashboardFilters", () => {
  it("emits category and sort changes", async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    const onSortChange = vi.fn();

    render(
      <RoleDashboardFilters
        categories={["backend", "data"]}
        selectedCategory="all"
        selectedSort="match-desc"
        salarySortAvailable={true}
        onCategoryChange={onCategoryChange}
        onSortChange={onSortChange}
      />
    );

    await user.selectOptions(screen.getByLabelText(/Filtrar por categoria/i), "backend");
    await user.selectOptions(screen.getByLabelText(/Ordenar recomendaciones/i), "name-asc");

    expect(onCategoryChange).toHaveBeenCalledWith("backend");
    expect(onSortChange).toHaveBeenCalledWith("name-asc");
  });

  it("shows demand ordering option and disables salary sort when unavailable", () => {
    render(
      <RoleDashboardFilters
        categories={["backend"]}
        selectedCategory="all"
        selectedSort="match-desc"
        salarySortAvailable={false}
        onCategoryChange={vi.fn()}
        onSortChange={vi.fn()}
      />
    );

    expect(screen.getByRole("option", { name: /Demanda \(descendente\)/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Salario estimado \(descendente\)/i })).toBeDisabled();
  });
});
