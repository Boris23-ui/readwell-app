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

export function calculateEloGain(accuracyPercent: number, complexityIndex: number): number {
  // Accuracy * Complexity
  // E.g. 100% accuracy on complexity 5.0 => 1.0 * 5.0 * 10 = 50 ELO
  const baseMultiplier = 10;
  return Math.round((accuracyPercent / 100) * complexityIndex * baseMultiplier);
}

export function getLeague(elo: number): { name: string; color: string; icon: string } {
  if (elo >= 5000) return { name: 'Diamond', color: '#60A5FA', icon: '💎' };
  if (elo >= 2500) return { name: 'Platinum', color: '#14B8A6', icon: '🔮' };
  if (elo >= 1000) return { name: 'Gold', color: '#F59E0B', icon: '🏆' };
  if (elo >= 500) return { name: 'Silver', color: '#9CA3AF', icon: '⚔️' };
  return { name: 'Bronze', color: '#B45309', icon: '🛡️' };
}

export function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
