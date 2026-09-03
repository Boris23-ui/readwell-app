import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, Layout, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/CloudAppContext';
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
      contentContainerStyle={{ paddingBottom: botPad + 110 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={[styles.circuitPill, { borderColor: `${colors.honeyDeep}88` }]}>
          <Text style={[styles.circuitPillText, { color: colors.honeyDeep }]}>
            🗺️ THE CIRCUIT MAP · TELEMETRY
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Habit & Skill <Text style={{ color: colors.honeyDeep }}>Circuit</Text>
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Introspected from your reading runtime — streak momentum, comprehension yields, and badge artifacts.
        </Text>
      </View>

      {/* Stat cards */}
      <Animated.View entering={ZoomIn.springify()} layout={Layout.springify()} style={styles.section}>
        <View style={styles.statRow}>
          <StatCard
            label="Time read"
            value={hoursStr}
            accent={colors.terracotta}
            icon={<Feather name="clock" size={18} color={colors.terracotta} />}
          />
          <StatCard
            label="Books finished"
            value={finishedBooks}
            accent={colors.sageDeep}
            icon={<Feather name="check-circle" size={18} color={colors.sageDeep} />}
          />
          <StatCard
            label="Avg score"
            value={avgScore > 0 ? `${avgScore}%` : '—'}
            accent={colors.slateDeep}
            icon={<Feather name="bar-chart-2" size={18} color={colors.slateDeep} />}
          />
        </View>
      </Animated.View>

      {/* Weekly chart — felt card */}
      <Animated.View
        entering={FadeInDown.delay(100).springify()}
        layout={Layout.springify()}
        style={[
          styles.section,
          styles.feltCard,
          { backgroundColor: colors.card, borderColor: `${colors.honey}55`, shadowColor: colors.shadow },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>This week</Text>
        <WeeklyChart activities={dailyActivities} goalMinutes={profile.dailyGoalMinutes} />
      </Animated.View>

      {/* Streak info — felt card */}
      <Animated.View
        entering={FadeInDown.delay(200).springify()}
        layout={Layout.springify()}
        style={[
          styles.section,
          styles.feltCard,
          { backgroundColor: colors.card, borderColor: `${colors.terracotta}55`, shadowColor: colors.shadow },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Streak</Text>
        <View style={styles.streakRow}>
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: colors.terracotta }]}>{profile.streakCurrent}</Text>
            <Text style={[styles.streakLabelMono, { color: colors.mutedForeground }]}>CURRENT</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: colors.honeyDeep }]}>{profile.streakBest}</Text>
            <Text style={[styles.streakLabelMono, { color: colors.mutedForeground }]}>BEST</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: colors.slateDeep }]}>{sessions.length}</Text>
            <Text style={[styles.streakLabelMono, { color: colors.mutedForeground }]}>SESSIONS</Text>
          </View>
        </View>
      </Animated.View>

      {/* Badges — felt card */}
      <Animated.View entering={FadeInUp.delay(300).springify()} layout={Layout.springify()} style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Badges</Text>
        <View
          style={[
            styles.badgesGrid,
            styles.feltCard,
            { backgroundColor: colors.card, borderColor: `${colors.sage}55`, shadowColor: colors.shadow },
          ]}
        >
          {ALL_BADGES.map(key => (
            <BadgeItem key={key} badgeKey={key} earned={profile.badges.includes(key)} />
          ))}
        </View>
      </Animated.View>

      {/* Footer mantra */}
      <View style={styles.footerNote}>
        <Text style={[styles.footerNoteText, { color: colors.mutedForeground }]}>
          CLICK-DRIVEN · REPLAY-EXACT · SOCRATIC RETENTION — NOTHING MOVES UNTIL YOU DO
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 6 },
  circuitPill: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 4,
  },
  circuitPillText: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.9,
  },
  title: { fontSize: 28, fontFamily: 'Newsreader_700Bold', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  section: { paddingHorizontal: 20, marginBottom: 16 },
  statRow: { flexDirection: 'row', gap: 10 },
  feltCard: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontFamily: 'Newsreader_700Bold', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'Newsreader_700Bold', marginBottom: 14 },
  streakRow: { flexDirection: 'row', alignItems: 'center' },
  streakItem: { flex: 1, alignItems: 'center', gap: 4 },
  streakNum: { fontSize: 30, fontFamily: 'Newsreader_700Bold', lineHeight: 34 },
  streakLabelMono: { fontSize: 9.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  divider: { width: 1, height: 36 },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  footerNote: {
    paddingHorizontal: 30,
    paddingTop: 10,
    paddingBottom: 20,
  },
  footerNoteText: {
    fontSize: 10.5,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    letterSpacing: 1.2,
    lineHeight: 16,
    opacity: 0.7,
  },
});
