import { useEffect, useRef, useState } from "react";
import { TabRhythmMode, AlphaTabApi } from '@coderline/alphatab';
import '../styles/AlphaTabViewer2.css';
import AlphaTabControls from "./AlphaTabControls";

interface AlphaTabViewerProps {
  file: File;
  files: File[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  convertingIndices?: number[];
  getSvg?: (fn: () => SVGElement | null) => void;
  onUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // ✅ ADD THIS (we need converted files access)
  convertedFiles?: File[];
}

export default function AlphaTabViewer({
  file,
  files,
  currentIndex,
  setCurrentIndex,
  convertingIndices,
  getSvg,
  onUpload,
  convertedFiles = [], // default safe
}: AlphaTabViewerProps) {

  const mainRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [api, setApi] = useState<AlphaTabApi>();
  const [tracks, setTracks] = useState<any[]>([]);
  const [trackPrograms, setTrackPrograms] = useState<Record<number, number>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!getSvg) return;
    getSvg(() => mainRef.current?.querySelector("svg") ?? null);
  }, [getSvg]);

  useEffect(() => {
    if (!mainRef.current || !viewportRef.current) return;

    const alphaApi = new AlphaTabApi(mainRef.current, {
      notation: {
        rhythmMode: TabRhythmMode.Hidden,
      },
      core: {
        fontDirectory: '/font/',
      },
      player: {
        enablePlayer: true,
        enableCursor: true,
        enableUserInteraction: true,
        scrollElement: viewportRef.current,
        soundFont: '/soundfont/sonivox.sf2',
      },
    });

    setApi(alphaApi);

    const unsubScore = alphaApi.scoreLoaded.on((score) => {
      setTracks(score.tracks);
      setTrackPrograms(prev => {
        score.tracks.forEach((track, index) => {
          if (prev[index] !== undefined) {
            track.playbackInfo.program = prev[index];
          }
        });
        return prev;
      });
    });

    let cancelled = false;

    const loadFile = async () => {
      setIsLoading(true);
      alphaApi.pause();
      const buffer = await file.arrayBuffer();
      if (!cancelled) {
        setTimeout(() => {
          alphaApi.load(buffer);
        }, 0);
      }
    };

    loadFile();

    const unsubRenderStart = alphaApi.renderStarted.on(() => setIsLoading(true));
    const unsubRenderFinish = alphaApi.renderFinished.on(() => setIsLoading(false));

    return () => {
      cancelled = true;
      unsubRenderStart();
      unsubRenderFinish();
      unsubScore();
      alphaApi.destroy();
    };
  }, [file]);

  const handleFullscreen = () => {
    if (!wrapRef.current) return;

    if (!document.fullscreenElement) {
      wrapRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
        setTimeout(() => api?.render(), 100);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = async () => {
      const inFullscreen = !!document.fullscreenElement;
      setIsFullscreen(inFullscreen);

      if (!inFullscreen && api) {
        api.pause();
        const buffer = await file.arrayBuffer();
        setTimeout(() => api.load(buffer), 0);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [api, file]);

  const isConverting = convertingIndices?.includes(currentIndex) ?? false;

  const currentConvertedFile = convertedFiles?.[currentIndex];

  const downloadCurrentFile = () => {
	if (!currentConvertedFile) return;
  
	const url = URL.createObjectURL(currentConvertedFile);
  
	const link = document.createElement("a");
	link.href = url;
	link.download = currentConvertedFile.name;
  
	document.body.appendChild(link);
	link.click();
  
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
  };

  return (
    <div className="at-wrap" ref={wrapRef}>

      {(isConverting || isLoading) && (
        <div className="at-overlay" style={{ display: 'flex' }}>
          <div className="at-overlay-content">
            {isConverting ? "Waiting for conversion..." : "Loading music sheet..."}
          </div>
        </div>
      )}

      <div className="at-content">

        <div className="at-sidebar">
          <label className="at-sidebar-upload">
            + Add File
            <input
              type="file"
              accept=".mscz,.musicxml,.jpg,.png"
              style={{ display: 'none' }}
              onChange={onUpload}
            />
          </label>

          {files.map((f, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              style={{
                margin: '0.3rem',
                padding: '0.5rem',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: index === currentIndex ? '#F56960' : '#FFFFFF33',
                color: 'white',
                width: '90%',
              }}
            >
              {convertingIndices?.includes(index)
                ? "Loading…"
                : f.name.length > 10
                  ? f.name.slice(0, 10) + "..."
                  : f.name}
            </button>
          ))}

          {/* ✅ NEW: Download button at bottom */}
          <div style={{ marginTop: 'auto', padding: '0.5rem' }}>
            <button
              onClick={downloadCurrentFile}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: currentConvertedFile ? '#F56960' : '#444',
                color: 'white',
                opacity: currentConvertedFile ? 1 : 0.5
              }}
              disabled={!currentConvertedFile}
            >
              Download Tab
            </button>
          </div>
        </div>

        <div className="at-viewport" ref={viewportRef}>
          <div className="at-main" ref={mainRef}></div>
        </div>

      </div>

      <div className="at-controls">
        <AlphaTabControls
          api={api}
          tracks={api?.tracks ?? []}
          trackPrograms={trackPrograms}
          setTrackPrograms={setTrackPrograms}
          reloadFile={async () => {
            if (!api) return;
            api.pause();
            const buffer = await file.arrayBuffer();
            setTimeout(() => api.load(buffer), 0);
          }}
          onFullscreen={handleFullscreen}
          isFullscreen={isFullscreen}
        />
      </div>
    </div>
  );
}