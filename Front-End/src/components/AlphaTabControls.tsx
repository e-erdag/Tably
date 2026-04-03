import { useState } from "react";
import { AlphaTabApi } from "@coderline/alphatab";

interface AlphaTabControlsProps {
  api?: AlphaTabApi;
}

export default function AlphaTabControls({ api }: AlphaTabControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [metronomeOn, setMetronomeOn] = useState(false);

  const togglePlay = () => {
    if (!api) return;
    api.playPause(); // safe play/pause
    setIsPlaying((prev) => !prev);
  };

  const stop = () => {
    if (!api) return;
    api.stop(); // stops playback and resets position
    setIsPlaying(false);
  };

  const changeSpeed = (newSpeed: number) => {
    if (!api) return;
    api.playbackSpeed = newSpeed; // correct AlphaTab speed prop
    setSpeed(newSpeed);
  };

  const toggleMetronome = () => {
    if (!api) return;
    // using volume toggle, since metronomeEnabled itself isn't on player
    if (metronomeOn) {
      api.metronomeVolume = 0;
    } else {
      api.metronomeVolume = 1;
    }
    setMetronomeOn(!metronomeOn);
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <button onClick={togglePlay}>{isPlaying ? "Pause" : "Play"}</button>
      <button onClick={stop}>Stop</button>

      <button onClick={() => changeSpeed(1)}>1x</button>
      <button onClick={() => changeSpeed(1.5)}>1.5x</button>
      <button onClick={() => changeSpeed(2)}>2x</button>

      <button onClick={toggleMetronome}>
        Metronome {metronomeOn ? "On" : "Off"}
      </button>

      <span>Speed: {speed}×</span>
    </div>
  );
}