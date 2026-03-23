import React from "react";
import { RoleSortOption } from "@/types/matching";

interface RoleDashboardFiltersProps {
  categories: string[];
  selectedCategory: string;
  selectedSort: RoleSortOption;
  salarySortAvailable: boolean;
  onCategoryChange: (category: string) => void;
  onSortChange: (sortBy: RoleSortOption) => void;
}

export function RoleDashboardFilters({
  categories,
  selectedCategory,
  selectedSort,
  salarySortAvailable,
  onCategoryChange,
  onSortChange,
}: RoleDashboardFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-900">Categoria</span>
        <select
          value={selectedCategory}
          onChange={(event) => onCategoryChange(event.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
          aria-label="Filtrar por categoria"
        >
          <option value="all">Todas</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-900">Ordenar por</span>
        <select
          value={selectedSort}
          onChange={(event) => onSortChange(event.target.value as RoleSortOption)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
          aria-label="Ordenar recomendaciones"
        >
          <option value="match-desc">Match score (descendente)</option>
          <option value="demand-desc">Demanda (descendente)</option>
          <option value="name-asc">Alfabetico (A-Z)</option>
          <option value="salary-desc" disabled={!salarySortAvailable}>
            Salario estimado (descendente)
          </option>
        </select>
      </label>
    </div>
  );
}
