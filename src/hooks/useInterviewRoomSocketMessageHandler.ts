import React from "react";
import { type AudioPlayerQuestion } from "@/components/AudioPlayer";
import {
  applyGroupInterviewEvent,
  type QuestionAudioReadyPayload,
  type TtsErrorPayload,
} from "@/utils/groupInterview";
import {
  clearPersistedRejoinState,
  normalizeUserLabel,
  unwrapIncomingAudioPayload,
} from "@/utils/interviewRoom";

type SignalingMessage = {
  event: string;
  from?: string;
  user_id?: string;
  displayName?: string;
  round_id?: string;
  round_index?: number | string;
  question_text?: string;
  target_skill?: string;
  difficulty?: string;
  status?: string;
  evaluation_id?: string;
};

type UseInterviewRoomSocketMessageHandlerArgs = {
  selectedMimeTypeRef: React.MutableRefObject<string>;
  activeRoundIdRef: React.MutableRefObject<string | null>;
  activeRoundIndexRef: React.MutableRefObject<number | null>;
  sessionStatusRef: React.MutableRefObject<string>;
  totalRoundsRef: React.MutableRefObject<number>;
  currentQuestionRef: React.MutableRefObject<AudioPlayerQuestion | null>;
  shouldProcessRoundEvent: (eventType: string, roundId?: string | null, roundIndex?: number | null) => boolean;
  setSessionStatus: React.Dispatch<React.SetStateAction<string>>;
  setActiveRoundId: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveRoundIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setTotalRounds: React.Dispatch<React.SetStateAction<number>>;
  setCurrentQuestion: React.Dispatch<React.SetStateAction<AudioPlayerQuestion | null>>;
  updateParticipant: (
    socketId: string,
    updater: (current?: { socketId: string; displayName: string; connected: boolean; level: number }) => {
      socketId: string;
      displayName: string;
      connected: boolean;
      level: number;
    },
  ) => void;
  appendChunkForSender: (senderId: string, mimeType: string, audioChunk: ArrayBuffer) => void;
  markRemoteActivity: (socketId: string) => void;
  cleanupSenderPlayer: (senderId: string) => void;
  removeParticipant: (socketId: string) => void;
  restartRecorderForNewPeer: (silent?: boolean) => void;
  handleTTSRoundStarted: (roundId: string | null) => void;
  handleQuestionAudioReady: (payload: QuestionAudioReadyPayload) => void;
  handleTtsError: (payload: TtsErrorPayload) => void;
};

