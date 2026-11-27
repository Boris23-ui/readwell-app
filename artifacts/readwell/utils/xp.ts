export function getLevelFromXp(totalXp: number): number {
  let level = 1;
  let xpRequired = 100;
  let accumulated = 0;
  while (accumulated + xpRequired <= totalXp) {
    accumulated += xpRequired;
    level++;
    xpRequired = Math.floor(xpRequired * 1.4);
  }
  return level;
}

export function getXpProgressInLevel(totalXp: number): {
  current: number;
  required: number;
  percent: number;
} {
  let xpRequired = 100;
  let accumulated = 0;
  while (accumulated + xpRequired <= totalXp) {
    accumulated += xpRequired;
    xpRequired = Math.floor(xpRequired * 1.4);
  }
  const current = totalXp - accumulated;
  return { current, required: xpRequired, percent: current / xpRequired };
}

/**
 * Converts elapsed reading seconds to credited reading minutes.
 * Genuine short segments (>= 15s) credit at least 1 minute so readers see
 * immediate progress on their daily goal ring, while sub-15s skips credit 0.
 */
export function calculateReadingMinutes(secondsRead: number): number {
  if (!Number.isFinite(secondsRead) || secondsRead < 15) return 0;
  return Math.max(1, Math.round(secondsRead / 60));
}

export function calculateSessionXp(
  minutesRead: number,
  quizScore: number,
  quizTotal: number,
  metDailyGoal: boolean,
  bookFinished = false,
): number {
  const safeMinutes = Number.isFinite(minutesRead) ? Math.max(0, Math.floor(minutesRead)) : 0;
  let xp = Math.min(safeMinutes, 60);

  if (quizTotal > 0) {
    const clampedScore = Math.max(0, Math.min(quizScore, quizTotal));
    xp += 10; // quiz completion reward
    xp += clampedScore * 2;
    if (clampedScore === quizTotal) xp += 5; // perfect quiz bonus
  }

  if (metDailyGoal) xp += 25;
  if (bookFinished) xp += 100;
  return xp;
}

export function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
