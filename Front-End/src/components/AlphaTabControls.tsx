
import { useState, Dispatch, SetStateAction } from "react";
import { AlphaTabApi } from "@coderline/alphatab";

//interface to keep track of properties 
interface AlphaTabControlsProps {
	api?: AlphaTabApi; //api instance
	tracks: any[]; //list of tracks available
	trackPrograms: Record<number, number>; //stores instrument for each track
	setTrackPrograms: Dispatch<SetStateAction<Record<number, number>>>; //updating instrument selection
	reloadFile: () => void; //reloading music
	//rebuilds and rerenders tab score, actually parses the music again
	//we have to do this because for instrument changes and file changes the alphatabs api itself has no way to change on fly
	onFullscreen: () => void; //triggering fullscreen
}

export default function AlphaTabControls({
	api,
	tracks,
	trackPrograms,
	setTrackPrograms,
	reloadFile,
	onFullscreen
}: AlphaTabControlsProps) {
	const [isPlaying, setIsPlaying] = useState(false); //play/pause button state
	const [speed, setSpeed] = useState(1); //playback speed
	const [metronomeOn, setMetronomeOn] = useState(false); //is metrone on
	const [activeTrack, setActiveTrack] = useState(0); //which track is currently selected



	// Start/Stop api calls
	//calling alphatabs playback engine
	const togglePlay = () => {
		if (!api) return;
		api.playPause(); // safe play/pause
		setIsPlaying((prev) => !prev); //this line actually changes ui state with call
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
		// using volume toggle since for some reason Alphatab doesnt have on and off call for metronome
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

	// Map instrument names to apropriate MIDI  numbers
	const getProgramForTrack = (trackName: string) => {
		const name = trackName.trim().toLowerCase();
		if (name.includes("guitar")) return 24; // acoustic specifically
		if (name.includes("piano")) return 0;   
		if (name.includes("bass")) return 32;  
		if (name.includes("drum")) return 115; 
		return 0; // or fallback to piano
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

	//cycles through available speeds
	const cycleSpeed = () => {
		const currentIndex = speeds.indexOf(speed);
		const nextIndex = (currentIndex + 1) % speeds.length;
		const nextSpeed = speeds[nextIndex];

		changeSpeed(nextSpeed);
	};

	
	return (
		<div className="controls-bar">
			{/* track selector ui */}
			<div className="track-inline">
				{/* go through tracks to get selected instrument */}
				{tracks.map((track, index) => {
					const selectedProgram =
						trackPrograms[index] ?? track.playbackInfo.program ?? 0;

					return (
						<div key={index} className="track-inline-item">
							<button
								// when new track selected
								onClick={async () => {
									if (!api) return;
									api.stop(); //stop playback

									//apply instrument change
									track.playbackInfo.program =
										trackPrograms[index] ?? track.playbackInfo.program;

									//reload file
									await reloadFile();

									//set the active track
									setActiveTrack(index);

									//THEN start playing (audio bug without this approach)
									setIsPlaying(true);
								}}
								className={`track-button ${
									activeTrack === index ? "active" : ""
								}`}
							>
								{/* update icon */}
								{getIconFromProgram(selectedProgram)} {track.name}
							</button>

							{/*actual instrument dropdown  */}
							<select
								value={selectedProgram}
								onChange={async (e) => {
									// update selected instrument
									const newProgram = Number(e.target.value);
									setTrackPrograms((prev) => ({
										...prev,
										[index]: newProgram,
									}));

									// reload file to apply the changes
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

			{/* Playback Controls */}
			<div className="button-group center">

				{/* play/pause */}
				<button onClick={togglePlay}>
					{isPlaying ? "Pause" : "Play"}
				</button>

				{/* reset (send to beginning) */}
				<button onClick={stop}>Reset</button>

				{/* cycle through speeds */}
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

			<div className="spacer" />

			{/* fullscreen button */}
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '150px', justifyContent: 'flex-end' }}>
				<button onClick={onFullscreen}>⛶ Fullscreen</button>
			</div>
		</div>
	);
}
