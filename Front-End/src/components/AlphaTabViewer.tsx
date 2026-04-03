import { useEffect, useRef, useState } from "react";
import { TabRhythmMode, AlphaTabApi, type json } from '@coderline/alphatab';
import '../styles/AlphaTabViewer2.css'
import AlphaTabControls from "./AlphaTabControls";


//interface containg all the data coming from GuitarTabPage
interface AlphaTabViewerProps {
	file: File; //currently selected file to view
	files: File[]; //all uploaded files
	currentIndex: number; //currently selected file
	setCurrentIndex: (index: number) => void; //function that changed current file
	convertingIndices?: number[]; //for keep track of files in process of converting
}

export default function AlphaTabViewer({ file, files, currentIndex, setCurrentIndex, convertingIndices }: AlphaTabViewerProps) {

  const mainRef = useRef<HTMLDivElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [api, setApi] = useState<AlphaTabApi>();
	const [tracks, setTracks] = useState<any[]>([]);
	const [trackPrograms, setTrackPrograms] = useState<Record<number, number>>({});

	useEffect(() => {
		const api = new AlphaTabApi(mainRef.current!, {
			notation: {
				rhythmMode: TabRhythmMode.Hidden // Used to hide stem lines
				// Not granular, so will need to be changed if we want to display
				// sheet music next to guitar tab. 
			},
			core: {
				fontDirectory: '/font/'
			},
			player: {
				enablePlayer: true,
				enableCursor: true,
				enableUserInteraction: true,
				scrollElement: viewportRef.current!,
				soundFont: '/soundfont/sonivox.sf2', 

			}
		});

		setApi(api);

		let cancelled = false;
		const loadFile = async () => {
			setIsLoading(true);
			const buffer = await file.arrayBuffer();
			if(!cancelled)
				api.load(buffer);
		};
		loadFile();

		api.renderStarted.on(() => {
			setIsLoading(true);
		});

		api.renderFinished.on(() => {
			setIsLoading(false);
		});

		// for getting different tracks like guitar or piano
		api.scoreLoaded.on((score) => {
			setTracks(score.tracks);
		});


		//for handling user moving cursor via clicks
		const unsubNoteUp = api.noteMouseUp.on((note) => {
			if (note)  api.playBeat(note.beat);
		});

		const unsubBeatUp = api.beatMouseUp.on((beat) => {
			if (beat) api.playBeat(beat);
		});

		return () => {
			cancelled = true;
			unsubNoteUp();
			unsubBeatUp();
			api.destroy();
		}
	}, [file]);



	return (
		<div className="at-wrap">
			<div 
				className='at-overlay'
				style={{ 
					display: isLoading ? 'flex' : 'none'
				}}
			>
				<div className='at-overlay-content' >
					Music sheet is loading...
				</div>
			</div>
			<div className="at-content">
				{/* menu for selecting between uploaded tracks */}
				<div className="at-sidebar"> 
					{files.map((f, index) => (
					<button
						key={index}
						onClick={() => setCurrentIndex(index)} //select file
						style={{
							margin: '0.3rem',
							padding: '0.5rem',
							borderRadius: '6px',
							border: 'none',
							cursor: 'pointer',
							background: index === currentIndex ? '#F56960' : '#FFFFFF33',
							color: 'white',
							width: '90%'
						}}
					>
						{convertingIndices?.includes(index)
							? "Loading…"  // if file is still converting
							: f.name.length > 10
								? f.name.slice(0, 10) + "..."
								: f.name
						}
					</button>
				))}
				</div>
				
				<div className="at-viewport" ref={viewportRef}>
					{/* <div className="at-main"></div> */}
					<div className="at-main" ref={mainRef}></div>

					{/*if current file still converting*/}
					{convertingIndices?.includes(currentIndex) && (
						<div className="at-overlay" style={{ display: 'flex' }}>
							<div className="at-overlay-content">
								Waiting for convertion...
							</div>
						</div>
					)}

					{/*If current file is being loaded by alphatab*/}
					{isLoading && !convertingIndices?.includes(currentIndex) && (
						<div className="at-overlay" style={{ display: 'flex' }}>
							<div className="at-overlay-content">
								Loading Music Sheet...
							</div>
						</div>
					)}
				</div>
			</div>

			{/*Passing tracks and api to AlphaTabControls for playback + sound selection*/}
			<div className="at-controls">
				<AlphaTabControls
					api={api}
					tracks={api?.tracks ?? []}
					trackPrograms={trackPrograms}
					setTrackPrograms={setTrackPrograms}
					reloadFile={async () => {  //
						if (!api) return;
						api.stop();
						const buffer = await file.arrayBuffer();  // now valid

						// Assign selected program per track before loading
						api.tracks.forEach((track, index) => {
							track.playbackInfo.program = trackPrograms[index] ?? track.playbackInfo.program;
						});
            api.scoreLoaded.on(() => {
              api.play();
            });
						api.load(buffer);
						
					}}
				/>
			</div>
		</div>
	);
}