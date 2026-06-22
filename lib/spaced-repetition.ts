import { db, SentenceProgress } from './db';

/**
 * SM-2 interval calculation.
 * - score >= 85 (easy):  interval = max(interval * 2.5, 1)
 * - score >= 60 (good):  interval = max(interval * 1.5, 1)
 * - score <  60 (fail):  interval = 1, repetitions = 0
 */
function calculateNextReview(
  score: number,
  currentInterval: number,
  currentRepetitions: number
): { interval: number; nextReview: number; repetitions: number } {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  let interval: number;
  let repetitions: number;

  if (score >= 85) {
    interval = Math.max(currentInterval * 2.5, 1);
    repetitions = currentRepetitions + 1;
  } else if (score >= 60) {
    interval = Math.max(currentInterval * 1.5, 1);
    repetitions = currentRepetitions + 1;
  } else {
    interval = 1;
    repetitions = 0;
  }

  const nextReview = Date.now() + interval * MS_PER_DAY;
  return { interval, nextReview, repetitions };
}

/**
 * Update or create a SentenceProgress record after a practice attempt.
 */
export async function recordAttempt(sentenceId: string, score: number): Promise<void> {
  const existing = await db.sentenceProgress.get(sentenceId);

  const currentInterval = existing?.interval ?? 1;
  const currentRepetitions = existing?.repetitions ?? 0;

  const { interval, nextReview, repetitions } = calculateNextReview(
    score,
    currentInterval,
    currentRepetitions
  );

  await db.sentenceProgress.put({
    sentenceId,
    lastScore: score,
    nextReview,
    interval,
    repetitions,
  });
}

/**
 * Get all sentences due for review today (nextReview <= Date.now()).
 */
export async function getDueToday(): Promise<SentenceProgress[]> {
  const now = Date.now();
  return db.sentenceProgress
    .where('nextReview')
    .belowOrEqual(now)
    .toArray();
}

/**
 * Count sentences due today.
 */
export async function getDueTodayCount(): Promise<number> {
  const now = Date.now();
  return db.sentenceProgress
    .where('nextReview')
    .belowOrEqual(now)
    .count();
}
