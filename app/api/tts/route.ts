import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { withRetry } from '@/lib/retry';

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');

    if (!text) {
      return NextResponse.json({ error: 'No text parameter provided.' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Request Gemini to speak the text with retry capability
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Speak the following target text aloud clearly and naturally with a standard General American accent. Speak ONLY the exact sentence, with no introductions or extra commentary. Target text: "${text}"`,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck'
              }
            }
          }
        }
      })
    );

    // Find the audio part in the response candidates
    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.find(
      (p) => p.inlineData && p.inlineData.mimeType?.startsWith('audio/')
    );

    if (part && part.inlineData && part.inlineData.data) {
      const audioBase64 = part.inlineData.data;
      const mimeType = part.inlineData.mimeType || 'audio/mp3';
      const buffer = Buffer.from(audioBase64, 'base64');

      return new Response(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    throw new Error('No audio returned from Gemini model.');
  } catch (error: any) {
    console.error('Error generating Neural TTS:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate Neural TTS.' },
      { status: 500 }
    );
  }
}
