import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { saveGeneratedFile } from "@/core/saveGenerated";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";
import "./screenrecorder.css";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Not every codec MediaRecorder claims via mimeType is actually
// encodable on every machine — vp9 in particular can be missing or
// broken depending on the GPU/driver, and used to fail the whole
// recording silently. Falls through to whatever this Chromium build
// can actually encode, down to the browser's own unspecified default.
const CANDIDATE_MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

function pickSupportedMimeType(): string | undefined {
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function ScreenRecorderApp() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastRecording, setLastRecording] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const pushNotification = useNotificationStore((s) => s.push);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    },
    []
  );

  async function startRecording() {
    setError(null);
    if (!window.anchoran) {
      setError("Screen recording needs the Anchoran desktop app.");
      return;
    }
    try {
      const sources = await window.anchoran.getCaptureSources();
      if (sources.length === 0) throw new Error("no sources");
      // Explicit resolution/frame-rate constraints — without them,
      // Chromium's desktop capture can default to a much lower
      // resolution than the real screen instead of the full thing.
      const constraints = {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sources[0].id,
            minWidth: window.screen.width * window.devicePixelRatio,
            maxWidth: window.screen.width * window.devicePixelRatio,
            minHeight: window.screen.height * window.devicePixelRatio,
            maxHeight: window.screen.height * window.devicePixelRatio,
            maxFrameRate: 30,
          },
        },
      } as unknown as MediaStreamConstraints;
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = (e) => {
        setError(`Recording failed: ${(e as unknown as { error?: Error }).error?.message ?? "unknown error"}`);
        setRecording(false);
        if (timerRef.current) window.clearInterval(timerRef.current);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length === 0) {
          setError("The recording didn't capture any data — try again.");
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        if (blob.size === 0) {
          setError("The recording came out empty — try again.");
          return;
        }
        setLastRecording(await blobToDataUrl(blob));
      };
      // A periodic timeslice means chunks are flushed as you go rather
      // than only once at the very end, so a longer recording isn't
      // riding entirely on a single final dataavailable event.
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setError(err instanceof Error ? `Couldn't start screen recording: ${err.message}` : "Couldn't start screen recording.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
  }

  async function saveToFiles() {
    if (!lastRecording) return;
    const result = await saveGeneratedFile(
      "video",
      `Screen Recording ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.webm`,
      lastRecording
    );
    pushNotification("Screen Recorder", "error" in result ? result.error : "Saved to Videos.");
    setLastRecording(null);
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="app-root">
      <div className="app-content screenrecorder-content">
        {error && <div className="screenrecorder-error">{error}</div>}
        <div className="screenrecorder-dot" data-recording={recording} />
        <div className="screenrecorder-time">{mm}:{ss}</div>
        {!recording ? (
          <button className="app-toolbar-btn" onClick={startRecording}>
            <Icon name="screenshot" size={16} /> Start recording
          </button>
        ) : (
          <button className="app-toolbar-btn" onClick={stopRecording}>
            Stop
          </button>
        )}
        {lastRecording && (
          <div className="screenrecorder-result">
            <video src={lastRecording} controls />
            <button className="app-toolbar-btn" onClick={saveToFiles}>
              Save to Files
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
