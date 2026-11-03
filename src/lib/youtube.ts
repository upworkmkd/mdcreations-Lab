/* YouTube links: the video id from any link form, and the tutorials we know the details of (for search results). */

/** The 11-character id from a watch, share, shorts or embed link; null when it is not a YouTube link. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') id = u.searchParams.get('v') || u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] || '';
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

/** The shadow lamp tutorial (used until another link is saved in Admin → Settings → Tutorial videos). */
export const SHADOW_TUTORIAL = 'https://www.youtube.com/watch?v=x9l12h4Usl4';

/** Details for the video's structured data, so Google can show it as a video result. */
export const KNOWN_VIDEOS: Record<string, { title: string; description: string; uploadDate: string; duration: string }> = {
  x9l12h4Usl4: {
    title: 'How to Make a Shadow Lamp from Any Photo – Free Online Maker (STL Files)',
    description: 'Which pictures make a sharp shadow, how to remove a background or make an SVG, and what every setting in the Shadow Lamp Maker does, up to downloading the STL files.',
    uploadDate: '2026-11-03T20:00:00+05:30',
    duration: 'PT2M35S',
  },
};

export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const ytWatch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
