import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setAuthTokens } from "./helpers/auth";

// ─── Constants ───────────────────────────────────────────────────────────────

const SESSION_ID = 42;
const QUESTION_ID = 77;
const EVAL_ID = "eval-e2e-1";

// Minimal silent WAV (0 samples) – only used as a placeholder since play() is patched
const SILENT_WAV_B64 =
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

// ─── Mocks ───────────────────────────────────────────────────────────────────

async function mockInterviewApis(page: Page) {
  // Session creation
  await page.route("**/api/sessions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: SESSION_ID,
        user_id: "user-1",
        created_at: "2026-01-01T00:00:00Z",
      }),
    });
  });

  // AI question generation
  await page.route("**/api/ai/azure-openai/interview/question", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        question: "¿Qué es la programación orientada a objetos?",
        meta: { target_skill: "Python", difficulty: "adaptive" },
      }),
    });
  });

  // Save question
  await page.route("**/api/questions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: QUESTION_ID,
        question_text: "¿Qué es la programación orientada a objetos?",
      }),
    });
  });

  // TTS audio – returns a silent WAV; actual playback is bypassed by the init script patch
  await page.route("**/api/interview/tts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ audioBase64: SILENT_WAV_B64, mimeType: "audio/wav" }),
    });
  });

  // Transcription
  await page.route("**/api/ai/azure-speech/transcribe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: "La programación orientada a objetos es un paradigma de programación.",
      }),
    });
  });

  // Submit answer
  await page.route("**/evaluations/answer", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ evaluation_id: EVAL_ID, status: "pending" }),
    });
  });

  // Poll evaluation – returns completed immediately so no retry loop is needed
  await page.route(`**/evaluations/evaluation/${EVAL_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        evaluation_id: EVAL_ID,
        status: "completed",
        score: 78,
        feedback: "Buena respuesta. Mencionaste los conceptos principales.",
        score_breakdown: { correctness: 80, completeness: 75, clarity: 78, examples: 70 },
      }),
    });
  });

  // Interview report (used by /interview-report/[sessionId])
  await page.route(`**/api/interviews/${SESSION_ID}/report`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session_id: SESSION_ID,
        session_score: 78,
        total_questions: 1,
        completed_questions: 1,
        session_created_at: "2026-01-01T00:00:00Z",
        comparison: {
          has_previous: false,
          previous_session_id: null,
          previous_score: null,
          improvement: null,
          trend: "first_session",
        },
        badges_unlocked: [],
        evaluations: [
          {
            evaluation_id: EVAL_ID,
            question_text: "¿Qué es la programación orientada a objetos?",
            category: "Python",
            difficulty: "adaptive",
            score: 78,
            feedback: "Buena respuesta. Mencionaste los conceptos principales.",
            score_breakdown: { correctness: 80, completeness: 75, clarity: 78, examples: 70 },
            topics_covered: ["Clases", "Objetos"],
            topics_missing: [],
          },
        ],
      }),
    });
  });

  // Profile APIs – required by DashboardLayout (Topbar) on the report page
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

  await page.route("**/api/matching/recommendations", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  await page.route("**/api/evaluations/history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], total: 0, limit: 5, offset: 0 }),
    });
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await setAuthTokens(page);
  await mockInterviewApis(page);

  // Patch audio.play() so TTS blob: URLs immediately fire the "ended" event.
  // This lets the 5-second recording countdown start without waiting for real
  // audio playback. data: URLs (prewarm silent WAV) still go through normally.
  await page.addInitScript(() => {
    const originalPlay = HTMLAudioElement.prototype.play;
    HTMLAudioElement.prototype.play = function () {
      const audio = this;
      if (audio.src.startsWith("blob:")) {
        Promise.resolve().then(() => audio.dispatchEvent(new Event("ended")));
        return Promise.resolve();
      }
      return originalPlay.call(audio);
    };
  });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

test("shows interview setup in idle state", async ({ page }) => {
  await page.goto("/individual-interview");

  await expect(page.getByText("Configura tu práctica")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByPlaceholder("Ej: Python, SQL, React...")).toBeVisible();
  await expect(page.getByRole("button", { name: "Iniciar entrevista" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adaptativa" })).toBeVisible();
});

test("starts interview and shows generated question", async ({ page }) => {
  await page.goto("/individual-interview");

  await expect(page.getByRole("button", { name: "Iniciar entrevista" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Iniciar entrevista" }).click();

  await expect(
    page.getByText("¿Qué es la programación orientada a objetos?")
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Pregunta 1/).first()).toBeVisible();
});

test("completes full interview flow: question → recording → feedback", async ({ page }) => {
  await page.goto("/individual-interview");

  await expect(page.getByRole("button", { name: "Iniciar entrevista" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Iniciar entrevista" }).click();

  // Wait for the question to appear (real network mocks, ~instant)
  await expect(
    page.getByText("¿Qué es la programación orientada a objetos?")
  ).toBeVisible({ timeout: 10_000 });

  // The init script fires audio "ended" immediately → 5-second countdown begins.
  // Wait for recording to start (up to 15s covers the real 5s countdown + margin).
  await expect(page.getByText("Grabando tu respuesta")).toBeVisible({ timeout: 15_000 });

  // Allow MediaRecorder (timeslice=250ms) to collect at least one chunk
  await page.waitForTimeout(500);

  // Manually stop recording
  await page.getByRole("button", { name: /Detener/ }).click();

  // Transcription is shown in the result section
  await expect(
    page.getByText("La programación orientada a objetos es un paradigma de programación.")
  ).toBeVisible({ timeout: 10_000 });

  // Evaluation result
  await expect(page.getByText("Resultado")).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText("Buena respuesta. Mencionaste los conceptos principales.")
  ).toBeVisible();
});

test("ends interview and navigates to report page", async ({ page }) => {
  await page.goto("/individual-interview");

  await expect(page.getByRole("button", { name: "Iniciar entrevista" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Iniciar entrevista" }).click();

  await expect(
    page.getByText("¿Qué es la programación orientada a objetos?")
  ).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText("Grabando tu respuesta")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Detener/ }).click();

  await expect(page.getByText("Resultado")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Terminar y ver reporte" }).click();

  await expect(page).toHaveURL(/\/interview-report\/42/, { timeout: 10_000 });
  await expect(page.getByText("Score de la sesión")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("¡Esta es tu primera sesión!")).toBeVisible();
});
