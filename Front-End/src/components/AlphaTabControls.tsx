import { useState, Dispatch, SetStateAction } from "react";
import { AlphaTabApi } from "@coderline/alphatab";

interface AlphaTabControlsProps {
  api?: AlphaTabApi;
  tracks: any[];
  trackPrograms: Record<number, number>;
  setTrackPrograms: Dispatch<SetStateAction<Record<number, number>>>;
  reloadFile: () => void;
  onFullscreen: () => void;
  isFullscreen?: boolean; // ✅ NEW
}

export default function AlphaTabControls({
  api,
  tracks,
  trackPrograms,
  setTrackPrograms,
  reloadFile,
  onFullscreen,
  isFullscreen = false, // ✅ NEW
}: AlphaTabControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [activeTrack, setActiveTrack] = useState(0);

  const togglePlay = () => {
    if (!api) return;
    api.playPause();
    setIsPlaying((prev) => !prev);
  };

  const stop = () => {
    if (!api) return;
    api.stop();
    setIsPlaying(false);
  };

  const changeSpeed = (newSpeed: number) => {
    if (!api) return;
    api.playbackSpeed = newSpeed;
    setSpeed(newSpeed);
  };

  const toggleMetronome = () => {
    if (!api) return;
    if (metronomeOn) {
      api.metronomeVolume = 0;
    } else {
      api.metronomeVolume = 1;
    }
    setMetronomeOn(!metronomeOn);
  };

  const instruments = [
    { name: "Piano", program: 0 },
    { name: "Acoustic Guitar", program: 24 },
    { name: "Bass", program: 32 },
    { name: "Drums", program: 115 },
  ];

  const getIconFromProgram = (program: number) => {
    if ([24, 25, 26, 27, 28].includes(program)) return "🎸";
    if (program === 0) return "🎹";
    if ([32, 33].includes(program)) return "🎸";
    if (program === 115) return "🥁";
    return "🎵";
  };

  const speeds = [1, 1.5, 2];

  const cycleSpeed = () => {
    const currentIndex = speeds.indexOf(speed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    changeSpeed(speeds[nextIndex]);
  };

  return (
    <div className="controls-bar">
      {/* Track selector */}
      <div className="track-inline">
        {tracks.map((track, index) => {
          const selectedProgram =
            trackPrograms[index] ?? track.playbackInfo.program ?? 0;

          return (
            <div key={index} className="track-inline-item">
              <button
                onClick={async () => {
                  if (!api) return;
                  api.stop();
                  track.playbackInfo.program =
                    trackPrograms[index] ?? track.playbackInfo.program;
                  await reloadFile();
                  setActiveTrack(index);
                  setIsPlaying(true);
                }}
                className={`track-button ${activeTrack === index ? "active" : ""}`}
              >
                {getIconFromProgram(selectedProgram)} {track.name}
              </button>

              <select
                value={selectedProgram}
                onChange={async (e) => {
                  const newProgram = Number(e.target.value);
                  setTrackPrograms((prev) => ({
                    ...prev,
                    [index]: newProgram,
                  }));
                  await reloadFile();
                }}
              >
                {instruments.map((inst) => (
                  <option key={inst.program} value={inst.program}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {/* Playback controls */}
      <div className="button-group center">
        <button onClick={togglePlay}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button onClick={stop}>Reset</button>
        <button onClick={cycleSpeed}>{speed}×</button>
        <button
          onClick={toggleMetronome}
          className={`metronome-btn ${metronomeOn ? "active" : ""}`}
        >
          Metronome
        </button>
      </div>

      <div className="spacer" />

      {/* ✅ Fullscreen toggle button — label swaps based on state */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '150px', justifyContent: 'flex-end' }}>
        <button onClick={onFullscreen}>
          {isFullscreen ? "⛶" : "⛶"}
        </button>
      </div>
    </div>
  );
}