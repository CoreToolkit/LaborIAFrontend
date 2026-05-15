import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setAuthTokens } from "./helpers/auth";

// ─── Mocks ──────────────────────────────────────────────────────────────────

async function mockNewUserApis(page: Page) {
  let profileExists = false;

  await page.route("**/api/profile/auth-me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sub: "new-user-1",
        email: "nuevo@laboria.dev",
        name: "Nuevo Usuario",
      }),
    });
  });

  // GET → 404 until profile is created; then 200 with career set
  await page.route("**/api/profile/me", async (route) => {
    if (route.request().method() === "PUT") {
      // First PUT fails (profile doesn't exist yet), triggering POST fallback
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
      return;
    }

    if (profileExists) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_id: "new-user-1",
          full_name: "Nuevo Usuario",
          career: "Ingenieria de Sistemas",
          university: "Universidad Nacional",
        }),
      });
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    }
  });

  // POST /api/profile — creates the profile for the first time
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    profileExists = true;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        user_id: "new-user-1",
        full_name: "Nuevo Usuario",
        career: "Ingenieria de Sistemas",
        university: "Universidad Nacional",
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
      body: JSON.stringify([]),
    });
  });

  await page.route("**/api/matching/calculate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
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

// ─── Tests ──────────────────────────────────────────────────────────────────

test("shows login page with OAuth buttons", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Bienvenido de nuevo" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Google/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Microsoft/ })).toBeVisible();
});

test("authenticated user is redirected from login to dashboard", async ({ page }) => {
  await setAuthTokens(page);

  await page.goto("/login");

  await expect(page).toHaveURL(/\/dashboard/);
});

test("new user without profile is redirected to onboarding from dashboard", async ({ page }) => {
  await setAuthTokens(page);
  await mockNewUserApis(page);

  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/Onboarding/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Crea tu perfil profesional" })).toBeVisible();
});

test("completes signup onboarding flow and reaches dashboard", async ({ page }) => {
  await setAuthTokens(page);
  await mockNewUserApis(page);

  await page.goto("/Onboarding");

  // Onboarding form must be visible (new user with no profile)
  await expect(page.getByRole("heading", { name: "Crea tu perfil profesional" })).toBeVisible();
  await expect(page.getByText("Paso 1 de 4")).toBeVisible();

  // ── Step 1: Datos Básicos ──────────────────────────────────────────────
  await page.getByLabel("Carrera *").fill("Ingenieria de Sistemas");
  await page.getByLabel("Universidad *").fill("Universidad Nacional");
  await page.getByLabel("Seleccionar nivel de inglés").selectOption("Intermedio");
  await page.getByRole("button", { name: "Continuar" }).click();

  // ── Step 2: Experiencia (skip) ─────────────────────────────────────────
  await expect(page.getByText("Paso 2 de 4")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  // ── Step 3: Habilidades (skip) ─────────────────────────────────────────
  await expect(page.getByText("Paso 3 de 4")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  // ── Step 4: Preferencias → Finalizar ──────────────────────────────────
  await expect(page.getByText("Paso 4 de 4")).toBeVisible();
  await page.getByRole("button", { name: "Finalizar onboarding" }).click();

  // ── Should reach dashboard ─────────────────────────────────────────────
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: /Bienvenido/ })).toBeVisible();
});
