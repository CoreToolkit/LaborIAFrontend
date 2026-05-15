type UnknownRecord = Record<string, unknown>;

export type GroupInterviewQuestion = {
  roundId: string | null;
  roundIndex: number | null;
  text: string;
  targetSkill: string | null;
  difficulty: string | null;
  isIntro: boolean;
};

export type GroupInterviewUiState = {
  status: string;
  roundId: string | null;
  roundIndex: number | null;
  totalRounds: number;
  question: GroupInterviewQuestion | null;
  assignedUserId: string | null;
};

export type GroupInterviewEventPayload = {
  event: string;
  round_id?: string;
  round_index?: number | string;
  question_text?: string;
  target_skill?: string;
  difficulty?: string;
  is_intro?: boolean;
  status?: string;
  assigned_user_id?: number | string | null;
};

export type QuestionAudioReadyPayload = {
  event: "question_audio_ready";
  round_id: string;
  round_index?: number;
  audio_b64: string;
  question_text?: string;
  is_intro?: boolean;
  session_code?: string;
  emitted_at?: string;
};

export type TtsErrorPayload = {
  event: "tts_error";
  round_id: string;
  round_index?: number;
  tts_error?: string;
  question_text?: string;
  is_intro?: boolean;
  session_code?: string;
  emitted_at?: string;
};

const asRecord = (value: unknown): UnknownRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  return null;
};

const pickRoundContainer = (snapshot: UnknownRecord): UnknownRecord | null => {
  const candidates = [
    snapshot.active_round,
    snapshot.current_round,
    snapshot.round,
  ];

  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (record) {
      return record;
    }
  }

  return null;
};

const normalizeQuestionRecord = (
  source: UnknownRecord,
  fallbackRoundId: string | null,
  fallbackRoundIndex: number | null,
): GroupInterviewQuestion | null => {
  const text = asString(source.question_text) ?? asString(source.text);
  if (!text) {
    return null;
  }

  return {
    roundId: asString(source.round_id) ?? asString(source.id) ?? fallbackRoundId,
    roundIndex: asNumber(source.round_index) ?? fallbackRoundIndex,
    text,
    targetSkill: asString(source.target_skill),
    difficulty: asString(source.difficulty),
    isIntro: asBoolean(source.is_intro) ?? false,
  };
};

export const buildRoundEventDedupKey = (
  eventType: string,
  roundId?: string | null,
  roundIndex?: number | null,
): string | null => {
  const safeEvent = eventType.trim();
  if (!safeEvent) {
    return null;
  }

  const safeRoundId = typeof roundId === "string" ? roundId.trim() : "";
  if (safeRoundId) {
    return `${safeEvent}:${safeRoundId}`;
  }

  if (typeof roundIndex === "number" && Number.isFinite(roundIndex)) {
    return `${safeEvent}:idx-${roundIndex}`;
  }

  return null;
};

export const normalizeQuestionGeneratedEvent = (payload: unknown): GroupInterviewQuestion | null => {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const eventType = asString(record.event);
  if (eventType !== "question_generated" && eventType !== "question_new") {
    return null;
  }

  return normalizeQuestionRecord(
    record,
    asString(record.round_id),
    asNumber(record.round_index),
  );
};

export const applyGroupInterviewEvent = (
  current: GroupInterviewUiState,
  payload: GroupInterviewEventPayload,
  shouldApply: (eventType: string, roundId?: string | null, roundIndex?: number | null) => boolean,
): GroupInterviewUiState => {
  const eventType = payload.event?.trim();
  if (!eventType) {
    return current;
  }

  if (eventType === "interview_started") {
    return {
      ...current,
      status: "in_progress",
    };
  }

  if (eventType === "interview_closed") {
    return {
      ...current,
      status: "closed",
    };
  }

  const parsedRoundIndex = asNumber(payload.round_index);

  if (eventType === "round_started") {
    if (!shouldApply(eventType, payload.round_id ?? null, parsedRoundIndex)) {
      return current;
    }

    const nextIndex = parsedRoundIndex ?? current.roundIndex;
    const nextTotal = typeof nextIndex === "number" ? Math.max(current.totalRounds, nextIndex) : current.totalRounds;
    const nextAssignedUserId =
      payload.assigned_user_id !== undefined
        ? payload.assigned_user_id !== null ? String(payload.assigned_user_id) : null
        : current.assignedUserId;

    return {
      ...current,
      status: "in_progress",
      roundId: payload.round_id ?? current.roundId,
      roundIndex: nextIndex,
      totalRounds: nextTotal,
      assignedUserId: nextAssignedUserId,
    };
  }

  const normalizedQuestion = normalizeQuestionGeneratedEvent(payload);
  if (normalizedQuestion) {
    if (!shouldApply(eventType, normalizedQuestion.roundId, normalizedQuestion.roundIndex)) {
      return current;
    }

    const nextIndex = normalizedQuestion.roundIndex ?? current.roundIndex;
    const nextTotal = typeof nextIndex === "number" ? Math.max(current.totalRounds, nextIndex) : current.totalRounds;
    const nextAssignedUserId =
      payload.assigned_user_id !== undefined
        ? payload.assigned_user_id !== null ? String(payload.assigned_user_id) : null
        : current.assignedUserId;

    return {
      status: "in_progress",
      roundId: normalizedQuestion.roundId,
      roundIndex: nextIndex,
      totalRounds: nextTotal,
      question: normalizedQuestion,
      assignedUserId: nextAssignedUserId,
    };
  }

  return current;
};

export const extractGroupInterviewUiState = (snapshot: unknown): GroupInterviewUiState => {
  const record = asRecord(snapshot) ?? {};

  const status =
    asString(record.session_status) ??
    asString(record.interview_status) ??
    asString(record.status) ??
    asString(record.state) ??
    "idle";

  const roundContainer = pickRoundContainer(record);

  const roundId =
    (roundContainer ? asString(roundContainer.round_id) ?? asString(roundContainer.id) : null) ??
    asString(record.round_id);

  const roundIndex =
    (roundContainer ? asNumber(roundContainer.round_index) : null) ??
    asNumber(record.round_index);

  const totalRounds = asNumber(record.total_rounds) ?? 0;

  const questionCandidates: unknown[] = [
    record.active_question,
    record.persisted_question,
    record.question,
  ];

  const questionsArray = Array.isArray(record.questions) ? record.questions : [];
  if (questionsArray.length > 0) {
    questionCandidates.push(questionsArray[0]);
  }

  // The backend may return the active question directly inside current_round/active_round.
  let normalizedQuestion: GroupInterviewQuestion | null =
    roundContainer ? normalizeQuestionRecord(roundContainer, roundId, roundIndex) : null;

  if (!normalizedQuestion) {
    for (const candidate of questionCandidates) {
      const questionRecord = asRecord(candidate);
      if (!questionRecord) {
        continue;
      }

      normalizedQuestion = normalizeQuestionRecord(questionRecord, roundId, roundIndex);
      if (normalizedQuestion) {
        break;
      }
    }
  }

  // Leer assigned_user_id desde el snapshot de reconexión
  const assignedUserIdRaw =
    roundContainer ? roundContainer.assigned_user_id : undefined;
  const assignedUserId =
    assignedUserIdRaw !== undefined && assignedUserIdRaw !== null
      ? String(assignedUserIdRaw)
      : null;

  return {
    status,
    roundId,
    roundIndex,
    totalRounds,
    question: normalizedQuestion,
    assignedUserId,
  };
};
