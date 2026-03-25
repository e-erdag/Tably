import { useEffect, useRef, useState } from "react";
import { AlphaTabApi, type json } from '@coderline/alphatab';

export default function AlphaTabViewer() {
  const mainRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [api, setApi] = useState<AlphaTabApi>();

  useEffect(() => {
    const api = new AlphaTabApi(mainRef.current!, {
      core: {
        file: '../../Ode to Joy.musicxml',
        fontDirectory: '/font/'
      },
      player: {
        enablePlayer: true,
        enableCursor: true,
        enableUserInteraction: true,
        scrollElement: viewportRef.current!,
        soundFont: '/soundfont/sonivox.sf2',
      }
    } as json.SettingsJson);

    setApi(api);

    api.renderStarted.on(() => {
      setIsLoading(true);
    });

    api.renderFinished.on(() => {
      setIsLoading(false);
    });

    return () => {
      console.log('destroy', mainRef, api);
      api.destroy();
    }
  }, []);



  return (
    <>
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
          <div className="at-sidebar">
            Track selector will go here
          </div>
          <div className="at-viewport" ref={viewportRef}>
              {/* <div className="at-main"></div> */}
              <div className="at-main" ref={mainRef}></div>
          </div>
        </div>
        <div className="at-controls">
          Controls will go here
        </div>
      </div>
    </>
  );
}