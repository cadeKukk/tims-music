export type ArtistRef = { id: string; slug: string; name: string };

export type Album = {
  id: string;
  slug: string;
  title: string;
  base_title: string;
  edition: string | null;
  kind: 'album' | 'live' | 'compilation' | 'single';
  year: number | null;
  cover_key: string | null;
  color_bg: string | null;
  color_accent: string | null;
  disc_count: number;
  track_count: number;
  duration_sec: number;
  added_at: string;
  artist: ArtistRef;
};

export type Track = {
  id: string;
  title: string;
  artist_credit: string;
  disc: number;
  track_no: number | null;
  duration_sec: number;
};

// Everything the player needs to show and play a track, independent of the page it came from.
export type PlayerTrack = {
  id: string;
  title: string;
  artist: string;
  artistSlug: string;
  albumTitle: string;
  albumSlug: string;
  cover: string | null;
  duration: number;
  accent: string | null;
  bg: string | null;
};
