/**
 * offline-evaluator.ts
 * Client-side pronunciation evaluator for offline / no-API-key mode.
 * Uses the browser's SpeechRecognition API (Webkit + standard) to transcribe
 * the microphone input locally, then compares the transcript word-by-word
 * against the target sentence.
 */

export interface OfflineEvaluationResult {
  score: number;
  feedbackPositive: string;
  feedbackImprovement: string;
  words: { word: string; status: 'correct' | 'mispronounced' | 'missing' }[];
  isOffline: true;
  transcript: string;
}

/** Normalise a word for loose comparison (lowercase, strip punctuation) */
function normalise(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, '').trim();
}

/**
 * Levenshtein distance between two strings.
 * Used to match phonetically close but not identical words.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Returns true if two normalised words are "close enough" */
function wordsMatch(target: string, spoken: string): boolean {
  if (target === spoken) return true;
  // Allow up to 1 edit for short words, up to 2 for longer ones
  const maxDist = target.length <= 4 ? 1 : 2;
  return levenshtein(target, spoken) <= maxDist;
}

/**
 * Compare target sentence words against spoken transcript words.
 * Returns per-word status array and overall score 0–100.
 */
export function evaluateLocally(
  targetText: string,
  transcript: string,
  lang: 'en' | 'ar'
): OfflineEvaluationResult {
  const targetWords = targetText.split(/\s+/).filter(Boolean);
  const spokenWords = transcript.split(/\s+/).filter(Boolean).map(normalise);

  const wordResults: OfflineEvaluationResult['words'] = [];
  let correctCount = 0;
  let mismatchCount = 0;

  // Greedy left-to-right matching
  let spokenIdx = 0;
  for (const rawTarget of targetWords) {
    const target = normalise(rawTarget);
    if (!target) continue;

    // Look ahead up to 3 positions for a match
    let found = false;
    for (let lookahead = 0; lookahead < 3 && spokenIdx + lookahead < spokenWords.length; lookahead++) {
      if (wordsMatch(target, spokenWords[spokenIdx + lookahead])) {
        // Consume skipped words as mispronounced
        for (let k = 0; k < lookahead; k++) {
          mismatchCount++;
        }
        spokenIdx += lookahead + 1;
        wordResults.push({ word: rawTarget, status: 'correct' });
        correctCount++;
        found = true;
        break;
      }
    }

    if (!found) {
      // Check if spoken word exists at all (mispronounced vs missing)
      const existsAnywhere = spokenWords.some(w => levenshtein(target, w) <= 2);
      wordResults.push({
        word: rawTarget,
        status: existsAnywhere ? 'mispronounced' : 'missing',
      });
      mismatchCount++;
    }
  }

  const total = wordResults.length || 1;
  const rawScore = Math.round((correctCount / total) * 100);
  // Floor at 10 so the UI always shows something meaningful
  const score = Math.max(10, rawScore);

  // Localised feedback strings
  const isAr = lang === 'ar';

  let feedbackPositive: string;
  let feedbackImprovement: string;

  if (score >= 80) {
    feedbackPositive = isAr
      ? `أحسنت! تعرّف التطبيق على ${correctCount} من ${total} كلمة بشكل صحيح.`
      : `Great job! ${correctCount} out of ${total} words were recognised correctly.`;
    feedbackImprovement = isAr
      ? 'استمر في التدريب للوصول إلى نطق أكثر سلاسة. يُنصح بالحصول على تقييم Gemini الكامل لمزيد من الدقة.'
      : 'Keep practising for smoother delivery. Use Gemini evaluation online for detailed acoustic feedback.';
  } else if (score >= 50) {
    feedbackPositive = isAr
      ? `جهد جيد! تم التعرف على ${correctCount} كلمة من أصل ${total}.`
      : `Good effort! ${correctCount} of ${total} words were recognised.`;
    feedbackImprovement = isAr
      ? 'ركّز على الكلمات المميّزة بالأصفر أو الأحمر. استمع للنموذج الأصلي واحرص على مطابقة الإيقاع.'
      : 'Focus on the yellow/red highlighted words. Listen to the model audio again and match its rhythm closely.';
  } else {
    feedbackPositive = isAr
      ? `تم التعرف على ${correctCount} كلمة. لا تيأس — التدريب المستمر يصنع الفارق!`
      : `${correctCount} word(s) recognised. Don't give up — consistent practice makes the difference!`;
    feedbackImprovement = isAr
      ? 'حاول الإبطاء وتقليد الجملة كلمة بكلمة. تأكد من أن الميكروفون يعمل بشكل صحيح.'
      : 'Try slowing down and shadowing the sentence word by word. Make sure your microphone is working clearly.';
  }

  return {
    score,
    feedbackPositive,
    feedbackImprovement,
    words: wordResults,
    isOffline: true,
    transcript,
  };
}

/** Feature-detect SpeechRecognition support */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

/**
 * Record audio via MediaRecorder AND simultaneously run SpeechRecognition.
 * Returns a promise that resolves with { blob, transcript } when the
 * recording stops (after maxSeconds or on manual stop).
 *
 * The `onStop` callback should be called externally to trigger stop.
 * Returns a controller object with a `stop()` method.
 */
export function startOfflineRecording(
  maxSeconds: number,
  onTick: (elapsed: number) => void,
  onDone: (blob: Blob, transcript: string) => void,
  onError: (msg: string) => void
): { stop: () => void } {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  let recognition: any = null;
  let transcript = '';
  let mediaRecorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  let elapsed = 0;
  let stopped = false;

  const doStop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearInterval(timer);
    if (recognition) {
      try { recognition.stop(); } catch { /* ignore */ }
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch { /* ignore */ }
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
  };

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then(s => {
      stream = s;
      chunks = [];

      // MediaRecorder for the audio blob
      const options = (() => {
        try { return { mimeType: 'audio/webm', audioBitsPerSecond: 32000 }; }
        catch { return {}; }
      })();
      try {
        mediaRecorder = new MediaRecorder(s, options);
      } catch {
        mediaRecorder = new MediaRecorder(s);
      }

      mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
        onDone(blob, transcript.trim());
      };

      mediaRecorder.start(250);

      // SpeechRecognition for live transcript
      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              transcript += ' ' + event.results[i][0].transcript;
            }
          }
        };

        recognition.onerror = () => { /* silently ignore recognition errors */ };

        try { recognition.start(); } catch { /* ignore */ }
      }

      // Auto-stop timer
      timer = setInterval(() => {
        elapsed += 1;
        onTick(elapsed);
        if (elapsed >= maxSeconds) {
          doStop();
        }
      }, 1000);
    })
    .catch(() => {
      onError('micDenied');
    });

  return { stop: doStop };
}
