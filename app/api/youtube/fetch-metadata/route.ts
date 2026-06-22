import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

function extractYoutubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<\/?[^>]+(>|$)/g, '') // remove html tags
    .replace(/\s+/g, ' ') // normalize spaces
    .trim();
}

interface CaptionFragment {
  text: string;
  start: number;
  duration: number;
}

interface Segment {
  id: string;
  youtubeId: string;
  sentence: string;
  startTime: number;
  endTime: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

function segmentTranscript(
  fragments: CaptionFragment[],
  youtubeId: string,
  difficulty: 'beginner' | 'intermediate' | 'advanced'
): Segment[] {
  let minWords = 3;
  let maxWords = 8;

  if (difficulty === 'intermediate') {
    minWords = 8;
    maxWords = 15;
  } else if (difficulty === 'advanced') {
    minWords = 15;
    maxWords = 25;
  }

  const segments: Segment[] = [];
  let currentChunk: CaptionFragment[] = [];
  let currentWordCount = 0;

  const getWordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

  for (let i = 0; i < fragments.length; i++) {
    const frag = fragments[i];
    const fragWordCount = getWordCount(frag.text);

    currentChunk.push(frag);
    currentWordCount += fragWordCount;

    const lastWord = frag.text.trim();
    const endsWithPunctuation = /[.!?]$/.test(lastWord);

    const nextFrag = fragments[i + 1];
    let longPause = false;
    if (nextFrag) {
      const currentEnd = frag.start + frag.duration;
      longPause = (nextFrag.start - currentEnd) > 0.8;
    }

    const shouldSplit =
      currentWordCount >= minWords && (
        endsWithPunctuation ||
        longPause ||
        currentWordCount >= maxWords ||
        !nextFrag
      );

    if (shouldSplit) {
      const sentenceText = currentChunk.map(f => f.text).join(' ');
      const startTime = currentChunk[0].start;
      const lastFrag = currentChunk[currentChunk.length - 1];
      const endTime = lastFrag.start + lastFrag.duration;

      segments.push({
        id: `yt_${youtubeId}_${segments.length}`,
        youtubeId,
        sentence: decodeHtmlEntities(sentenceText),
        startTime: Math.round(startTime * 100) / 100,
        endTime: Math.round(endTime * 100) / 100,
        difficulty
      });

      currentChunk = [];
      currentWordCount = 0;
    }
  }

  if (currentChunk.length > 0) {
    const sentenceText = currentChunk.map(f => f.text).join(' ');
    const startTime = currentChunk[0].start;
    const lastFrag = currentChunk[currentChunk.length - 1];
    const endTime = lastFrag.start + lastFrag.duration;

    segments.push({
      id: `yt_${youtubeId}_${segments.length}`,
      youtubeId,
      sentence: decodeHtmlEntities(sentenceText),
      startTime: Math.round(startTime * 100) / 100,
      endTime: Math.round(endTime * 100) / 100,
      difficulty
    });
  }

  return segments;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url, difficulty = 'beginner' } = body;

    if (!url) {
      return NextResponse.json({ error: 'YouTube URL is required.' }, { status: 400 });
    }

    const youtubeId = extractYoutubeId(url);
    if (!youtubeId) {
      return NextResponse.json({ error: 'Invalid YouTube URL.' }, { status: 400 });
    }

    // Fetch the YouTube page HTML
    const response = await fetch(`https://www.youtube.com/watch?v=${youtubeId}&hl=en`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch YouTube page.' }, { status: 500 });
    }

    const html = await response.text();

    // 1. Scrape video details using regex / JSON parse
    let title = 'YouTube Video';
    let channelName = 'YouTube Channel';
    let duration = 0;
    let thumbnail = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
    let captionTracks: any[] | null = null;

    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]+?});/) || 
                                html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]+?})\s*</) ||
                                html.match(/window\["ytInitialPlayerResponse"\]\s*=\s*({[\s\S]+?});/);

    if (playerResponseMatch) {
      try {
        const playerResponse = JSON.parse(playerResponseMatch[1]);
        title = playerResponse.videoDetails?.title || title;
        channelName = playerResponse.videoDetails?.author || channelName;
        duration = parseInt(playerResponse.videoDetails?.lengthSeconds || '0', 10);
        
        const thumbnails = playerResponse.videoDetails?.thumbnail?.thumbnails;
        if (thumbnails && thumbnails.length > 0) {
          thumbnail = thumbnails[thumbnails.length - 1].url;
        }

        captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
      } catch (e) {
        console.error('Error parsing playerResponseMatch JSON:', e);
      }
    }

    // Fallbacks if playerResponse JSON parsing failed or was incomplete
    if (title === 'YouTube Video') {
      const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        title = decodeHtmlEntities(titleMatch[1].replace('- YouTube', '').trim());
      }
    }

    // Fallback for captionTracks
    if (!captionTracks) {
      const captionMatch = html.match(/"captionTracks"\s*:\s*(\[[^\]]+\])/);
      if (captionMatch) {
        try {
          captionTracks = JSON.parse(captionMatch[1]);
        } catch (e) {
          console.warn('Fallback captionTracks match parse failed:', e);
        }
      }
    }

    if (!captionTracks || captionTracks.length === 0) {
      return NextResponse.json({ error: 'No captions or transcript available for this video.' }, { status: 400 });
    }

    // Find the best caption track: english first, then anything
    let selectedTrack = captionTracks.find(
      (track: any) => track.languageCode === 'en'
    );

    if (!selectedTrack) {
      selectedTrack = captionTracks.find(
        (track: any) => track.languageCode.startsWith('en')
      );
    }

    if (!selectedTrack) {
      selectedTrack = captionTracks[0]; // fallback
    }

    if (!selectedTrack || !selectedTrack.baseUrl) {
      return NextResponse.json({ error: 'Could not locate valid subtitle tracks.' }, { status: 400 });
    }

    // Fetch the subtitle XML track
    const captionsResponse = await fetch(selectedTrack.baseUrl);
    if (!captionsResponse.ok) {
      return NextResponse.json({ error: 'Failed to retrieve subtitle contents.' }, { status: 500 });
    }

    const xmlText = await captionsResponse.text();

    // Parse timing fragments from the timedtext XML
    const textBlockRegex = /<text([\s\S]*?)>([\s\S]*?)<\/text>/g;
    const fragments: CaptionFragment[] = [];
    let regexMatch;

    while ((regexMatch = textBlockRegex.exec(xmlText)) !== null) {
      const attrs = regexMatch[1];
      const textContent = regexMatch[2];

      const startMatch = attrs.match(/start="([\d.]+)"/);
      const durMatch = attrs.match(/dur="([\d.]+)"/);

      const start = startMatch ? parseFloat(startMatch[1]) : 0;
      const duration = durMatch ? parseFloat(durMatch[1]) : 0;
      const text = decodeHtmlEntities(textContent);

      if (text) {
        fragments.push({ text, start, duration });
      }
    }

    if (fragments.length === 0) {
      return NextResponse.json({ error: 'Subtitles are empty or failed to parse.' }, { status: 400 });
    }

    // Segment fragments into shadowing units
    const lessons = segmentTranscript(fragments, youtubeId, difficulty);

    return NextResponse.json({
      video: {
        youtubeId,
        title,
        thumbnail,
        duration,
        channelName,
      },
      lessons,
    });
  } catch (error: any) {
    console.error('Error in fetch-metadata route:', error);
    return NextResponse.json(
      { error: error?.message || 'An error occurred during transcript retrieval.' },
      { status: 500 }
    );
  }
}
