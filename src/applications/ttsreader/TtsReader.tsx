import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./ttsreader.css";

export function TtsReaderApp() {
  const [text, setText] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    function loadVoices() {
      setVoices(window.speechSynthesis.getVoices());
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [supported]);

  function speak() {
    if (!supported || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voices[voiceIndex]) utterance.voice = voices[voiceIndex];
    utterance.rate = rate;
    utterance.onend = () => {
      setSpeaking(false);
      setPaused(false);
    };
    utterance.onstart = () => setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function togglePause() {
    if (!supported) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }

  function stop() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        {!speaking ? (
          <button className="app-toolbar-btn" onClick={speak} disabled={!supported || !text.trim()}>
            <Icon name="volume" size={14} /> Read aloud
          </button>
        ) : (
          <>
            <button className="app-toolbar-btn" onClick={togglePause}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button className="app-toolbar-btn" onClick={stop}>
              Stop
            </button>
          </>
        )}
        <select
          value={voiceIndex}
          onChange={(e) => setVoiceIndex(Number(e.target.value))}
          className="tts-voice-select"
        >
          {voices.length === 0 && <option>Default voice</option>}
          {voices.map((v, i) => (
            <option key={v.voiceURI} value={i}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div className="app-content tts-content">
        {!supported && (
          <div className="tts-warning">Text-to-speech isn't available in this environment.</div>
        )}
        <textarea
          className="tts-textarea"
          placeholder="Paste or type text to have it read aloud…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="tts-rate-row">
          <span>Speed</span>
          <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          <span>{rate.toFixed(1)}x</span>
        </div>
      </div>
    </div>
  );
}
