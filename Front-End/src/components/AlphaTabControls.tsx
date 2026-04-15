
import { useState, Dispatch, SetStateAction } from "react";
import { AlphaTabApi } from "@coderline/alphatab";
import { Button, Group, Popover, SimpleGrid, Stack } from "@mantine/core";
import { IconMetronome, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPlayerSkipBackFilled } from '@tabler/icons-react'

//interface to keep track of properties 
interface AlphaTabControlsProps {
	api?: AlphaTabApi; //api instance
  isPlaying: boolean; // Whether the score is playing
  metronomeOn: boolean;
  setMetronomeOn: any;
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
  isPlaying,
  metronomeOn,
  setMetronomeOn,
  onFullscreen
}: AlphaTabControlsProps) {
	const [speed, setSpeed] = useState(1); //playback speed
  const [speedOpened, setSpeedOpened] = useState(false); // is speed popover open?

	// Start/Stop api calls
	//calling alphatabs playback engine
	const togglePlay = () => {
		if (!api) return;
		api.playPause(); // safe play/pause
	};

	const stop = () => {
		if (!api) return;
		api.stop(); // stops playback and resets position
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

	const speeds = [0.25, 0.5, 0.75, 1, 1.5, 1.75, 2];

	return (
		<Group
      className='at-controls'
      justify="space-between"
      px='clamp(1rem, 5%, 100px)'
    >
			{/* Playback Controls */}
      <Group justify="flex-start" wrap='nowrap'>
        {/* reset (send to beginning) */}
				<Button onClick={stop}>
          <IconPlayerSkipBackFilled />
        </Button>

        {/* play/pause */}
        <Button onClick={togglePlay}>
          {
            isPlaying 
            ?  
            <IconPlayerPauseFilled />
            : 
            <IconPlayerPlayFilled />
          }
        </Button>

				{/* select speed */}
        <Popover 
          position="top"
          withArrow
          shadow='md'
          opened={speedOpened}
          onChange={setSpeedOpened}
        >
          <Popover.Target>
            <Button onClick={() => setSpeedOpened(!speedOpened)}>
              {speed}×
            </Button>
          </Popover.Target>
					<Popover.Dropdown p='8'>
            <Stack gap='0'>
              {
                speeds.map((s) => 
                  <Button 
                    variant='subtle' 
                    style={{ boxShadow: 'none' }}
                    color='red.5'
                    onClick={() => { changeSpeed(s); setSpeedOpened((o) => !o) }}
                    p='0 10px'
                  >
                    {s}×
                  </Button>
                )
              }
            </Stack>
          </Popover.Dropdown>
				</Popover>
        <Button
					onClick={toggleMetronome}
					bg={metronomeOn ? undefined : 'rgba(255, 255, 255, 0.12)'}
          c={metronomeOn ? undefined : '#ccc'}
				>
					<IconMetronome />
				</Button>
      </Group>

      <Group justify="flex-end">
        {/* fullscreen button */}
        <Button onClick={onFullscreen}>
          ⛶ Fullscreen
        </Button>
      </Group>
		</Group>
	);
}
