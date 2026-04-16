import React from "react";
import { Loader2, RefreshCw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import BlurText from "@/components/BlurText";
import { generateInterviewQuestionAudio } from "@/services/interviewService";

export interface AudioPlayerQuestion {
  id: string;
  text: string;
  note?: string;
}

interface AudioPlayerProps {
  question: AudioPlayerQuestion;
  authToken: string | null;
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

export function AudioPlayer({ question, authToken }: AudioPlayerProps) {
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

  const handleTextChange = React.useCallback((nextValue: string) => {
    setTextToSpeak(nextValue);
    setError(null);

    if (generatedText !== nextValue.trim()) {
      shouldPlayAfterLoadRef.current = false;
      setGeneratedText(null);
      replaceAudioUrl(null);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.load();
      }
    }
  }, [generatedText, replaceAudioUrl]);

  const handleGenerateOrPlay = React.useCallback(async () => {
    if (isLoading) {
      return;
    }

    const normalizedText = textToSpeak.trim();
    if (!normalizedText) {
      setError("Debes ingresar un texto para generar audio.");
      return;
    }

    if (audioUrl && generatedText === normalizedText) {
      await playExistingAudio();
      return;
    }

    if (!authToken) {
      setError("Tu sesion no es valida. Inicia sesion nuevamente.");
      return;
    }

    setIsLoading(true);
    setError(null);
    shouldPlayAfterLoadRef.current = true;

    const currentRequest = requestSequenceRef.current + 1;
    requestSequenceRef.current = currentRequest;

    try {
      const response = await generateInterviewQuestionAudio({ text: normalizedText }, authToken);

      if (requestSequenceRef.current !== currentRequest) {
        return;
      }

      const blob = createAudioBlob(response.audioBase64, response.mimeType);
      const nextUrl = URL.createObjectURL(blob);
      replaceAudioUrl(nextUrl);
      setGeneratedText(normalizedText);
    } catch (requestError) {
      if (requestSequenceRef.current !== currentRequest) {
        return;
      }

      shouldPlayAfterLoadRef.current = false;
      const message =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : "No se pudo generar el audio de la pregunta.";
      setError(message);
    } finally {
      if (requestSequenceRef.current === currentRequest) {
        setIsLoading(false);
      }
    }
  }, [audioUrl, authToken, generatedText, isLoading, playExistingAudio, replaceAudioUrl, textToSpeak]);

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
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-64">
          <Button
            type="button"
            onClick={() => void handleGenerateOrPlay()}
            disabled={isLoading}
            className="gap-2 bg-cyan-600 hover:bg-cyan-700"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
            {isLoading
              ? "Generando audio..."
              : hasAudioForCurrentText
                ? "Reproducir audio"
                : "Generar audio"}
          </Button>

          {hasAudioForCurrentText && (
            <p className="text-xs text-slate-500">
              El audio ya generado se reutiliza mientras no cambie el texto.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Label htmlFor={`audio-player-text-${question.id}`}>Texto a reproducir</Label>
        <textarea
          id={`audio-player-text-${question.id}`}
          value={textToSpeak}
          onChange={(event) => handleTextChange(event.target.value)}
          rows={4}
          className="mt-2 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-900 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Escribe el texto que quieres convertir a audio"
        />
        <p className="mt-2 text-xs text-slate-500">
          Puedes editar el texto sugerido antes de generar el audio. Esta accion no genera preguntas nuevas.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 gap-2"
            onClick={() => void handleGenerateOrPlay()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        {hasAudioForCurrentText ? (
          <audio
            ref={audioRef}
            controls
            preload="none"
            src={audioUrl || undefined}
            className="w-full"
            onError={() => setError(AUDIO_PLAYBACK_ERROR)}
          >
            Tu navegador no soporta reproduccion de audio.
          </audio>
        ) : (
          <p className="text-sm text-slate-500">
            Genera el audio cuando lo necesites. No se solicita TTS automaticamente.
          </p>
        )}
      </div>
    </section>
  );
}
