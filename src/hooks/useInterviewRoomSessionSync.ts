import React from "react";
import { type AudioPlayerQuestion } from "@/components/AudioPlayer";
import { extractGroupInterviewUiState } from "@/utils/groupInterview";

type UseInterviewRoomSessionSyncArgs = {
  backendHttpOriginRef: React.MutableRefObject<string | null>;
  activeRoundIdRef: React.MutableRefObject<string | null>;
  activeRoundIndexRef: React.MutableRefObject<number | null>;
  sessionStatusRef: React.MutableRefObject<string>;
  totalRoundsRef: React.MutableRefObject<number>;
  currentQuestionRef: React.MutableRefObject<AudioPlayerQuestion | null>;
  assignedUserIdRef: React.MutableRefObject<string | null>;
  setIsSyncingState: React.Dispatch<React.SetStateAction<boolean>>;
  setSessionStatus: React.Dispatch<React.SetStateAction<string>>;
  setActiveRoundId: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveRoundIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setTotalRounds: React.Dispatch<React.SetStateAction<number>>;
  setCurrentQuestion: React.Dispatch<React.SetStateAction<AudioPlayerQuestion | null>>;
  setAssignedUserId: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useInterviewRoomSessionSync({
  backendHttpOriginRef,
  activeRoundIdRef,
  activeRoundIndexRef,
  sessionStatusRef,
  totalRoundsRef,
  currentQuestionRef,
  assignedUserIdRef,
  setIsSyncingState,
  setSessionStatus,
  setActiveRoundId,
  setActiveRoundIndex,
  setTotalRounds,
  setCurrentQuestion,
  setAssignedUserId,
}: UseInterviewRoomSessionSyncArgs) {
  const syncRoomState = React.useCallback(async (headers: HeadersInit, sessionCode: string) => {
    const backendHttpOrigin = backendHttpOriginRef.current;
    if (!backendHttpOrigin) {
      return;
    }

    setIsSyncingState(true);
    try {
      const stateResponse = await fetch(
        `${backendHttpOrigin}/api/group-sessions/${encodeURIComponent(sessionCode)}/state`,
        {
          method: "GET",
          headers,
        },
      );

      if (!stateResponse.ok) {
        return;
      }

      const snapshot = await stateResponse.json();
      const restored = extractGroupInterviewUiState(snapshot);

      activeRoundIdRef.current = restored.roundId;
      activeRoundIndexRef.current = restored.roundIndex;
      sessionStatusRef.current = restored.status;
      totalRoundsRef.current = restored.totalRounds;

      // Sincronizar assignedUserId de la ronda activa
      if (restored.assignedUserId !== assignedUserIdRef.current) {
        assignedUserIdRef.current = restored.assignedUserId;
        setAssignedUserId(restored.assignedUserId);
      }

      setSessionStatus(restored.status);
      setActiveRoundId(restored.roundId);
      setActiveRoundIndex(restored.roundIndex);
      setTotalRounds(restored.totalRounds);

      if (restored.question) {
        const skill = restored.question.targetSkill ?? "General";
        const difficulty = restored.question.difficulty ?? "N/A";

        const restoredQuestion: AudioPlayerQuestion = {
          id: restored.question.roundId || `round-${restored.question.roundIndex ?? "active"}`,
          text: restored.question.text,
          note: `Skill objetivo: ${skill} | Dificultad: ${difficulty}`,
          targetSkill: restored.question.targetSkill ?? null,
        };

        currentQuestionRef.current = restoredQuestion;
        setCurrentQuestion(restoredQuestion);
      }
    } catch {
      return;
    } finally {
      setIsSyncingState(false);
    }
  }, [
    activeRoundIdRef,
    activeRoundIndexRef,
    assignedUserIdRef,
    backendHttpOriginRef,
    currentQuestionRef,
    sessionStatusRef,
    setActiveRoundId,
    setActiveRoundIndex,
    setAssignedUserId,
    setCurrentQuestion,
    setIsSyncingState,
    setSessionStatus,
    setTotalRounds,
    totalRoundsRef,
  ]);

  return {
    syncRoomState,
  };
}
