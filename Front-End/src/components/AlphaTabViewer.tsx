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

  	const mainRef = useRef<HTMLDivElement>(null); //where alphatabs will render tabs
	const viewportRef = useRef<HTMLDivElement>(null); //making tabs scrollable
	const [isLoading, setIsLoading] = useState(true); //load state
	const [api, setApi] = useState<AlphaTabApi>(); //the alphatab api instance
	const [tracks, setTracks] = useState<any[]>([]); //stores tracks (music to play) TODO
	const [trackPrograms, setTrackPrograms] = useState<Record<number, number>>({}); //selected instrument to play
	const [isFullscreen, setIsFullscreen] = useState(false); //stores wether fullscreen mode active or not

	useEffect(() => {
		// create instance of AlphaTabs api
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
				enablePlayer: true, //enables playback
				enableCursor: true, //moving cursor
				enableUserInteraction: true, //clicking interaction
				scrollElement: viewportRef.current!, //autoscroll
				soundFont: '/soundfont/sonivox.sf2', //sound bank for the playback

			}
		});

		//setting api to use as declared api instance
		setApi(api);

		//event functions

		//when tabs are loaded, set tracks and remove loading pop up
		const unsubScore = api.scoreLoaded.on((score) => {
			setTracks(score.tracks);
			setIsLoading(false);

			//also apply respective instrument to each track
			score.tracks.forEach((track, index) => {
				track.playbackInfo.program =
					trackPrograms[index] ?? track.playbackInfo.program;
			});
		});

		let cancelled = false;

		//loading file into alphatabs
		const loadFile = async () => {
			setIsLoading(true); //show loading popup

			api.pause(); //stop current playbacks

			//converting file to raw bytes for alphatab to parse 
			//this is what allows tabs to build/render
			const buffer = await file.arrayBuffer();
			if (!cancelled) {

				//loads file via ALphaTabs
				setTimeout(() => {
					api.load(buffer);
				}, 0);
			}
		};
		loadFile();

		//if render started show loading popup
		const unsubRenderStart = api.renderStarted.on(() => {
			setIsLoading(true);
		});

		//if render done remove popup
		const unsubRenderFinish = api.renderFinished.on(() => {
			setIsLoading(false);
		});

		//disable not click during playback to prevent audio bug
		const unsubNoteUp = api.noteMouseUp.on(() => {});

		const unsubBeatUp = api.beatMouseUp.on(() => {});
		

		return () => {
			cancelled = true;
			unsubRenderStart();
			unsubRenderFinish();
			unsubNoteUp();
			unsubBeatUp();
			unsubScore();
			api.destroy(); //destroy current alphatab instance when file is not being displayed
		}
	}, [file]); //whenever new file selected



	const handleFullscreen = () => {
	if (mainRef.current) {
		mainRef.current.requestFullscreen().then(() => {
		setTimeout(() => {
			api?.render(); 
		}, 100);
		});
	}
	};

	useEffect(() => {
		const handleFullscreenChange = async () => {
			if (!document.fullscreenElement && api) {
			api.pause();
			const buffer = await file.arrayBuffer();
			setTimeout(() => { api.load(buffer); }, 0);
			}
		};

		document.addEventListener('fullscreenchange', handleFullscreenChange);
		return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
	}, [api, file]);


	return (
		<div className="at-wrap">
			{/* while file is being processed */}
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
					{/* get uploaded files for files list */}
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

					//function for reloading tabs (re renders entirely)
					reloadFile={async () => {
						if (!api) return;

						api.pause();

						const buffer = await file.arrayBuffer();

						setTimeout(() => {
							api.load(buffer);
						}, 0);
					}}
					onFullscreen={handleFullscreen}
				/>
			</div>
		</div>
	);
}