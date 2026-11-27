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

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 34 : 0;

  const totalMinutesRead = Number.isFinite(profile?.totalMinutesRead)
    ? Math.max(0, profile.totalMinutesRead)
    : 0;
  const totalHours = Math.floor(totalMinutesRead / 60);
  const totalMins = totalMinutesRead % 60;
  const hoursStr = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMinutesRead}m`;

  const finishedBooks = (books || []).filter(b => b?.status === 'finished').length;

  const validSessions = (sessions || []).filter(
    s => typeof s?.comprehensionScore === 'number' && Number.isFinite(s.comprehensionScore) && s.comprehensionScore > 0
  );
  const avgScore =
    validSessions.length > 0
      ? Math.round(
          validSessions.reduce((sum, s) => sum + Math.max(0, s.comprehensionScore), 0) /
            validSessions.length
        )
      : 0;
  const earnedBadges = Array.isArray(profile?.badges) ? profile.badges : [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: botPad + 110 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={[styles.circuitPill, { borderColor: `${colors.honeyDeep}66`, backgroundColor: `${colors.honey}18` }]}>
          <Text style={[styles.circuitPillText, { color: colors.honeyDeep }]}>
            YOUR PROGRESS
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Reading Stats
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Track your daily habit, comprehension growth, and milestones over time.
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

      {/* Comprehension Score — felt card */}
      <Animated.View
        entering={FadeInDown.delay(150).springify()}
        layout={Layout.springify()}
        style={[
          styles.section,
          styles.feltCard,
          { backgroundColor: colors.card, borderColor: `${colors.slateDeep}55`, shadowColor: colors.shadow },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Comprehension</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ alignItems: 'center', minWidth: 68 }}>
            <Text style={{ fontSize: 34, fontFamily: 'Newsreader_700Bold', color: colors.slateDeep }}>
              {profile.comprehensionScore > 0 ? `${profile.comprehensionScore}%` : '—'}
            </Text>
            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 0.8 }}>SCORE</Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {profile.comprehensionTrend === 'up' && <Feather name="trending-up" size={16} color={colors.sageDeep} />}
              {profile.comprehensionTrend === 'down' && <Feather name="trending-down" size={16} color={colors.terracotta} />}
              {profile.comprehensionTrend === 'flat' && <Feather name="minus" size={16} color={colors.mutedForeground} />}
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                {profile.comprehensionScore === 0
                  ? 'Not measured yet'
                  : profile.comprehensionTrend === 'up'
                  ? 'Growing strong'
                  : profile.comprehensionTrend === 'down'
                  ? 'Needs focus'
                  : 'Steady progress'}
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, lineHeight: 18 }}>
              {profile.comprehensionScore === 0
                ? 'Complete your first reading quiz to establish a comprehension baseline.'
                : 'Weighted across your last 20 quizzes so recent growth matters most.'}
            </Text>
          </View>
        </View>
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
            <Text style={[styles.streakNum, { color: colors.terracotta }]}>
              {profile?.streakCurrent ?? 0}
            </Text>
            <Text style={[styles.streakLabelMono, { color: colors.mutedForeground }]}>CURRENT</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: colors.honeyDeep }]}>
              {profile?.streakBest ?? 0}
            </Text>
            <Text style={[styles.streakLabelMono, { color: colors.mutedForeground }]}>BEST</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: colors.slateDeep }]}>
              {(sessions || []).length}
            </Text>
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
            <View key={key} style={styles.badgeCell}>
              <BadgeItem badgeKey={key} earned={earnedBadges.includes(key)} />
            </View>
          ))}
        </View>
      </Animated.View>
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
    paddingHorizontal: 10,
    paddingTop: 18,
    paddingBottom: 4,
  },
  badgeCell: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 16,
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
