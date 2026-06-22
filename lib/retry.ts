/**
 * Standard utility to retry asynchronous calls with exponential backoff.
 * Especially useful for handling Gemini API 429 Rate Limit (RESOURCE_EXHAUSTED) glitches.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelay = 3000
): Promise<T> {
  let delay = initialDelay;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const errMsg = err?.message || '';
      const isRateLimit =
        err?.status === 429 ||
        err?.statusCode === 429 ||
        errMsg.includes('429') ||
        errMsg.toLowerCase().includes('quota exceeded') ||
        errMsg.toLowerCase().includes('resource_exhausted') ||
        errMsg.toLowerCase().includes('rate limit');

      if (isRateLimit && i < retries - 1) {
        console.warn(
          `Gemini API Quota/Rate Limit hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      
      throw err;
    }
  }
  throw new Error('API retries exhausted due to rate limits.');
}
