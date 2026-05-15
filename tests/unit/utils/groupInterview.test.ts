import {
  applyGroupInterviewEvent,
  buildRoundEventDedupKey,
  extractGroupInterviewUiState,
  normalizeQuestionGeneratedEvent,
} from "@/utils/groupInterview";
import { describe, expect, it } from "vitest";

describe("group interview websocket/state helpers", () => {
  it("normaliza question_generated", () => {
    const payload = {
      event: "question_generated",
      session_code: "LIFM9490",
      round_id: "abc123",
      round_index: 1,
      question_text: "¿Cuál es la diferencia entre concurrencia y paralelismo?",
      target_skill: "Python",
      difficulty: "intermediate",
    };

    const normalized = normalizeQuestionGeneratedEvent(payload);

    expect(normalized).toEqual({
      roundId: "abc123",
      roundIndex: 1,
      text: "¿Cuál es la diferencia entre concurrencia y paralelismo?",
      targetSkill: "Python",
      difficulty: "intermediate",
      isIntro: false,
    });
  });

  it("restaura estado de sala desde snapshot de reconexion", () => {
    const snapshot = {
      session_status: "in_progress",
      total_rounds: 2,
      active_round: {
        round_id: "round-2",
        round_index: 2,
      },
      persisted_question: {
        round_id: "round-2",
        round_index: 2,
        question_text: "Explica el patron Repository.",
        target_skill: "Arquitectura",
        difficulty: "advanced",
      },
    };

    const restored = extractGroupInterviewUiState(snapshot);

    expect(restored.status).toBe("in_progress");
    expect(restored.roundId).toBe("round-2");
    expect(restored.roundIndex).toBe(2);
    expect(restored.totalRounds).toBe(2);
    expect(restored.question).toEqual({
      roundId: "round-2",
      roundIndex: 2,
      text: "Explica el patron Repository.",
      targetSkill: "Arquitectura",
      difficulty: "advanced",
      isIntro: false,
    });
  });

  it("restaura pregunta activa cuando viene dentro de current_round", () => {
    const snapshot = {
      session_code: "LIFM9490",
      status: "in_progress",
      total_rounds: 1,
      current_round: {
        round_id: "round-1",
        round_index: 1,
        question_text: "¿Cuál es la diferencia entre concurrencia y paralelismo?",
        target_skill: "Python",
        difficulty: "intermediate",
        status: "active",
      },
    };

    const restored = extractGroupInterviewUiState(snapshot);

    expect(restored.status).toBe("in_progress");
    expect(restored.roundId).toBe("round-1");
    expect(restored.roundIndex).toBe(1);
    expect(restored.totalRounds).toBe(1);
    expect(restored.question).toEqual({
      roundId: "round-1",
      roundIndex: 1,
      text: "¿Cuál es la diferencia entre concurrencia y paralelismo?",
      targetSkill: "Python",
      difficulty: "intermediate",
      isIntro: false,
    });
  });

  it("acepta compatibilidad retroactiva para question_new", () => {
    const payload = {
      event: "question_new",
      round_id: "legacy-round",
      round_index: 3,
      question_text: "Pregunta legacy",
      target_skill: "Python",
      difficulty: "basic",
    };

    const normalized = normalizeQuestionGeneratedEvent(payload);

    expect(normalized?.text).toBe("Pregunta legacy");
    expect(normalized?.roundId).toBe("legacy-round");
  });

  it("genera llave de deduplicacion por ronda y evento", () => {
    const startKey = buildRoundEventDedupKey("round_started", "round-4", 4);
    const questionKey = buildRoundEventDedupKey("question_generated", "round-4", 4);

    expect(startKey).toBe("round_started:round-4");
    expect(questionKey).toBe("question_generated:round-4");
    expect(startKey).not.toBe(questionKey);
  });

  it("aplica transicion de ronda y pregunta para una misma ronda", () => {
    const shouldApply = () => true;

    const afterRoundStarted = applyGroupInterviewEvent(
      {
        status: "waiting",
        roundId: null,
        roundIndex: null,
        totalRounds: 0,
        question: null,
        assignedUserId: null,
      },
      {
        event: "round_started",
        round_id: "round-1",
        round_index: 1,
      },
      shouldApply,
    );

    const afterQuestionGenerated = applyGroupInterviewEvent(
      afterRoundStarted,
      {
        event: "question_generated",
        round_id: "round-1",
        round_index: 1,
        question_text: "Pregunta de ronda 1",
        target_skill: "Python",
        difficulty: "intermediate",
      },
      shouldApply,
    );

    expect(afterQuestionGenerated.status).toBe("in_progress");
    expect(afterQuestionGenerated.roundId).toBe("round-1");
    expect(afterQuestionGenerated.roundIndex).toBe(1);
    expect(afterQuestionGenerated.totalRounds).toBe(1);
    expect(afterQuestionGenerated.question?.text).toBe("Pregunta de ronda 1");
  });

  it("ignora eventos duplicados cuando dedupe retorna false", () => {
    const current = {
      status: "in_progress",
      roundId: "round-1",
      roundIndex: 1,
      totalRounds: 1,
      assignedUserId: null,
      question: {
        roundId: "round-1",
        roundIndex: 1,
        text: "Pregunta original",
        targetSkill: "Python",
        difficulty: "intermediate",
        isIntro: false,
      },
    };

    const dedupeReject = () => false;

    const next = applyGroupInterviewEvent(
      { ...current, assignedUserId: null },
      {
        event: "question_generated",
        round_id: "round-1",
        round_index: 1,
        question_text: "Pregunta duplicada",
      },
      dedupeReject,
    );

    expect(next).toEqual({ ...current, assignedUserId: null });
  });
});
