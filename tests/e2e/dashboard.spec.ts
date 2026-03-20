import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const recommendationsPayload = [
  {
    role_id: "backend-jr",
    role_name: "Backend Developer Jr.",
    match_score: 78.5,
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
    match_score: 74.2,
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
    match_score: 69.1,
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
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("access_token", "e2e-token");
    window.localStorage.setItem("refresh_token", "e2e-refresh");
  });

  await mockDashboardApis(page);
});

test("shows recommended roles on dashboard", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Top roles para ti" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Backend Developer Jr." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Frontend Developer Jr." })).toBeVisible();
});

test("filters recommendations by backend category", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByLabel("Filtrar por categoria").selectOption("backend");

  await expect(page.getByRole("heading", { name: "Backend Developer Jr." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Frontend Developer Jr." })).toHaveCount(0);
});

test("starts interview preparation from role card", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Start Interview Preparation" }).first().click();

  await expect(page).toHaveURL(/\/interview\/start\?role_id=/);
});

test("shows match explanation tooltip on hover", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Explicacion del match score" }).first().hover();

  await expect(
    page.getByText(
      "Tu match score considera: Skills tecnicas (40%), Experiencia laboral (30%), Educacion (20%), Preferencias de trabajo (10%)."
    )
  ).toBeVisible();
});
