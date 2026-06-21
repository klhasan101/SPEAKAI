export interface Streak {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
}

const STORAGE_KEY = 'shadowspeak_streak';

export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getStreak(): Streak {
  if (typeof window === 'undefined') {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: '' };
  }
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: '' };
  }
  try {
    return JSON.parse(data) as Streak;
  } catch {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: '' };
  }
}

export function saveStreak(streak: Streak) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(streak));
  }
}

/**
 * Checks if the streak is broken (i.e. more than 1 day has passed since lastActiveDate).
 * If broken, resets currentStreak to 0.
 * Should be run on dashboard mount.
 */
export function checkStreakValidity(): Streak {
  const streak = getStreak();
  if (!streak.lastActiveDate) return streak;

  const todayStr = getTodayString();
  if (streak.lastActiveDate === todayStr) {
    return streak; // Active today, no changes
  }

  const lastActive = new Date(streak.lastActiveDate + 'T00:00:00');
  const today = new Date(todayStr + 'T00:00:00');
  
  // Calculate difference in days
  const diffTime = today.getTime() - lastActive.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 1) {
    // Streak broken!
    const updated = {
      ...streak,
      currentStreak: 0
    };
    saveStreak(updated);
    return updated;
  }

  return streak;
}

/**
 * Increments the streak upon session completion.
 * Only increments once per day.
 */
export function recordSessionCompletion(): Streak {
  const streak = checkStreakValidity();
  const todayStr = getTodayString();

  if (streak.lastActiveDate === todayStr) {
    // Already completed a session today, streak is safe but not incremented again
    return streak;
  }

  let newCurrent = streak.currentStreak;
  if (!streak.lastActiveDate) {
    // First session ever
    newCurrent = 1;
  } else {
    const lastActive = new Date(streak.lastActiveDate + 'T00:00:00');
    const today = new Date(todayStr + 'T00:00:00');
    const diffTime = today.getTime() - lastActive.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      newCurrent += 1;
    } else {
      // If it was broken (diffDays > 1), it was reset to 0 in checkStreakValidity, so now it becomes 1
      newCurrent = 1;
    }
  }

  const newLongest = Math.max(newCurrent, streak.longestStreak);
  const updated: Streak = {
    currentStreak: newCurrent,
    longestStreak: newLongest,
    lastActiveDate: todayStr
  };

  saveStreak(updated);
  return updated;
}