export function useInterviewRoomSocketMessageHandler({
  selectedMimeTypeRef,
  activeRoundIdRef,
  activeRoundIndexRef,
  sessionStatusRef,
  totalRoundsRef,
  currentQuestionRef,
  shouldProcessRoundEvent,
  setSessionStatus,
  setActiveRoundId,
  setActiveRoundIndex,
  setTotalRounds,
  setCurrentQuestion,
  updateParticipant,
  appendChunkForSender,
  markRemoteActivity,
  cleanupSenderPlayer,
  removeParticipant,
  restartRecorderForNewPeer,
  handleTTSRoundStarted,
  handleQuestionAudioReady,
  handleTtsError,
}: UseInterviewRoomSocketMessageHandlerArgs) {
  const handleSocketMessage = React.useCallback((event: MessageEvent, sessionUserId: string) => {
    if (event.data instanceof ArrayBuffer) {
      const buffer = new Uint8Array(event.data);
      if (buffer.length < 2) {
        return;
      }

      const userIdLength = buffer[0];
      if (userIdLength === 0 || buffer.length <= 1 + userIdLength) {
        return;
      }

      const userIdBytes = buffer.slice(1, 1 + userIdLength);
      const senderId = new TextDecoder().decode(userIdBytes);
      if (!senderId || senderId === sessionUserId) {
        return;
      }

      const payloadBytes = buffer.slice(1 + userIdLength);
      const payloadBuffer = new Uint8Array(payloadBytes.length);
      payloadBuffer.set(payloadBytes);
      const decoded = unwrapIncomingAudioPayload(payloadBuffer.buffer);
      if (!decoded.audioBuffer) {
        return;
      }

      const mimeType = decoded.mimeType || selectedMimeTypeRef.current || "audio/webm;codecs=opus";

      updateParticipant(senderId, (current) => ({
        socketId: senderId,
        displayName: current?.displayName || normalizeUserLabel("", senderId),
        connected: true,
        level: current?.level || 0,
      }));

      appendChunkForSender(senderId, mimeType, decoded.audioBuffer);
      markRemoteActivity(senderId);
      return;
    }

    if (typeof event.data !== "string") {
      return;
    }

    let payload: SignalingMessage | null = null;
    try {
      payload = JSON.parse(event.data) as SignalingMessage;
    } catch {
      return;
    }

    if (!payload?.event) {
      return;
    }

    // Drop stale question events from previous rounds.
    if (payload.event === "question_generated" || payload.event === "question_new") {
      const eventRoundId = payload.round_id;
      const eventRoundIndex = payload.round_index !== undefined
        ? Number(payload.round_index)
        : null;
      const currentIndex = activeRoundIndexRef.current;

      if (eventRoundId && activeRoundIdRef.current && eventRoundId !== activeRoundIdRef.current) {
        return;
      }
      if (
        eventRoundIndex !== null
        && !Number.isNaN(eventRoundIndex)
        && currentIndex !== null
        && eventRoundIndex < currentIndex
      ) {
        return;
      }
    }

    const nextState = applyGroupInterviewEvent(
      {
        status: sessionStatusRef.current,
        roundId: activeRoundIdRef.current,
        roundIndex: activeRoundIndexRef.current,
        totalRounds: totalRoundsRef.current,
        question: currentQuestionRef.current
          ? {
            roundId: activeRoundIdRef.current,
            roundIndex: activeRoundIndexRef.current,
            text: currentQuestionRef.current.text,
            targetSkill: null,
            difficulty: null,
          }
          : null,
      },
      payload,
      shouldProcessRoundEvent,
    );

    const stateChanged =
      nextState.status !== sessionStatusRef.current
      || nextState.roundId !== activeRoundIdRef.current
      || nextState.roundIndex !== activeRoundIndexRef.current
      || nextState.totalRounds !== totalRoundsRef.current
      || nextState.question;

    if (stateChanged) {
      if (nextState.roundId !== activeRoundIdRef.current) {
        activeRoundIdRef.current = nextState.roundId;
      }
      if (nextState.roundIndex !== activeRoundIndexRef.current) {
        activeRoundIndexRef.current = nextState.roundIndex;
      }
      if (nextState.status !== sessionStatusRef.current) {
        sessionStatusRef.current = nextState.status;
      }
      if (nextState.totalRounds !== totalRoundsRef.current) {
        totalRoundsRef.current = nextState.totalRounds;
      }

      setSessionStatus(nextState.status);
      setActiveRoundId(nextState.roundId);
      setActiveRoundIndex(nextState.roundIndex);
      setTotalRounds(nextState.totalRounds);

      if (nextState.question) {
        const nextQuestion: AudioPlayerQuestion = {
          id: nextState.question.roundId || `round-${nextState.question.roundIndex ?? "active"}`,
          text: nextState.question.text,
          note: `Skill objetivo: ${nextState.question.targetSkill ?? "General"} | Dificultad: ${nextState.question.difficulty ?? "N/A"}`,
          targetSkill: nextState.question.targetSkill ?? null,
        };
        currentQuestionRef.current = nextQuestion;
        setCurrentQuestion(nextQuestion);
      }
    }

    if (
      payload.event === "interview_started"
      || payload.event === "interview_closed"
      || payload.event === "round_started"
      || payload.event === "question_generated"
      || payload.event === "question_new"
    ) {
      if (payload.event === "interview_closed") {
        clearPersistedRejoinState();
      }
      if (payload.event === "round_started") {
        if (payload.round_id) {
          activeRoundIdRef.current = payload.round_id;
        }
        handleTTSRoundStarted(payload.round_id ?? null);
      }
      return;
    }

    if (payload.event === "question_audio_ready") {
      const eventRoundId = (payload as QuestionAudioReadyPayload).round_id;
      if (!eventRoundId) {
        return;
      }

      // If active round ref is temporarily null (race between ws burst and state sync),
      // accept the first valid TTS payload and align refs/state to that round.
      if (activeRoundIdRef.current && eventRoundId !== activeRoundIdRef.current) {
        return;
      }

      if (!activeRoundIdRef.current) {
        activeRoundIdRef.current = eventRoundId;
        setActiveRoundId(eventRoundId);
      }

      handleQuestionAudioReady(payload as QuestionAudioReadyPayload);
      return;
    }

    if (payload.event === "tts_error") {
      const eventRoundId = (payload as TtsErrorPayload).round_id;
      if (!eventRoundId) {
        return;
      }

      if (activeRoundIdRef.current && eventRoundId !== activeRoundIdRef.current) {
        return;
      }

      if (!activeRoundIdRef.current) {
        activeRoundIdRef.current = eventRoundId;
        setActiveRoundId(eventRoundId);
      }

      handleTtsError(payload as TtsErrorPayload);
      return;
    }

    const senderId = payload.from || payload.user_id || "";
    if (!senderId || senderId === sessionUserId) {
      return;
    }

    if (payload.event === "join" || payload.event === "user_joined") {
      updateParticipant(senderId, (current) => ({
        socketId: senderId,
        displayName: payload?.displayName?.trim()
          ? payload.displayName.trim()
          : current?.displayName || normalizeUserLabel("", senderId),
        connected: true,
        level: current?.level || 0,
      }));

      restartRecorderForNewPeer(true);
      return;
    }

    if (payload.event === "request_resync") {
      restartRecorderForNewPeer(true);
      return;
    }

    if (payload.event === "leave" || payload.event === "user_left") {
      cleanupSenderPlayer(senderId);
      removeParticipant(senderId);
    }
  }, [
    activeRoundIdRef,
    activeRoundIndexRef,
    appendChunkForSender,
    cleanupSenderPlayer,
    currentQuestionRef,
    handleQuestionAudioReady,
    handleTTSRoundStarted,
    handleTtsError,
    markRemoteActivity,
    removeParticipant,
    restartRecorderForNewPeer,
    selectedMimeTypeRef,
    sessionStatusRef,
    setActiveRoundId,
    setActiveRoundIndex,
    setCurrentQuestion,
    setSessionStatus,
    setTotalRounds,
    shouldProcessRoundEvent,
    totalRoundsRef,
    updateParticipant,
  ]);

  return {
    handleSocketMessage,
  };
}
