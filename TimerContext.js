import React from 'react';
import { getSetting, setSetting } from './database';

// Study timer lives above the screens so it keeps running while switching tabs.
export const TimerContext = React.createContext(null);

export function TimerProvider({ children }) {
  const [duration, setDuration] = React.useState(25);
  const [secondsLeft, setSecondsLeft] = React.useState(25 * 60);
  const [running, setRunning] = React.useState(false);
  const [phase, setPhase] = React.useState('focus'); // 'focus' | 'break'
  const [rounds, setRounds] = React.useState(0);
  const ref = React.useRef(null);

  React.useEffect(() => {
    (async () => {
      const d = await getSetting('timerMinutes', 25);
      setDuration(d);
      setSecondsLeft(d * 60);
    })();
    return () => clearInterval(ref.current);
  }, []);

  const stop = React.useCallback(() => {
    clearInterval(ref.current);
    ref.current = null;
    setRunning(false);
  }, []);

  const start = React.useCallback(() => {
    if (ref.current) return;
    setRunning(true);
    ref.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s > 1) return s - 1;
        clearInterval(ref.current);
        ref.current = null;
        setRunning(false);
        setPhase(p => {
          if (p === 'focus') { setRounds(r => r + 1); setSecondsLeft(5 * 60); return 'break'; }
          setSecondsLeft(duration * 60);
          return 'focus';
        });
        return 0;
      });
    }, 1000);
  }, [duration]);

  const toggle = React.useCallback(() => { running ? stop() : start(); }, [running, start, stop]);

  const reset = React.useCallback(() => {
    stop();
    setPhase('focus');
    setSecondsLeft(duration * 60);
  }, [duration, stop]);

  const changeDuration = React.useCallback(async (mins) => {
    stop();
    setDuration(mins);
    setPhase('focus');
    setSecondsLeft(mins * 60);
    await setSetting('timerMinutes', mins);
  }, [stop]);

  const total = phase === 'focus' ? duration * 60 : 5 * 60;
  const value = {
    duration, secondsLeft, running, phase, rounds,
    progress: total ? 1 - secondsLeft / total : 0,
    mm: String(Math.floor(secondsLeft / 60)).padStart(2, '0'),
    ss: String(secondsLeft % 60).padStart(2, '0'),
    toggle, reset, changeDuration,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export const useTimer = () => React.useContext(TimerContext);
