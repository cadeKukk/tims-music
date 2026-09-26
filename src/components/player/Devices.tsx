'use client';

import { useState } from 'react';
import { Laptop, MonitorSpeaker, Smartphone, Tablet } from 'lucide-react';
import { useConnect } from './ConnectLayer';
import { Sheet } from '../playlists/PlaylistsProvider';
import { useSession } from '../account/SessionProvider';

const ICONS = { phone: Smartphone, tablet: Tablet, computer: Laptop } as const;

/** Speaker button that opens the device picker. Hidden for guests. */
export function DevicesButton({ className = '', size = 'size-[18px]' }: { className?: string; size?: string }) {
  const { enabled, devices, isRemote } = useConnect();
  const [open, setOpen] = useState(false);
  if (!enabled) return null;
  const others = devices.filter((d) => !d.isMe).length;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Devices"
        aria-label={`Devices${others ? ` (${others} other online)` : ''}`}
        className={`relative transition ${isRemote ? 'text-accent' : 'hover:text-fg'} ${className}`}
      >
        <MonitorSpeaker className={size} />
        {others > 0 && !isRemote && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent" />}
      </button>
      {open && <DevicesSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function DevicesSheet({ onClose }: { onClose: () => void }) {
  const { devices, transferTo, isRemote } = useConnect();
  const { user } = useSession();
  const sorted = [...devices].sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name));
  return (
    <Sheet title="Listen on" subtitle={isRemote ? 'Controlling another device' : undefined} onClose={onClose}>
      <ul className="p-1">
        {sorted.map((d) => {
          const Icon = ICONS[d.kind] ?? Laptop;
          return (
            <li key={d.id}>
              <button
                onClick={() => { transferTo(d.id); onClose(); }}
                className={`flex w-full items-center gap-4 rounded-xl p-3 text-left transition hover:bg-hover ${d.isActive ? 'bg-accent/10' : ''}`}
              >
                <Icon className={`size-7 shrink-0 ${d.isActive ? 'text-accent' : 'text-muted'}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-semibold ${d.isActive ? 'text-accent' : ''}`}>
                    {d.isMe ? 'This device' : d.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {d.isMe ? d.name : ''}{d.isActive ? `${d.isMe ? ' · ' : ''}Playing now` : d.isMe ? '' : 'Tap to play here'}
                  </span>
                </span>
                {d.isActive && <span className="eq"><span /><span /><span /></span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-3 pt-2 text-xs text-muted">
        Open Echo Chamber on your phone or computer, signed in as <b className="text-fg">{user?.username}</b>, and it shows up here.
        Tap a device to move the music to it; the others become remotes.
      </p>
    </Sheet>
  );
}

/** Small "Playing on Mac · Chrome" label shown while this device is acting as a remote. */
export function PlayingOn({ className = '' }: { className?: string }) {
  const { isRemote, activeName } = useConnect();
  if (!isRemote || !activeName) return null;
  return (
    <span className={`flex items-center gap-1.5 truncate text-xs font-semibold text-accent ${className}`}>
      <MonitorSpeaker className="size-3.5 shrink-0" /> Playing on {activeName}
    </span>
  );
}
