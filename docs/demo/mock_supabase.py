"""Run the site's UI on made-up data, without a Supabase project or R2 bucket.

This answers the handful of Supabase REST calls the catalog pages make
(albums, tracks, the top_tracks function) from an invented library of
fictional artists, and writes plain generated covers into public/covers/
(already git-ignored). Nothing here is real music; playback won't work
because there is no R2 bucket behind /api/stream.

    python3 docs/demo/mock_supabase.py            # serves on :54321
    # then start the app with the variables listed in the README's
    # "Trying the UI without credentials" section (R2 ones can be placeholders)

Needs Pillow for the covers (pip install pillow).
"""

import hashlib
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 54321
ROOT = Path(__file__).resolve().parents[2]

# (artist, album, year, kind, background, accent, track titles)
LIBRARY = [
    ("Paper Lanterns", "Night Ferry", 2023, "album", "#1f3b4d", "#7cc6e8",
     ["Harbor Lights", "Night Ferry", "Saltwater", "Lamplighter", "The Long Crossing", "Docks at Dawn"]),
    ("Paper Lanterns", "Small Hours", 2019, "album", "#3a2a4f", "#c59bf0",
     ["Small Hours", "Radiator", "Paper Moon", "Sleepwalking", "Kettle On"]),
    ("Juniper Static", "Low Orbit", 2024, "album", "#4a1f1f", "#f08a6c",
     ["Launch Window", "Low Orbit", "Weightless", "Telemetry", "Re-entry"]),
    ("Juniper Static", "Live at the Grange", 2022, "live", "#2d2d2d", "#f2c94c",
     ["Intro", "Weightless (Live)", "Fieldnotes (Live)", "Encore"]),
    ("The Velvet Pines", "Evergreen", 2016, "album", "#1e3d2f", "#8fd694",
     ["Evergreen", "Pine Needles", "Cabin Fever", "Snowline", "Woodsmoke"]),
    ("The Velvet Pines", "Sap & Resin", 2009, "album", "#3d2f1e", "#e0b36b",
     ["Sap", "Resin", "Bark", "Clearing"]),
    ("Marigold Avenue", "Porch Songs", 2005, "album", "#4d3a12", "#ffcf5c",
     ["Screen Door", "Porch Light", "Lemonade", "Cicadas", "Gravel Road"]),
    ("Marigold Avenue", "Greatest Hits", 2012, "compilation", "#4d1238", "#ff7ac6",
     ["Screen Door", "Postcard", "Gravel Road", "Last Bus Home"]),
    ("Glass Harbor", "Undertow", 1998, "album", "#12324d", "#5cb8ff",
     ["Undertow", "Riptide", "Lighthouse", "Sandbar"]),
    ("Glass Harbor", "Tidal", 1994, "album", "#123d4d", "#5cf0ff",
     ["Tidal", "Moonpull", "Brine", "Seafoam", "Breakwater"]),
    ("Northbound Quartet", "Compass Rose", 2001, "album", "#2f1e3d", "#b48cff",
     ["True North", "Compass Rose", "Meridian", "Dead Reckoning"]),
    ("Northbound Quartet", "Field Recordings", 1989, "album", "#3d1e1e", "#ff8c8c",
     ["Prairie", "Fence Line", "Windmill", "Thunderhead"]),
    ("Cassette Weather", "Rewind", 2021, "album", "#1e2a3d", "#8cb4ff",
     ["Rewind", "Side B", "Tape Hiss", "Auto-Reverse", "Fast Forward"]),
    ("Cassette Weather", "Rewind (Deluxe)", 2022, "album", "#1e2a3d", "#8cb4ff",
     ["Rewind", "Side B", "Tape Hiss", "Auto-Reverse", "Fast Forward", "Demo Tape"]),
]


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def uid(*parts):
    h = hashlib.md5("|".join(parts).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


ARTISTS, ALBUMS, TRACKS = {}, [], []
for i, (artist, title, year, kind, bg, accent, songs) in enumerate(LIBRARY):
    a = ARTISTS.setdefault(artist, {"id": uid("artist", artist), "slug": slugify(artist), "name": artist})
    edition = "Deluxe" if "(Deluxe)" in title else None
    slug = slugify(f"{artist} {title}")
    album = {
        "id": uid("album", artist, title), "slug": slug, "title": title,
        "base_title": title.replace(" (Deluxe)", ""), "edition": edition, "kind": kind, "year": year,
        "cover_key": f"/covers/{slug}", "color_bg": bg, "color_accent": accent,
        "disc_count": 1, "track_count": len(songs), "duration_sec": 0,
        "added_at": f"2026-0{1 + i % 9}-1{i % 10}T12:00:00Z", "artist": a,
    }
    for n, song in enumerate(songs, 1):
        dur = 150 + int(hashlib.md5(song.encode()).hexdigest(), 16) % 150
        album["duration_sec"] += dur
        TRACKS.append({
            "id": uid("track", slug, song), "title": song, "artist_credit": artist, "disc": 1,
            "track_no": n, "duration_sec": dur, "album_id": album["id"], "artist_id": a["id"],
        })
    ALBUMS.append(album)
ALBUMS.sort(key=lambda a: a["year"], reverse=True)


def make_covers():
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("Pillow not installed: albums will show the ♪ placeholder instead of covers.")
        return
    out = ROOT / "public" / "covers"
    out.mkdir(parents=True, exist_ok=True)
    for a in ALBUMS:
        seed = int(hashlib.md5(a["slug"].encode()).hexdigest(), 16)
        img = Image.new("RGB", (1200, 1200), a["color_bg"])
        d = ImageDraw.Draw(img)
        # A few flat shapes in the album's accent colour; deliberately plain.
        for k in range(3):
            r = 180 + (seed >> (k * 8)) % 320
            cx = 200 + (seed >> (k * 5)) % 800
            cy = 200 + (seed >> (k * 7)) % 800
            shade = tuple(int(a["color_accent"][j:j + 2], 16) * (3 - k) // 3 for j in (1, 3, 5))
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=shade)
        for size in (300, 600, 1200):
            img.resize((size, size)).save(out / f"{a['slug']}_{size}.webp", quality=80)
    print(f"Wrote {len(ALBUMS) * 3} demo covers to {out}")


def filter_rows(rows, qs):
    for key, vals in qs.items():
        if key in ("select", "order", "limit", "offset"):
            continue
        v = vals[0]
        if v.startswith("eq."):
            rows = [r for r in rows if str(r.get(key)) == v[3:]]
        elif v.startswith("in."):
            ids = [x.strip('"') for x in v[4:-1].split(",")]
            rows = [r for r in rows if str(r.get(key)) in ids]
    return rows


def search(q, lim):
    """Plain substring match; the real search_catalog in supabase/schema.sql is fuzzy (pg_trgm)."""
    t = q.strip().lower()
    by_id = {a["id"]: a for a in ALBUMS}
    artists = [
        {**a, "cover_key": next(al["cover_key"] for al in ALBUMS if al["artist"]["id"] == a["id"])}
        for a in ARTISTS.values() if t in a["name"].lower()
    ][:5]
    albums = [
        {k: al[k] for k in ("id", "slug", "title", "year", "cover_key", "color_bg")} | {"artist_name": al["artist"]["name"]}
        for al in ALBUMS if t in f"{al['title']} {al['artist']['name']}".lower()
    ][:8]
    tracks, seen = [], set()
    for tr in TRACKS:
        al = by_id[tr["album_id"]]
        key = (tr["title"].lower(), tr["artist_id"])
        if t in tr["title"].lower() and key not in seen:
            seen.add(key)
            tracks.append({
                "id": tr["id"], "title": tr["title"], "artist_credit": tr["artist_credit"],
                "duration_sec": tr["duration_sec"], "album_slug": al["slug"], "album_title": al["title"],
                "cover_key": al["cover_key"], "color_bg": al["color_bg"], "color_accent": al["color_accent"],
                "artist_slug": al["artist"]["slug"],
            })
    return {"artists": artists, "albums": albums, "tracks": tracks[:lim]}


class Handler(BaseHTTPRequestHandler):
    def send_json(self, body, status=200):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        qs = {k: [unquote(x) for x in v] for k, v in parse_qs(url.query).items()}
        table = url.path.removeprefix("/rest/v1/")
        if table == "albums":
            return self.send_json(filter_rows(ALBUMS, qs))
        if table == "tracks":
            rows = filter_rows(TRACKS, qs)
            return self.send_json(sorted(rows, key=lambda t: (t["disc"], t["track_no"])))
        # Accounts, sessions, playlists and anything else: empty, as for a signed-out guest.
        return self.send_json([])

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        if self.path.startswith("/rest/v1/rpc/top_tracks"):
            picks = TRACKS[::3][: int(body.get("lim", 12))]
            return self.send_json([{"track_id": t["id"], "plays": 40 - i} for i, t in enumerate(picks)])
        if self.path.startswith("/rest/v1/rpc/search_catalog"):
            return self.send_json(search(str(body.get("q", "")), int(body.get("lim", 20))))
        return self.send_json([])

    def do_HEAD(self):
        self.send_json([])

    def log_message(self, fmt, *args):
        sys.stderr.write("mock supabase: " + fmt % args + "\n")


if __name__ == "__main__":
    make_covers()
    print(f"Mock Supabase on http://127.0.0.1:{PORT} ({len(ALBUMS)} albums, {len(TRACKS)} tracks, all invented)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
