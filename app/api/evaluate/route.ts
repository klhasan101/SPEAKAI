import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { withRetry } from '@/lib/retry';

export const maxDuration = 60; // Allow enough time for audio analysis and retries

export async function POST(req: NextRequest) {
  try {
    const customKey = req.headers.get('x-gemini-api-key') || '';
    const apiKey = customKey.trim() || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY environment variable is not configured.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    const targetSentence = formData.get('text') as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 });
    }

    if (!targetSentence) {
      return NextResponse.json({ error: 'No target sentence provided.' }, { status: 400 });
    }

    // Convert audio file to Base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = audioFile.type || 'audio/webm';

    // Initialize the Google Gen AI client
    const ai = new GoogleGenAI({ apiKey });

    const uiLang = req.headers.get('x-ui-language') || 'en';

    const systemInstruction = `You are an elite, highly specialized General American English phonetics professor and pronunciation coach. Your core mandate is to listen directly to the provided user audio stream and evaluate its execution performance against the following exact target reference text string: "${targetSentence}".

Evaluate the input on three strict metrics:
1. Pronunciation accuracy (vowel coloring, rhoticity, crisp consonants).
2. Fluency metrics (absence of unnatural pauses, syllable pacing).
3. Structural accuracy (dropped letters, insertions, skipped words).

You must think natively in standard American English (General American accent parameters).

Language of Output Feedback:
You MUST output the "feedbackPositive" and "feedbackImprovement" strings in the following language: ${uiLang === 'ar' ? 'Arabic (العربية)' : 'English (English)'}.

Response Format:
You MUST output a single, well-formed JSON object. Do not wrap the JSON output in markdown tags (do not use \`\`\`json ... \`\`\`). Your response must conform precisely to this structural schema:
{
  "score": number (An integer bounded strictly between 0 and 100),
  "feedbackPositive": "string (Exactly one sentence highlighting a positive element of their delivery)",
  "feedbackImprovement": "string (Exactly one sentence identifying a specific pronunciation mistake or structural rhythm optimization)",
  "words": [
    {
      "word": "string (The exact word from the target sentence, preserving sequence, casing, and punctuation)",
      "status": "correct" | "mispronounced" | "missing"
    }
  ]
}`;

    const customModel = req.headers.get('x-gemini-model') || '';
    const selectedModel = customModel.trim() || 'gemini-3.5-flash';
    const modelsToTry = [selectedModel, 'gemini-2.5-flash', 'gemini-1.5-flash'];
    let lastError: any = null;
    let evalText = '';

    for (const model of modelsToTry) {
      try {
        // Wrap model calls inside withRetry to gracefully handle 429 Quota Exceeded conditions
        const response = await withRetry(() =>
          ai.models.generateContent({
            model,
            contents: [
              {
                inlineData: {
                  mimeType,
                  data: base64Audio
                }
              },
              {
                text: `Evaluate my pronunciation against the target sentence: "${targetSentence}"`
              }
            ],
            config: {
              systemInstruction,
              responseMimeType: 'application/json'
            }
          })
        );

        if (response?.text) {
          evalText = response.text;
          break; // Success!
        }
      } catch (err: any) {
        console.warn(`Evaluation with model ${model} failed:`, err?.message || err);
        lastError = err;
      }
    }

    if (!evalText) {
      throw new Error(`All models failed evaluation. Last error: ${lastError?.message || lastError}`);
    }

    // Parse clean JSON output
    let cleanJson = evalText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }

    const evaluationResult = JSON.parse(cleanJson);

    // Validate structure
    if (
      typeof evaluationResult.score !== 'number' ||
      typeof evaluationResult.feedbackPositive !== 'string' ||
      typeof evaluationResult.feedbackImprovement !== 'string' ||
      !Array.isArray(evaluationResult.words)
    ) {
      throw new Error('Invalid JSON structure returned by Gemini API');
    }

    return NextResponse.json(evaluationResult);
  } catch (error: any) {
    console.error('Error in evaluation route:', error);
    return NextResponse.json(
      { error: error?.message || 'An error occurred during evaluation.' },
      { status: 500 }
    );
  }
}
