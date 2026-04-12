
import { useState, Dispatch, SetStateAction } from "react";
import { AlphaTabApi } from "@coderline/alphatab";


interface AlphaTabControlsProps {
	api?: AlphaTabApi;
	tracks: any[];

	trackPrograms: Record<number, number>;
	setTrackPrograms: Dispatch<SetStateAction<Record<number, number>>>;
	reloadFile: () => void;
}

export default function AlphaTabControls({
	api,
	tracks,
	trackPrograms,
	setTrackPrograms,
	reloadFile
}: AlphaTabControlsProps) {
	const [isPlaying, setIsPlaying] = useState(false);
	const [speed, setSpeed] = useState(1);
	const [metronomeOn, setMetronomeOn] = useState(false);
	const [activeTrack, setActiveTrack] = useState(0);


	// Start/Stop api calls
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

	//change speed api call
	const changeSpeed = (newSpeed: number) => {
		if (!api) return;
		api.playbackSpeed = newSpeed; // correct AlphaTab speed prop
		setSpeed(newSpeed);
	};

	//Enable/disbale metronome api call
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

	//determining out list of instruments with soundFont number
	const instruments = [
		{ name: "Piano", program: 0 },
		{ name: "Acoustic Guitar", program: 24 },
		// { name: "Steel Guitar", program: 25 },
		{ name: "Bass", program: 32 },
		{ name: "Drums", program: 115 },
	];

	// Map instrument names to their MIDI program numbers
	const getProgramForTrack = (trackName: string) => {
		const name = trackName.trim().toLowerCase();
		if (name.includes("guitar")) return 24; // Acoustic Guitar (Nylon)
		if (name.includes("piano")) return 0;   // Acoustic Grand Piano
		if (name.includes("bass")) return 32;   // Bass Finger
		if (name.includes("drum")) return 115;  // Drum Kit
		return 0; // fallback to piano
	};


	// Map instruments to specific logos
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
		const nextSpeed = speeds[nextIndex];

		changeSpeed(nextSpeed);
	};

	return (
		<div className="controls-bar">
			{/* LEFT: Track selectors */}
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
								className={`track-button ${
									activeTrack === index ? "active" : ""
								}`}
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

			{/* CENTER: Playback controls */}
			<div className="button-group center">
				<button onClick={togglePlay}>
					{isPlaying ? "Pause" : "Play"}
				</button>

				<button onClick={stop}>Reset</button>

				<button onClick={cycleSpeed}>
					{speed}×
				</button>

				<button
					onClick={toggleMetronome}
					className={`metronome-btn ${metronomeOn ? "active" : ""}`}
				>
					Metronome
				</button>
			</div>

			{/* RIGHT: empty spacer (balances layout) */}
			<div className="spacer" />
		</div>
	);
}
