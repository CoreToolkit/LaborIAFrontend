import React from "react";
import type { QuestionAudioReadyPayload, TtsErrorPayload } from "@/utils/groupInterview";

export type TTSAudioStatus = "unavailable" | "ready" | "playing" | "ended";

type TTSAudioState = {
    roundId: string | null;
    audioUrl: string | null;
    status: TTSAudioStatus;
};

const INITIAL_STATE: TTSAudioState = {
    roundId: null,
    audioUrl: null,
    status: "unavailable",
};

const isValidBase64 = (value: string): boolean => {
    if (!value || !value.trim()) {
        return false;
    }
    try {
        // Intentar decodificar un fragmento para validar
        window.atob(value.trim().slice(0, 64));
        return true;
    } catch {
        return false;
    }
};

const decodeBase64ToBlob = (base64: string): Blob | null => {
    try {
        const binary = window.atob(base64.trim());
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: "audio/mpeg" });
    } catch {
        return null;
    }
};

export function useTTSAudioPlayer(activeRoundId: string | null) {
    const stateRef = React.useRef<TTSAudioState>({ ...INITIAL_STATE });
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const [ttsStatus, setTtsStatus] = React.useState<TTSAudioStatus>("unavailable");

    // Ref para que los callbacks siempre lean el activeRoundId más reciente
    // sin necesitar recrearse cuando cambia.
    const activeRoundIdRef = React.useRef<string | null>(activeRoundId);
    React.useEffect(() => {
        activeRoundIdRef.current = activeRoundId;
    }, [activeRoundId]);

    const updateStatus = React.useCallback((status: TTSAudioStatus) => {
        stateRef.current.status = status;
        setTtsStatus(status);
    }, []);

    const stopAndRevokeCurrentAudio = React.useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.src = "";
            audioRef.current = null;
        }

        const url = stateRef.current.audioUrl;
        if (url) {
            URL.revokeObjectURL(url);
            stateRef.current.audioUrl = null;
        }
    }, []);

    const handleQuestionAudioReady = React.useCallback(
        (payload: QuestionAudioReadyPayload) => {
            // Validar que el evento corresponde a la ronda activa (round_id es fuente principal de verdad)
            // Leer desde ref para evitar closure stale — activeRoundId puede haber cambiado
            // desde que se definió este callback.
            const currentActiveRoundId = activeRoundIdRef.current;
            if (!payload.round_id || payload.round_id !== currentActiveRoundId) {
                return;
            }

            // Deduplicación: ignorar si ya procesamos este round_id
            if (stateRef.current.roundId === payload.round_id && stateRef.current.status !== "unavailable") {
                return;
            }

            // Validar audio_b64
            if (!payload.audio_b64 || !isValidBase64(payload.audio_b64)) {
                console.warn("[useTTSAudioPlayer] audio_b64 inválido o vacío para round_id:", payload.round_id);
                stateRef.current.roundId = payload.round_id;
                updateStatus("unavailable");
                return;
            }

            // Guard: API Audio disponible
            if (typeof Audio === "undefined") {
                stateRef.current.roundId = payload.round_id;
                updateStatus("unavailable");
                return;
            }

            // Detener y limpiar audio anterior
            stopAndRevokeCurrentAudio();

            // Decodificar base64 → Blob → object URL
            const blob = decodeBase64ToBlob(payload.audio_b64);
            if (!blob) {
                console.warn("[useTTSAudioPlayer] Error decodificando base64 para round_id:", payload.round_id);
                stateRef.current.roundId = payload.round_id;
                updateStatus("unavailable");
                return;
            }

            let objectUrl: string;
            try {
                objectUrl = URL.createObjectURL(blob);
            } catch {
                console.warn("[useTTSAudioPlayer] Error creando object URL para round_id:", payload.round_id);
                stateRef.current.roundId = payload.round_id;
                updateStatus("unavailable");
                return;
            }

            stateRef.current.roundId = payload.round_id;
            stateRef.current.audioUrl = objectUrl;
            updateStatus("ready");

            // Crear elemento de audio y reproducir
            const audio = new Audio(objectUrl);
            audioRef.current = audio;

            audio.addEventListener("ended", () => {
                // Solo actualizar si sigue siendo el mismo audio activo
                if (audioRef.current === audio) {
                    updateStatus("ended");
                }
            });

            audio.addEventListener("error", () => {
                if (audioRef.current === audio) {
                    console.warn("[useTTSAudioPlayer] Error de reproducción para round_id:", payload.round_id);
                    updateStatus("unavailable");
                }
            });

            void audio.play().then(() => {
                if (audioRef.current === audio) {
                    updateStatus("playing");
                }
            }).catch((err: unknown) => {
                // Autoplay bloqueado u otro error: dejar en 'ready' si es NotAllowedError
                if (audioRef.current === audio) {
                    const isAutoplayBlocked =
                        err instanceof Error && err.name === "NotAllowedError";
                    if (isAutoplayBlocked) {
                        // Audio listo pero no reproduciendo — sesión no se rompe
                        updateStatus("ready");
                    } else {
                        console.warn("[useTTSAudioPlayer] Error al reproducir audio:", err);
                        updateStatus("unavailable");
                    }
                }
            });
        },
        // Sin dependencia en activeRoundId — se lee desde activeRoundIdRef para evitar stale closure
        [stopAndRevokeCurrentAudio, updateStatus],
    );

    const handleTtsError = React.useCallback(
        (payload: TtsErrorPayload) => {
            // Validar ronda activa — leer desde ref para evitar closure stale
            const currentActiveRoundId = activeRoundIdRef.current;
            if (!payload.round_id || payload.round_id !== currentActiveRoundId) {
                return;
            }

            stateRef.current.roundId = payload.round_id;
            stopAndRevokeCurrentAudio();
            updateStatus("unavailable");
        },
        // Sin dependencia en activeRoundId — se lee desde activeRoundIdRef para evitar stale closure
        [stopAndRevokeCurrentAudio, updateStatus],
    );

    const handleRoundStarted = React.useCallback(
        (newRoundId: string | null) => {
            stopAndRevokeCurrentAudio();
            stateRef.current.roundId = newRoundId;
            updateStatus("unavailable");
        },
        [stopAndRevokeCurrentAudio, updateStatus],
    );

    const cleanup = React.useCallback(() => {
        stopAndRevokeCurrentAudio();
        stateRef.current = { ...INITIAL_STATE };
        setTtsStatus("unavailable");
    }, [stopAndRevokeCurrentAudio]);

    // Limpiar al desmontar
    React.useEffect(() => {
        return () => {
            const audio = audioRef.current;
            if (audio) {
                audio.pause();
                audio.src = "";
            }
            const url = stateRef.current.audioUrl;
            if (url) {
                URL.revokeObjectURL(url);
            }
        };
    }, []);

    return {
        ttsStatus,
        handleQuestionAudioReady,
        handleTtsError,
        handleRoundStarted,
        cleanup,
    };
}
