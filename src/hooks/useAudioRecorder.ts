import React from "react";
import { convertBlobToWav } from "@/utils/interviewRoom";

const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 5_000;
const GRACE_PERIOD_MS = 3_000;

export function useAudioRecorder({ onComplete }: { onComplete: (wavBlob: Blob) => void }) {
  const [isRecording, setIsRecording] = React.useState(false);
  const [micError, setMicError] = React.useState<string | null>(null);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const onCompleteRef = React.useRef(onComplete);
  const stopRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const stopAudioContext = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, []);

  const stopRecording = React.useCallback(() => {
    stopAudioContext();

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    recorder.onstop = async () => {
      const chunks = chunksRef.current.splice(0);
      const mimeType = recorder.mimeType;
      recorderRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setIsRecording(false);
      if (chunks.length === 0) return;
      try {
        const webmBlob = new Blob(chunks, { type: mimeType });
        const wavBlob = await convertBlobToWav(webmBlob);
        onCompleteRef.current(wavBlob);
      } catch {
        setMicError("Error al procesar el audio. Intenta de nuevo.");
      }
    };

    recorder.stop();
  }, [stopAudioContext]);

  React.useEffect(() => {
    stopRef.current = stopRecording;
  }, [stopRecording]);

  const startRecording = React.useCallback(async () => {
    setMicError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError("No se pudo acceder al micrófono. Verifica los permisos.");
      return;
    }

    streamRef.current = stream;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(250);
    recorderRef.current = recorder;
    setIsRecording(true);

    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;
    void audioCtx.resume().catch(() => undefined);

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    audioCtx.createMediaStreamSource(stream).connect(analyser);

    const dataArray = new Uint8Array(analyser.fftSize);
    let silenceAccumMs = 0;
    let graceRemaining = GRACE_PERIOD_MS;
    let lastTs: number | null = null;

    const monitorSilence = (ts: number) => {
      if (!audioContextRef.current) return;

      if (audioContextRef.current.state === "suspended") {
        void audioContextRef.current.resume().catch(() => undefined);
        rafRef.current = requestAnimationFrame(monitorSilence);
        return;
      }

      const delta = Math.min(lastTs !== null ? ts - lastTs : 16, 200);
      lastTs = ts;

      if (graceRemaining > 0) {
        graceRemaining -= delta;
        rafRef.current = requestAnimationFrame(monitorSilence);
        return;
      }

      analyser.getByteTimeDomainData(dataArray);
      let sumSq = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const n = (dataArray[i] - 128) / 128;
        sumSq += n * n;
      }
      const rms = Math.sqrt(sumSq / dataArray.length);

      if (rms < SILENCE_THRESHOLD) {
        silenceAccumMs += delta;
        if (silenceAccumMs >= SILENCE_DURATION_MS) {
          stopRef.current?.();
          return;
        }
      } else {
        silenceAccumMs = 0;
      }

      rafRef.current = requestAnimationFrame(monitorSilence);
    };

    rafRef.current = requestAnimationFrame(monitorSilence);
  }, []);

  React.useEffect(
    () => () => {
      stopAudioContext();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    },
    [stopAudioContext]
  );

  return { isRecording, micError, startRecording, stopRecording };
}
