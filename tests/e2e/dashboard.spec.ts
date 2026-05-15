import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setAuthTokens } from "./helpers/auth";

const recommendationsPayload = [
  {
    role_id: "backend-jr",
    role_name: "Backend Developer Jr.",
    total_score: 78.5,
    description: "Construye APIs y servicios backend.",
    category: "backend",
    seniority_level: "junior",
    min_english_level: "b1",
    skill_gaps: [
      { skill_name: "FastAPI", importance_weight: 9 },
      { skill_name: "Docker", importance_weight: 8 },
      { skill_name: "Redis", importance_weight: 6 },
    ],
    experience_gap: null,
  },
  {
    role_id: "frontend-jr",
    role_name: "Frontend Developer Jr.",
    total_score: 74.2,
    description: "Desarrolla interfaces web responsivas.",
    category: "frontend",
    seniority_level: "junior",
    min_english_level: "b1",
    skill_gaps: [
      { skill_name: "React", importance_weight: 9 },
      { skill_name: "TypeScript", importance_weight: 7 },
      { skill_name: "Testing", importance_weight: 6 },
    ],
    experience_gap: null,
  },
  {
    role_id: "data-jr",
    role_name: "Data Analyst Jr.",
    total_score: 69.1,
    description: "Analiza informacion para decisiones de negocio.",
    category: "data",
    seniority_level: "junior",
    min_english_level: "b1",
    skill_gaps: [
      { skill_name: "SQL", importance_weight: 8 },
      { skill_name: "Python", importance_weight: 7 },
      { skill_name: "Power BI", importance_weight: 5 },
    ],
    experience_gap: null,
  },
];

async function mockDashboardApis(page: Page) {
  await page.route("**/api/profile/auth-me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sub: "user-1",
        email: "qa@laboria.dev",
        name: "QA User",
      }),
    });
  });

  await page.route("**/api/profile/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user_id: "user-1",
        full_name: "QA User",
        career: "Ingenieria de Sistemas",
        university: "Universidad Nacional",
        graduation_date: "2024-12-01",
      }),
    });
  });

  await page.route("**/api/profile/experiences", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/api/profile/skills", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/api/matching/recommendations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(recommendationsPayload),
    });
  });

  await page.route("**/api/evaluations/history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await setAuthTokens(page);
  await mockDashboardApis(page);
});

test("shows welcome heading and quick action cards", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: /Bienvenido/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mi Perfil Profesional" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Matching de Roles" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Simulación de Entrevista" })).toBeVisible();
});

test("shows resumen de matching section with stats", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Resumen de Matching" })).toBeVisible();
  await expect(page.getByText("Roles afines").first()).toBeVisible();
  await expect(page.getByText("Match promedio").first()).toBeVisible();
  await expect(page.getByText("Mejor rol actual").first()).toBeVisible();
});

test("navigates to matching roles page", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Ir a Matching Roles" }).click();

  await expect(page).toHaveURL(/\/matching/);
});

test("navigates to profile on edit click", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Editar" }).click();

  await expect(page).toHaveURL(/\/profile/);
});
