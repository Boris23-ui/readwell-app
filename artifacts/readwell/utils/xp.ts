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

export function calculateSessionXp(
  minutesRead: number,
  quizScore: number,
  quizTotal: number,
  metDailyGoal: boolean,
): number {
  let xp = Math.min(minutesRead, 60);
  xp += 10;
  xp += quizScore * 2;
  if (quizScore === quizTotal) xp += 5;
  if (metDailyGoal) xp += 25;
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
