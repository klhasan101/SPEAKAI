import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const category = body.category || 'daily-conversation';
    const difficulty = body.difficulty || 'beginner';
    const count = typeof body.count === 'number' ? body.count : 10;
    const recentErrors = Array.isArray(body.recentErrors) ? body.recentErrors : [];

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are an elite, highly specialized General American English speech coach and linguist.
Your task is to generate exactly ${count} distinct, natural, and idiomatic American English sentences or phrases.
The generated sentences must conform to the following criteria:
1. Category: ${category}
2. Difficulty level: ${difficulty} (beginner: simple everyday phrases, short sentence length; intermediate: conversational idioms, compound sentences; advanced: complex vocabulary, professional terms, multi-clause structures).
3. Targeted practice words: ${recentErrors.join(', ')} (naturally integrate one or two of these words in different sentences if possible, to help the user re-test and practice their specific pronunciation weaknesses).

Do not speak about these rules. Simply output the JSON array of sentences.

Response Format:
You MUST output a single, well-formed JSON object. Do not wrap the JSON output in markdown tags (do not use \`\`\`json ... \`\`\`). Your response must conform precisely to this structural schema:
{
  "sentences": [
    "string (The first generated sentence)",
    "string (The second generated sentence)",
    ...
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Generate ${count} custom practice sentences.`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    if (response?.text) {
      let cleanJson = response.text.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      }

      const generated = JSON.parse(cleanJson);
      if (!Array.isArray(generated.sentences)) {
        throw new Error('Invalid JSON structure returned by Gemini');
      }

      return NextResponse.json(generated);
    }

    throw new Error('Failed to generate sentences from Gemini.');
  } catch (error: any) {
    console.error('Error generating dynamic content:', error);
    return NextResponse.json(
      { error: error?.message || 'An error occurred during content generation.' },
      { status: 500 }
    );
  }
}
