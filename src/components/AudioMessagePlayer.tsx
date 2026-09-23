import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioMessagePlayerProps {
  src: string;
  durationSeconds?: number;
  isSender?: boolean;
}

export const AudioMessagePlayer: React.FC<AudioMessagePlayerProps> = ({
  src,
  durationSeconds = 0,
  isSender = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setDuration(Math.round(audio.duration));
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => console.error('Audio play error:', err));
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Generate 26 pseudo-random deterministic waveform heights
  const bars = [
    28, 45, 70, 95, 60, 40, 65, 80, 50, 75, 90, 45, 30, 55, 85, 100, 70, 40, 60, 80, 95, 55, 35, 60, 80, 45
  ];

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 p-2 rounded-2xl select-none w-full min-w-[220px] max-w-[320px] ${
      isSender ? 'text-white' : 'text-slate-800 dark:text-slate-100'
    }`}>
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition shadow-sm ${
          isSender
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-sky-500 hover:bg-sky-600 text-white'
        }`}
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-0.5 fill-current" />}
      </button>

      {/* Waveform and progress */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 cursor-pointer" onClick={handleWaveformClick}>
        <div className="h-6 flex items-center gap-[3px] relative overflow-hidden">
          {bars.map((height, i) => {
            const barPct = (i / bars.length) * 100;
            const isPlayed = barPct <= progressPct;

            return (
              <div
                key={i}
                style={{ height: `${height}%` }}
                className={`flex-1 rounded-full transition-colors duration-150 ${
                  isPlayed
                    ? isSender ? 'bg-white' : 'bg-sky-500'
                    : isSender ? 'bg-white/40' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
            );
          })}
        </div>

        {/* Time and Speed indicator */}
        <div className="flex items-center justify-between text-[11px] font-mono opacity-80">
          <span>{formatTime(currentTime > 0 ? currentTime : duration)}</span>
          <button
            onClick={cycleSpeed}
            className={`px-1.5 py-0.2 rounded font-semibold text-[10px] uppercase transition ${
              isSender
                ? 'bg-white/20 hover:bg-white/30 text-white'
                : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};
