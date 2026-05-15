import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setAuthTokens } from "./helpers/auth";

// ─── Mocks ───────────────────────────────────────────────────────────────────

async function mockMetricsApis(page: Page) {
  // User metrics → KPI cards and skill radar
  await page.route("**/api/metrics/user", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        avg_score: 72,
        score_by_skill: { Python: 85, SQL: 60, React: 70 },
        total_interviews: 5,
        last_updated: "2026-01-01T00:00:00Z",
      }),
    });
  });

  // Timeline chart – two data points so the chart renders (not empty state)
  await page.route("**/api/metrics/timeline**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        points: [
          { period: "2026-01-01", avg_score: 72, count: 3 },
          { period: "2026-01-08", avg_score: 78, count: 2 },
        ],
        trend_direction: "improving",
        trend_percentage: 8.3,
      }),
    });
  });

  // Role recommendations
  await page.route("**/api/matching/recommendations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          role_id: "backend-jr",
          role_name: "Backend Developer Jr.",
          total_score: 78.5,
          category: "backend",
          seniority_level: "junior",
          min_english_level: "B1",
          skill_gaps: [{ skill_name: "FastAPI", importance_weight: 9 }],
        },
      ]),
    });
  });

  // Badges
  await page.route("**/api/badges/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 1,
          name: "Primer Paso",
          description: "Completaste tu primera entrevista",
          icon: "🏅",
          condition_type: "interview_count",
          condition_value: "1",
          is_unlocked: true,
          progress: 1.0,
        },
      ]),
    });
  });

  // Recent activity feed
  await page.route("**/api/evaluations/history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            evaluation_id: "eval-1",
            session_id: 42,
            question_text: "¿Qué es la programación orientada a objetos?",
            score: 78,
            feedback: "Buena respuesta.",
            completed_at: "2026-01-01T00:00:00Z",
          },
        ],
        total: 1,
        limit: 5,
        offset: 0,
      }),
    });
  });

  // Profile APIs – used by DashboardLayout (Topbar via useProfile)
  await page.route("**/api/profile/auth-me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sub: "user-1", email: "qa@laboria.dev", name: "QA User" }),
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
      }),
    });
  });

  await page.route("**/api/profile/experiences", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  await page.route("**/api/profile/skills", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await setAuthTokens(page);
  await mockMetricsApis(page);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

test("shows metrics page heading and all main sections", async ({ page }) => {
  await page.goto("/progress");

  await expect(
    page.getByRole("heading", { name: "Métricas de Progreso" })
  ).toBeVisible({ timeout: 10_000 });

  await expect(page.getByRole("heading", { name: "Evolución temporal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Radar de Skills" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Actividad Reciente" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Roles Recomendados" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mis Badges" })).toBeVisible();
});

test("shows KPI cards with values derived from metrics API", async ({ page }) => {
  await page.goto("/progress");

  // All four KPI card labels (exact: true to avoid matching SkillRadarChart subtitle)
  await expect(page.getByText("Score Promedio", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Total Entrevistas", { exact: true })).toBeVisible();
  await expect(page.getByText("Skill más fuerte", { exact: true })).toBeVisible();
  await expect(page.getByText("Mayor brecha", { exact: true })).toBeVisible();

  // Derived values from mock: avg_score=72, total_interviews=5,
  // strongest=Python(85 pts), weakest=SQL(60 pts)
  await expect(page.getByText("sobre 100 puntos")).toBeVisible();
  await expect(page.getByText("entrevistas realizadas")).toBeVisible();
  await expect(page.getByText("85 pts")).toBeVisible();
  await expect(page.getByText("60 pts")).toBeVisible();
});

test("shows timeline chart with improving trend badge and granularity controls", async ({
  page,
}) => {
  await page.goto("/progress");

  await expect(
    page.getByRole("heading", { name: "Evolución temporal" })
  ).toBeVisible({ timeout: 10_000 });

  // Trend badge derived from trend_direction:"improving" and trend_percentage:8.3
  await expect(page.getByText(/↑/)).toBeVisible();

  // Toggle between weekly/monthly views
  await expect(page.getByRole("button", { name: "Semanas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Meses" })).toBeVisible();
});

test("shows role recommendations and recent activity with mock data", async ({ page }) => {
  await page.goto("/progress");

  // Recommended role from mock
  await expect(
    page.getByRole("heading", { name: "Roles Recomendados" })
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Backend Developer Jr.")).toBeVisible();

  // Activity feed item from mock
  await expect(page.getByRole("heading", { name: "Actividad Reciente" })).toBeVisible();
  await expect(
    page.getByText("¿Qué es la programación orientada a objetos?")
  ).toBeVisible();

  // Badge from mock
  await expect(page.getByText("Primer Paso")).toBeVisible();
});
