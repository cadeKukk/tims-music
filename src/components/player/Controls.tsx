'use client';

import { Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { usePlaybackTime, usePlayer } from './PlayerProvider';
import { formatTime } from '@/lib/cover';

export function PlayPauseIcon({ className = 'size-5' }: { className?: string }) {
  const { playing, buffering } = usePlayer();
  if (buffering && playing) return <Loader2 className={`${className} animate-spin`} />;
  return playing ? <Pause className={className} fill="currentColor" /> : <Play className={`${className} translate-x-[1px]`} fill="currentColor" />;
}

export function Controls({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { toggle, next, prev, shuffle, toggleShuffle, repeat, cycleRepeat, current } = usePlayer();
  const lg = size === 'lg';
  const side = lg ? 'size-6' : 'size-[18px]';
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;
  return (
    <div className={`flex items-center justify-center ${lg ? 'gap-7' : 'gap-5'}`}>
      <button
        onClick={toggleShuffle}
        aria-label="Shuffle"
        aria-pressed={shuffle}
        title="Shuffle (S)"
        className={`relative transition ${shuffle ? 'text-accent' : 'text-muted hover:text-fg'}`}
      >
        <Shuffle className={side} />
        {shuffle && <span className="absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />}
      </button>
      <button onClick={prev} aria-label="Previous" title="Previous (Shift+←)" className="text-fg/80 transition hover:text-fg" disabled={!current}>
        <SkipBack className={lg ? 'size-8' : 'size-5'} fill="currentColor" />
      </button>
      <button
        onClick={toggle}
        aria-label="Play or pause"
        title="Play/Pause (Space)"
        disabled={!current}
        className={`grid place-items-center rounded-full bg-fg text-black transition hover:scale-105 active:scale-95 disabled:opacity-40 ${lg ? 'size-16' : 'size-9'}`}
      >
        <PlayPauseIcon className={lg ? 'size-7' : 'size-[18px]'} />
      </button>
      <button onClick={next} aria-label="Next" title="Next (Shift+→)" className="text-fg/80 transition hover:text-fg" disabled={!current}>
        <SkipForward className={lg ? 'size-8' : 'size-5'} fill="currentColor" />
      </button>
      <button
        onClick={cycleRepeat}
        aria-label={`Repeat: ${repeat}`}
        title="Repeat (R)"
        className={`relative transition ${repeat !== 'off' ? 'text-accent' : 'text-muted hover:text-fg'}`}
      >
        <RepeatIcon className={side} />
        {repeat !== 'off' && <span className="absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />}
      </button>
    </div>
  );
}

export function SeekBar({ className = '' }: { className?: string }) {
  const { time, duration } = usePlaybackTime();
  const { seek, current } = usePlayer();
  const max = duration || current?.duration || 0;
  const pct = max ? (time / max) * 100 : 0;
  return (
    <div className={`flex items-center gap-2 text-[11px] tabular-nums text-muted ${className}`}>
      <span className="w-10 text-right">{formatTime(time)}</span>
      <input
        type="range"
        className="range flex-1"
        min={0}
        max={max || 1}
        step={0.1}
        value={Math.min(time, max)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Seek"
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
      />
      <span className="w-10">{formatTime(max)}</span>
    </div>
  );
}
