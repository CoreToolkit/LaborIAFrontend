import React from "react";
import { Loader2, RefreshCw, Volume2, VolumeX, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import BlurText from "@/components/BlurText";
import { generateInterviewQuestionAudio } from "@/services/interviewService";
import type { TTSAudioStatus } from "@/hooks/useTTSAudioPlayer";

export interface AudioPlayerQuestion {
  id: string;
  text: string;
  note?: string;
  targetSkill?: string | null;
  isIntro?: boolean;
  selectedUserId?: number | null;
  selectedUserName?: string | null;
}

interface AudioPlayerProps {
  question: AudioPlayerQuestion;
  authToken: string | null;
  ttsStatus?: TTSAudioStatus;
}

const AUDIO_PLAYBACK_ERROR = "No se pudo reproducir el audio generado.";

const extractBase64Payload = (
  audioBase64: string
): { mimeType: string | null; base64Data: string } => {
  const normalized = audioBase64.trim();
  const dataUrlMatch = normalized.match(/^data:(.+?);base64,(.+)$/);

  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1] || null,
      base64Data: dataUrlMatch[2] || "",
    };
  }

  return {
    mimeType: null,
    base64Data: normalized,
  };
};

const createAudioBlob = (audioBase64: string, fallbackMimeType: string | null): Blob => {
  const { mimeType, base64Data } = extractBase64Payload(audioBase64);
  const binary = window.atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], {
    type: mimeType || fallbackMimeType || "audio/mpeg",
  });
};

export function AudioPlayer({ question, authToken, ttsStatus }: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = React.useRef<string | null>(null);
  const requestSequenceRef = React.useRef(0);
  const shouldPlayAfterLoadRef = React.useRef(false);

  const [textToSpeak, setTextToSpeak] = React.useState(question.text);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [generatedText, setGeneratedText] = React.useState<string | null>(null);

  const replaceAudioUrl = React.useCallback((nextUrl: string | null) => {
    if (currentAudioUrlRef.current && currentAudioUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
    }

    currentAudioUrlRef.current = nextUrl;
    setAudioUrl(nextUrl);
  }, []);

  React.useEffect(() => {
    requestSequenceRef.current += 1;
    shouldPlayAfterLoadRef.current = false;
    setTextToSpeak(question.text);
    setIsLoading(false);
    setError(null);
    setGeneratedText(null);
    replaceAudioUrl(null);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
    }
  }, [question.id, question.text, replaceAudioUrl]);

  React.useEffect(() => {
    return () => {
      shouldPlayAfterLoadRef.current = false;
      requestSequenceRef.current += 1;
      replaceAudioUrl(null);
    };
  }, [replaceAudioUrl]);

  React.useEffect(() => {
    if (!audioUrl || !shouldPlayAfterLoadRef.current || !audioRef.current) {
      return;
    }

    shouldPlayAfterLoadRef.current = false;
    audioRef.current.currentTime = 0;
    void audioRef.current.play().catch(() => {
      return;
    });
  }, [audioUrl]);

  const playExistingAudio = React.useCallback(async (): Promise<boolean> => {
    if (!audioRef.current || !audioUrl || generatedText !== textToSpeak.trim()) {
      return false;
    }

    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      return true;
    } catch {
      setError(AUDIO_PLAYBACK_ERROR);
      return false;
    }
  }, [audioUrl, generatedText, textToSpeak]);

  const hasAudioForCurrentText = Boolean(audioUrl) && generatedText === textToSpeak.trim();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pregunta activa
          </p>
          <BlurText
            key={question.id}
            text={question.text}
            delay={90}
            animateBy="words"
            direction="top"
            className="mt-2 text-base font-semibold text-slate-900"
          />
          {question.note && (
            <p className="mt-2 text-sm text-slate-500">{question.note}</p>
          )}
          {ttsStatus && ttsStatus !== "unavailable" && (
            <div className="mt-2 flex items-center gap-1.5">
              {ttsStatus === "playing" && (
                <>
                  <Waves className="h-3.5 w-3.5 animate-pulse text-cyan-600" />
                  <span className="text-xs font-medium text-cyan-700">Reproduciendo audio...</span>
                </>
              )}
              {ttsStatus === "ready" && (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-xs text-slate-500">Audio listo</span>
                </>
              )}
              {ttsStatus === "ended" && (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-400">Audio reproducido</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-64">


          {hasAudioForCurrentText && (
            <p className="text-xs text-slate-500">
              El audio ya generado se reutiliza mientras no cambie el texto.
            </p>
          )}
        </div>
      </div>



      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
          <p>{error}</p>
        </div>
      )}
    </section>
  );
}
