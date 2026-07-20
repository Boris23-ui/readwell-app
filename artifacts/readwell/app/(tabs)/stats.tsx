import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { StatCard } from '@/components/StatCard';
import { BadgeItem } from '@/components/BadgeItem';
import { WeeklyChart } from '@/components/WeeklyChart';
import { BadgeKey, BADGE_INFO } from '@/types';

const ALL_BADGES: BadgeKey[] = [
  'first-book', 'streak-7', 'streak-30', 'perfect-quiz',
  'night-owl', 'early-bird', 'comeback', 'bookworm',
];

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, books, sessions, dailyActivities } = useApp();

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 34 : 0;

  const totalHours = Math.floor(profile.totalMinutesRead / 60);
  const totalMins = profile.totalMinutesRead % 60;
  const hoursStr = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${profile.totalMinutesRead}m`;

  const finishedBooks = books.filter(b => b.status === 'finished').length;

  const avgScore =
    sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.comprehensionScore, 0) / sessions.length)
      : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: botPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Stats</Text>
      </View>

      {/* Stat cards */}
      <View style={styles.section}>
        <View style={styles.statRow}>
          <StatCard
            label="Time read"
            value={hoursStr}
            accent={colors.primary}
            icon={<Feather name="clock" size={18} color={colors.primary} />}
          />
          <StatCard
            label="Books finished"
            value={finishedBooks}
            accent="#22C55E"
            icon={<Feather name="check-circle" size={18} color="#22C55E" />}
          />
          <StatCard
            label="Avg score"
            value={avgScore > 0 ? `${avgScore}%` : '—'}
            accent="#8B5CF6"
            icon={<Feather name="bar-chart-2" size={18} color="#8B5CF6" />}
          />
        </View>
      </View>

      {/* Weekly chart */}
      <View style={[styles.section, styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>This week</Text>
        <WeeklyChart activities={dailyActivities} goalMinutes={profile.dailyGoalMinutes} />
      </View>

      {/* Streak info */}
      <View style={[styles.section, styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Streak</Text>
        <View style={styles.streakRow}>
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: '#EF4444' }]}>{profile.streakCurrent}</Text>
            <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>current</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: colors.primary }]}>{profile.streakBest}</Text>
            <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>best</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: '#8B5CF6' }]}>{sessions.length}</Text>
            <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>sessions</Text>
          </View>
        </View>
      </View>

      {/* Badges */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Badges</Text>
        <View style={[styles.badgesGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {ALL_BADGES.map(key => (
            <BadgeItem key={key} badgeKey={key} earned={profile.badges.includes(key)} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  section: { paddingHorizontal: 20, marginBottom: 16 },
  statRow: { flexDirection: 'row', gap: 10 },
  card: { borderRadius: 18, borderWidth: 1, padding: 18 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 14 },
  streakRow: { flexDirection: 'row', alignItems: 'center' },
  streakItem: { flex: 1, alignItems: 'center', gap: 4 },
  streakNum: { fontSize: 32, fontFamily: 'Inter_700Bold' },
  streakLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  divider: { width: 1, height: 40 },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    justifyContent: 'space-between',
  },
});
