import { useEffect, useRef, useState } from "react";
import { TabRhythmMode, AlphaTabApi } from '@coderline/alphatab';
import { jsPDF } from 'jspdf';
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

  const waitForRender = (renderApi: AlphaTabApi) =>
    new Promise<void>((resolve) => {
      const unsubscribe = renderApi.renderFinished.on(() => {
        unsubscribe();
        resolve();
      });
    });

  const renderExportSvgs = async () => {
    const exportHost = document.createElement("div");
    exportHost.style.position = "fixed";
    exportHost.style.left = "-10000px";
    exportHost.style.top = "0";
    exportHost.style.width = `${Math.max(mainRef.current?.clientWidth ?? 0, 1200)}px`;
    exportHost.style.background = "#ffffff";
    exportHost.style.padding = "24px";
    exportHost.style.overflow = "visible";
    exportHost.style.zIndex = "-1";

    const exportMain = document.createElement("div");
    exportMain.style.background = "#ffffff";
    exportMain.style.overflow = "visible";
    exportHost.appendChild(exportMain);
    document.body.appendChild(exportHost);

    const exportApi = new AlphaTabApi(exportMain, {
      notation: {
        rhythmMode: TabRhythmMode.Hidden,
      },
      core: {
        fontDirectory: "/font/",
      },
      player: {
        enablePlayer: false,
        enableCursor: false,
        enableUserInteraction: false,
      },
    });

    try {
      const renderPromise = waitForRender(exportApi);
      const buffer = await file.arrayBuffer();
      exportApi.load(buffer);
      await renderPromise;
      await new Promise((resolve) => setTimeout(resolve, 150));

      return Array.from(
        exportMain.querySelectorAll<SVGGraphicsElement>("svg"),
      );
    } finally {
      exportApi.destroy();
      document.body.removeChild(exportHost);
    }
  };

  const svgToPageImage = async (svg: SVGGraphicsElement) => {
    const bbox = svg.getBBox();
    const padding = 24;
    const width = Math.max(1, Math.ceil(bbox.width + padding * 2));
    const height = Math.max(1, Math.ceil(bbox.height + padding * 2));

    const clone = svg.cloneNode(true) as SVGGraphicsElement;
    clone.setAttribute(
      "viewBox",
      `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`,
    );
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("preserveAspectRatio", "xMinYMin meet");

    const svgString = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    try {
      return await new Promise<{ imageData: string; width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context unavailable"));
            return;
          }

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve({
            imageData: canvas.toDataURL("image/png"),
            width,
            height,
          });
        };
        img.onerror = reject;
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const downloadPDF = async () => {
    const svgs = await renderExportSvgs();
    if (svgs.length === 0) return;

    const pages = await Promise.all(svgs.map(svgToPageImage));

    const firstPage = pages[0];
    const pdf = new jsPDF({
      orientation: firstPage.width >= firstPage.height ? "landscape" : "portrait",
      unit: "pt",
      format: [firstPage.width, firstPage.height],
    });

    pages.forEach((page, index) => {
      if (index > 0) {
        pdf.addPage(
          [page.width, page.height],
          page.width >= page.height ? "landscape" : "portrait",
        );
      }
      pdf.addImage(page.imageData, "PNG", 0, 0, page.width, page.height);
    });

    pdf.save("tab.pdf");
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
            <button onClick={() => { downloadPDF(); setShowDownloadModal(false); }}>
              PDF Document
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
