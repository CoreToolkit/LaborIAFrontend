const CLIENT_MAGIC_A = 67; // 'C'
const CLIENT_MAGIC_B = 65; // 'A'
const GROUP_INTERVIEW_REJOIN_KEY = "laboria.groupInterview.rejoin";
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export const MAX_QUEUE_PER_SENDER = 60;

export type PersistedRejoinState = {
  roomId: string;
  displayName: string;
  userId: string;
  roleId: string;
};

export type UnwrappedIncomingAudio = {
  mimeType: string | null;
  audioBuffer: ArrayBuffer | null;
};

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const dataSize = buffer.length * numChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

export async function convertBlobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();
  return new Blob([audioBufferToWav(audioBuffer)], { type: "audio/wav" });
}

/**
 * Une múltiples WAV blobs (PCM 16-bit) en un único WAV.
 * Decodifica cada blob con AudioContext, concatena los samples de cada canal
 * y re-escribe el header RIFF con la longitud total.
 */
export async function mergeWavBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) {
    throw new Error("mergeWavBlobs: lista de segmentos vacía");
  }
  if (blobs.length === 1) {
    return blobs[0];
  }

  // Decodificar cada WAV a AudioBuffer
  const audioBuffers: AudioBuffer[] = [];
  for (const blob of blobs) {
    const ab = await blob.arrayBuffer();
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(ab);
    await ctx.close();
    audioBuffers.push(decoded);
  }

  const sampleRate = audioBuffers[0].sampleRate;
  const numChannels = audioBuffers[0].numberOfChannels;
  const totalLength = audioBuffers.reduce((sum, b) => sum + b.length, 0);

  // Concatenar los Float32 de cada canal
  const combinedData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of audioBuffers) {
      channelData.set(buf.getChannelData(ch), offset);
      offset += buf.length;
    }
    combinedData.push(channelData);
  }

  // Escribir WAV PCM 16-bit con el header RIFF
  const dataSize = totalLength * numChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const ws = (off: number, val: string) => {
    for (let i = 0; i < val.length; i++) view.setUint8(off + i, val.charCodeAt(i));
  };

  ws(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  ws(8, "WAVE");
  ws(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  ws(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < totalLength; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, combinedData[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export const readPersistedRejoinState = (): PersistedRejoinState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(GROUP_INTERVIEW_REJOIN_KEY);

    if (window.localStorage.getItem(GROUP_INTERVIEW_REJOIN_KEY)) {
      window.localStorage.removeItem(GROUP_INTERVIEW_REJOIN_KEY);
    }

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedRejoinState>;
    if (
      typeof parsed.roomId !== "string"
      || typeof parsed.displayName !== "string"
      || typeof parsed.userId !== "string"
    ) {
      return null;
    }

    return {
      roomId: parsed.roomId,
      displayName: parsed.displayName,
      userId: parsed.userId,
      roleId: typeof parsed.roleId === "string" ? parsed.roleId : "",
    };
  } catch {
    return null;
  }
};

export const persistRejoinState = (state: PersistedRejoinState): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(GROUP_INTERVIEW_REJOIN_KEY, JSON.stringify(state));
  } catch {
    return;
  }
};

export const clearPersistedRejoinState = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(GROUP_INTERVIEW_REJOIN_KEY);
    window.localStorage.removeItem(GROUP_INTERVIEW_REJOIN_KEY);
  } catch {
    return;
  }
};

export const resolveBackendHttpOrigin = (
  backendApiBase?: string,
  backendWsBase?: string,
): string => {
  if (backendApiBase) {
    return backendApiBase.replace(/\/+$/, "");
  }

  if (!backendWsBase) {
    return "";
  }

  const wsAsHttp = backendWsBase
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://")
    .replace(/\/+$/, "");

  return wsAsHttp.replace(/\/api\/ws$/i, "").replace(/\/ws$/i, "");
};

export const resolveBackendWsBase = (
  backendApiBase?: string,
  backendWsBase?: string,
): string => {
  if (backendWsBase) {
    return backendWsBase.replace(/\/+$/, "");
  }

  if (!backendApiBase) {
    return "";
  }

  const httpBase = backendApiBase.replace(/\/+$/, "");
  const wsBase = httpBase
    .replace(/^https:\/\//i, "wss://")
    .replace(/^http:\/\//i, "ws://");

  return `${wsBase}/api/ws`;
};

export const normalizeUserLabel = (name: string, socketId: string): string => {
  const safeName = name.trim();
  if (safeName) {
    return safeName;
  }

  return `Usuario-${socketId.slice(0, 5)}`;
};

export const pickSupportedMimeType = (): string => {
  for (const candidate of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return "";
};

export const wrapChunkWithClientHeader = (audioBuffer: ArrayBuffer, mimeType: string): ArrayBuffer => {
  const mimeBytes = new TextEncoder().encode(mimeType || "");
  const audioBytes = new Uint8Array(audioBuffer);
  const out = new Uint8Array(3 + mimeBytes.length + audioBytes.length);
  out[0] = CLIENT_MAGIC_A;
  out[1] = CLIENT_MAGIC_B;
  out[2] = Math.min(255, mimeBytes.length);
  out.set(mimeBytes.slice(0, 255), 3);
  out.set(audioBytes, 3 + Math.min(255, mimeBytes.length));
  return out.buffer;
};

export const unwrapIncomingAudioPayload = (audioData: ArrayBuffer): UnwrappedIncomingAudio => {
  const payload = new Uint8Array(audioData);
  if (payload.length >= 3 && payload[0] === CLIENT_MAGIC_A && payload[1] === CLIENT_MAGIC_B) {
    const mimeLen = payload[2];
    if (payload.length <= 3 + mimeLen) {
      return { mimeType: null, audioBuffer: null };
    }

    const mimeType = new TextDecoder().decode(payload.slice(3, 3 + mimeLen));
    const audioBytes = payload.slice(3 + mimeLen);
    const copy = new Uint8Array(audioBytes.length);
    copy.set(audioBytes);
    return { mimeType, audioBuffer: copy.buffer };
  }

  return { mimeType: null, audioBuffer: audioData.slice(0) };
};
