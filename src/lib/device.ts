/** A short, human device label from a user-agent string, e.g. "iPhone · Safari" or "Mac · Chrome". */
export function deviceName(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device';
  const os =
    /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /PlayStation/.test(ua) ? 'PlayStation'
    : /Macintosh|Mac OS X/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows'
    : /CrOS/.test(ua) ? 'Chromebook'
    : /Linux/.test(ua) ? 'Linux'
    : 'Device';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Chrome|CriOS/.test(ua) ? 'Chrome'
    : /Safari/.test(ua) ? 'Safari'
    : 'Browser';
  return `${os} · ${browser}`;
}

export function deviceKind(ua: string | null | undefined): 'phone' | 'tablet' | 'computer' {
  if (!ua) return 'computer';
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return 'tablet';
  if (/iPhone|Android|Mobile/.test(ua)) return 'phone';
  return 'computer';
}
