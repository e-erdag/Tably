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
  convertedFiles = [],
}: AlphaTabViewerProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [api, setApi] = useState<AlphaTabApi>();
  const [trackPrograms, setTrackPrograms] = useState<Record<number, number>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  useEffect(() => {
    if (getSvg) {
      getSvg(() => mainRef.current?.querySelector("svg") ?? null);
    }
  }, [getSvg]);

  useEffect(() => {
    if (!file || !mainRef.current || !viewportRef.current) return;

    setMetronomeOn(false);

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
      },
    });

    setApi(alphaApi);

    const loadSoundFonts = async () => {
      const [sonivox, guitar] = await Promise.all([
        fetch('/soundfont/sonivox.sf3').then(r => r.arrayBuffer()),
        fetch('/soundfont/Classical-Guitar-Hedsound.sf3').then(r => r.arrayBuffer()),
      ]);
      alphaApi.loadSoundFont(new Uint8Array(sonivox), false);
      alphaApi.loadSoundFont(new Uint8Array(guitar), true);
    };

    loadSoundFonts();

    const unsubPlayerState = alphaApi.playerStateChanged.on((args) => {
      setIsPlaying(args.state === 1);
    });

    const unsubScore = alphaApi.scoreLoaded.on((score) => {
      score.tracks.forEach((track, index) => {
        track.playbackInfo.program =
          trackPrograms[index] ?? track.playbackInfo.program;
      });
    });

    const unsubRenderStart = alphaApi.renderStarted.on(() => setIsLoading(true));
    const unsubRenderFinish = alphaApi.renderFinished.on(() => setIsLoading(false));

    let cancelled = false;

    const loadFile = async () => {
      setIsLoading(true);
      alphaApi.pause();
      const buffer = await file.arrayBuffer();
      if (!cancelled) {
        setTimeout(() => alphaApi.load(buffer), 0);
      }
    };

    loadFile();

    return () => {
      cancelled = true;
      unsubRenderStart();
      unsubRenderFinish();
      unsubScore();
      unsubPlayerState();
      alphaApi.destroy();
    };
  }, [file]);

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

  const downloadMusicXML = () => {
    if (!currentConvertedFile) return;
    const url = URL.createObjectURL(currentConvertedFile);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentConvertedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPNG = async () => {
    const viewport = viewportRef.current;
    const container = mainRef.current;
    if (!viewport || !container) return;

    // Scroll through to force full render
    const totalScroll = viewport.scrollHeight;
    const step = viewport.clientHeight;
    for (let y = 0; y < totalScroll; y += step) {
      viewport.scrollTop = y;
      await new Promise((r) => setTimeout(r, 100));
    }
    viewport.scrollTop = 0;
    await new Promise((r) => setTimeout(r, 100));

    const svgs = Array.from(container.querySelectorAll("svg"));
    if (svgs.length === 0) return;

    const sizes = svgs.map((svg) => ({
      svg,
      width: svg.viewBox.baseVal.width || svg.clientWidth,
      height: svg.viewBox.baseVal.height || svg.clientHeight,
    }));

    const totalWidth = Math.max(...sizes.map(s => s.width));
    const totalHeight = sizes.reduce((sum, s) => sum + s.height, 0);

    const canvas = document.createElement("canvas");
    canvas.width = totalWidth;
    canvas.height = totalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    let offsetY = 0;
    let pending = sizes.length;

    sizes.forEach(({ svg, width, height }) => {
      const clone = svg.cloneNode(true) as SVGElement;
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));

      const svgString = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      const capturedOffsetY = offsetY;

      img.onload = () => {
        ctx.drawImage(img, 0, capturedOffsetY, width, height);
        URL.revokeObjectURL(url);
        pending--;
        if (pending === 0) {
          canvas.toBlob((blob) => {
            if (!blob) return;
            const pngUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = pngUrl;
            a.download = "tab.png";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(pngUrl);
          }, "image/png");
        }
      };

      img.src = url;
      offsetY += height;
    });
  };

  const isConverting = convertingIndices?.includes(currentIndex) ?? false;
  const currentConvertedFile = convertedFiles?.[currentIndex];

  return (
    <div className="at-wrap" ref={wrapRef}>

      {/* Loading / converting overlay */}
      {(isConverting || isLoading) && (
        <div className="at-overlay" style={{ display: 'flex' }}>
          <div className="at-overlay-content">
            {isConverting ? "Converting Sheet Music..." : "Loading Guitar Tab..."}
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

          <div style={{ marginTop: 'auto', padding: '0.5rem' }}>
            <button
              onClick={() => setShowDownloadModal(true)}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: currentConvertedFile ? '#F56960' : '#444',
                color: 'white',
                opacity: currentConvertedFile ? 1 : 0.5,
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

      <AlphaTabControls
        api={api}
        tracks={api?.tracks ?? []}
        trackPrograms={trackPrograms}
        setTrackPrograms={setTrackPrograms}
        isPlaying={isPlaying}
        metronomeOn={metronomeOn}
        setMetronomeOn={setMetronomeOn}
        reloadFile={async () => {
          if (!api) return;
          api.pause();
          const buffer = await file.arrayBuffer();
          setTimeout(() => api.load(buffer), 0);
        }}
        onFullscreen={handleFullscreen}
        // isFullscreen={isFullscreen}
      />

      {showDownloadModal && (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0,
            width: "100%", height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setShowDownloadModal(false)}
        >
          <div
            style={{
              background: "white",
              padding: "20px",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              minWidth: "200px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0 }}>Download as</h3>
            <button onClick={() => { downloadMusicXML(); setShowDownloadModal(false); }}>
              MusicXML
            </button>
            <button onClick={() => { downloadPNG(); setShowDownloadModal(false); }}>
              PNG Image
            </button>
            <button onClick={() => setShowDownloadModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}