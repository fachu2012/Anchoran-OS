import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { saveGeneratedFile } from "@/core/saveGenerated";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";
import "./voicerecorder.css";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function VoiceRecorderApp() {
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const dataUrl = await blobToDataUrl(blob);
        setLastRecording(dataUrl);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Couldn't access the microphone.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
  }

  async function saveToFiles() {
    if (!lastRecording) return;
    const result = await saveGeneratedFile("audio", `Voice Memo ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.webm`, lastRecording);
    pushNotification("Voice Recorder", "error" in result ? result.error : "Saved to Music.");
    setLastRecording(null);
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="app-root">
      <div className="app-content voicerecorder-content">
        {error && <div className="voicerecorder-error">{error}</div>}
        <div className="voicerecorder-dot" data-recording={recording} />
        <div className="voicerecorder-time">{mm}:{ss}</div>
        {!recording ? (
          <button className="app-toolbar-btn" onClick={startRecording}>
            <Icon name="voiceRecorder" size={16} /> Start recording
          </button>
        ) : (
          <button className="app-toolbar-btn" onClick={stopRecording}>
            Stop
          </button>
        )}
        {lastRecording && (
          <div className="voicerecorder-result">
            <audio src={lastRecording} controls />
            <button className="app-toolbar-btn" onClick={saveToFiles}>
              Save to Files
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
