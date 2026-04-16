import { useEffect, useRef, useState } from "react";
import { TabRhythmMode, AlphaTabApi } from '@coderline/alphatab';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
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

  const waitForRenderOrTimeout = async (renderApi: AlphaTabApi, timeoutMs = 2000) => {
    await Promise.race([
      waitForRender(renderApi),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  };

  const waitForFonts = async () => {
    if ("fonts" in document) {
      await document.fonts.ready;
    }
  };

  const renderExportDocument = async () => {
    await waitForFonts();
    const exportHost = document.createElement("div");
    exportHost.style.position = "fixed";
    exportHost.style.left = "-10000px";
    exportHost.style.top = "0";
    exportHost.style.width = "1122px";
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
      core: {
        fontDirectory: "/font/",
        enableLazyLoading: false,
      },
      display: {
        scale: 0.8,
        stretchForce: 0.8,
      },
      notation: {
        rhythmMode: TabRhythmMode.Hidden,
      },
      player: {
        enablePlayer: false,
        enableCursor: false,
        enableUserInteraction: false,
      },
    });

    const cleanup = () => {
      exportApi.destroy();
      document.body.removeChild(exportHost);
    };

    const renderPromise = waitForRender(exportApi);
    const buffer = await file.arrayBuffer();
    exportApi.load(buffer);
    await renderPromise;
    await waitForRenderOrTimeout(exportApi, 2500);
    await new Promise((resolve) => setTimeout(resolve, 600));
    await waitForFonts();

    return {
      exportMain,
      cleanup,
    };
  };

  const cropCanvasToContent = (sourceCanvas: HTMLCanvasElement) => {
    const ctx = sourceCanvas.getContext("2d");
    if (!ctx) {
      return sourceCanvas;
    }

    const { width, height } = sourceCanvas;
    const imageData = ctx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const r = imageData[index];
        const g = imageData[index + 1];
        const b = imageData[index + 2];
        const a = imageData[index + 3];
        const isContent = a > 0 && (r < 245 || g < 245 || b < 245);
        if (!isContent) continue;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (maxX < minX || maxY < minY) {
      return sourceCanvas;
    }

    const padding = 24;
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropWidth = Math.min(width - cropX, maxX - minX + padding * 2);
    const cropHeight = Math.min(height - cropY, maxY - minY + padding * 2);

    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedCtx = croppedCanvas.getContext("2d");
    if (!croppedCtx) {
      return sourceCanvas;
    }

    croppedCtx.fillStyle = "#ffffff";
    croppedCtx.fillRect(0, 0, cropWidth, cropHeight);
    croppedCtx.drawImage(
      sourceCanvas,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight,
    );

    return croppedCanvas;
  };

  const downloadPDF = async () => {
    try {
      const { exportMain, cleanup } = await renderExportDocument();
      try {
        if (!exportMain.querySelector("svg, canvas")) {
          throw new Error("No rendered tablature pages were found for export.");
        }

        const capturedCanvas = await html2canvas(exportMain, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
          width: exportMain.scrollWidth,
          height: exportMain.scrollHeight,
          windowWidth: exportMain.scrollWidth,
          windowHeight: exportMain.scrollHeight,
        });
        const canvas = cropCanvasToContent(capturedCanvas);

        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "pt",
          format: "a4",
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 24;
        const usableWidth = pageWidth - margin * 2;
        const usableHeight = pageHeight - margin * 2;
        const scale = usableWidth / canvas.width;
        const sliceHeightPx = Math.max(1, Math.floor(usableHeight / scale));

        let offsetY = 0;
        let pageIndex = 0;

        while (offsetY < canvas.height) {
          const currentSliceHeight = Math.min(sliceHeightPx, canvas.height - offsetY);
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = currentSliceHeight;

          const ctx = pageCanvas.getContext("2d");
          if (!ctx) {
            throw new Error("Canvas context unavailable");
          }

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            offsetY,
            canvas.width,
            currentSliceHeight,
            0,
            0,
            canvas.width,
            currentSliceHeight,
          );

          const imageData = pageCanvas.toDataURL("image/png");
          const renderedHeight = currentSliceHeight * scale;

          if (pageIndex > 0) {
            pdf.addPage(
              "a4",
              "portrait",
            );
          }

          pdf.addImage(imageData, "PNG", margin, margin, usableWidth, renderedHeight);

          offsetY += currentSliceHeight;
          pageIndex += 1;
        }

        pdf.save("tab.pdf");
      } finally {
        cleanup();
      }
    } catch (error) {
      console.error("PDF export failed", error);
      window.alert("PDF export failed. Please open the browser console and send me the error.");
    }
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
