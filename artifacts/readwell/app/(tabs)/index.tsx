import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/CloudAppContext';
import { useCoach } from '@/context/CoachContext';
import { ProgressRing } from '@/components/ProgressRing';
import { BookCard } from '@/components/BookCard';
import { WhileYouWereAwayCard } from '@/components/WhileYouWereAwayCard';
import { getXpProgressInLevel } from '@/utils/xp';
import { fetchRecommendations } from '@/utils/api';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, books, getTodayActivity } = useApp();
  const { strategy, dueFlashcards } = useCoach();
  const [recommendations, setRecommendations] = React.useState<any[]>([]);

  React.useEffect(() => {
    let mounted = true;
    const loadRecs = async () => {
      try {
        const res = await fetchRecommendations({
          elo: profile.elo ?? 100,
          readingLevel: profile.readingLevel,
          interests: profile.interests || [],
        });
        if (mounted && res.recommendations) {
          setRecommendations(res.recommendations);
        }
      } catch (err) {
        console.warn('Failed to load recommendations', err);
      }
    };
    loadRecs();
    return () => {
      mounted = false;
    };
  }, [profile.xp, profile.readingLevel, profile.interests]);

  const todayActivity = getTodayActivity();
  const todayMinutes = todayActivity?.minutesRead ?? 0;
  const goalProgress = Math.min(1, todayMinutes / Math.max(profile.dailyGoalMinutes, 1));
  const currentBooks = books.filter(b => b.status === 'in_progress');
  const latestBook = currentBooks[0] ?? (books.length > 0 ? books[0] : null);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const xpProgress = getXpProgressInLevel(profile.xp);

  const topPad = Platform.OS === 'web' ? 44 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad + 110 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Pattern Kitchen Style Top Action Bar ── */}
      <View style={styles.topBar}>
        <View style={styles.tabToggleGroup}>
          <TouchableOpacity
            style={[styles.tabBadgeActive, { backgroundColor: colors.terracotta }]}
            activeOpacity={0.9}
          >
            <Text style={styles.tabBadgeActiveTitle}>THE FLOOR</Text>
            <Text style={styles.tabBadgeActiveSub}>Season 1 · active sprints</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/leaderboard');
            }}
            style={styles.tabBadgeInactive}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabBadgeInactiveTitle, { color: colors.mutedForeground }]}>
              MARATHON
            </Text>
            <Text style={[styles.tabBadgeInactiveSub, { color: colors.mutedForeground }]}>
              Season 2 · ladder
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickPillsRow}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/stats');
            }}
            style={[styles.dashedPill, { borderColor: `${colors.honeyDeep}88` }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.dashedPillText, { color: colors.honeyDeep }]}>
              🗺️ CIRCUIT
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/messages');
            }}
            style={[styles.dashedPill, { borderColor: `${colors.terracotta}88` }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.dashedPillText, { color: colors.terracotta }]}>
              ⚖️ COACH
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Season 1 Hero Felt Card ── */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.heroWrapper}>
        <View
          style={[
            styles.heroFeltCard,
            {
              backgroundColor: colors.card,
              borderColor: `${colors.terracotta}55`,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View style={styles.heroHeaderTag}>
            <Text style={[styles.heroSeasonTag, { color: colors.terracotta }]}>
              SEASON 1 · THE INTERACTIVE FLOOR
            </Text>
            <View style={[styles.heroLevelPill, { backgroundColor: `${colors.honey}33` }]}>
              <Text style={[styles.heroLevelText, { color: colors.honeyDeep }]}>
                LV {profile.level} · {greeting.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            Reading <Text style={{ color: colors.terracotta }}>Floor</Text>
          </Text>

          <Text style={[styles.heroParagraph, { color: colors.mutedForeground }]}>
            One reader. Socratic checkpoints. Run a segment, hit the wall, dialogue with AI,
            and conquer the quiz — every stage earned on the floor.
          </Text>

          {/* Duolingo / ADK The Grid Mini Dashboard */}
          <View style={[styles.gridContainer, { backgroundColor: colors.muted }]}>
            <View style={styles.gridHeader}>
              <Text style={[styles.gridHeaderTitle, { color: colors.mutedForeground }]}>
                THE LEARNING GRID
              </Text>
              <Text style={[styles.gridHeaderSub, { color: colors.mutedForeground }]}>
                who decides next?
              </Text>
            </View>
            <View style={styles.gridRow}>
              <View style={[styles.gridChip, { backgroundColor: colors.card }]}>
                <Text style={[styles.gridChipText, { color: colors.foreground }]}>
                  Sequential
                </Text>
              </View>
              <View style={[styles.gridChip, { backgroundColor: colors.card }]}>
                <Text style={[styles.gridChipText, { color: colors.foreground }]}>
                  Parallel
                </Text>
              </View>
              <View style={[styles.gridChip, { backgroundColor: colors.card }]}>
                <Text style={[styles.gridChipText, { color: colors.foreground }]}>
                  Socratic
                </Text>
              </View>
              <View style={[styles.gridChip, { backgroundColor: colors.card }]}>
                <Text style={[styles.gridChipText, { color: colors.foreground }]}>
                  Dynamic
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ── While You Were Away Socratic Digest ── */}
      <WhileYouWereAwayCard onOpenCoach={() => router.push('/(tabs)/messages')} />

      {/* ── Daily Habit Stats Trio (Felt Cards) ── */}
      <View style={styles.statsRow}>
        {/* Streak Card */}
        <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(100).springify()}>
          <View
            style={[
              styles.feltStatCard,
              {
                backgroundColor: colors.card,
                borderColor: profile.streakCurrent > 0 ? `${colors.terracotta}66` : colors.border,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <Feather
              name="zap"
              size={22}
              color={profile.streakCurrent > 0 ? colors.terracotta : colors.mutedForeground}
            />
            <Text style={[styles.statBigNum, { color: colors.foreground }]}>
              {profile.streakCurrent}
            </Text>
            <Text style={[styles.statLabelMono, { color: colors.mutedForeground }]}>
              DAY STREAK
            </Text>
          </View>
        </Animated.View>

        {/* Daily Goal Ring */}
        <Animated.View style={{ flex: 1.2 }} entering={FadeInDown.delay(180).springify()}>
          <View
            style={[
              styles.feltStatCard,
              {
                backgroundColor: colors.card,
                borderColor: `${colors.honey}66`,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <ProgressRing
              progress={goalProgress}
              size={76}
              strokeWidth={7}
              color={colors.honeyDeep}
              trackColor={colors.muted}
            >
              <View style={styles.ringCenter}>
                <Text style={[styles.ringNum, { color: colors.foreground }]}>{todayMinutes}</Text>
                <Text style={[styles.ringMinLabel, { color: colors.mutedForeground }]}>min</Text>
              </View>
            </ProgressRing>
            <Text style={[styles.statLabelMono, { color: colors.mutedForeground, marginTop: 4 }]}>
              GOAL: {profile.dailyGoalMinutes}M
            </Text>
          </View>
        </Animated.View>

        {/* Total XP / ELO */}
        <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(260).springify()}>
          <View
            style={[
              styles.feltStatCard,
              {
                backgroundColor: colors.card,
                borderColor: `${colors.slateDeep}55`,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <Text style={[styles.statBigNum, { color: colors.slateDeep }]}>{profile.xp}</Text>
            <Text style={[styles.statLabelMono, { color: colors.mutedForeground }]}>TOTAL XP</Text>
            <View style={[styles.xpTrack, { backgroundColor: colors.muted }]}>
              <View style={[styles.xpFill, { width: `${xpProgress.percent * 100}%` as any }]} />
            </View>
            <Text style={[styles.xpNextMono, { color: colors.mutedForeground }]}>
              {xpProgress.required - xpProgress.current} to Lv {profile.level + 1}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* ── Active Socratic Coach Banner ── */}
      <Animated.View entering={FadeInDown.delay(320).springify()} style={styles.section}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(tabs)/messages');
          }}
          activeOpacity={0.85}
        >
          <View
            style={[
              styles.coachBannerFelt,
              {
                backgroundColor: colors.card,
                borderColor: `${colors.terracotta}55`,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <View style={[styles.coachAvatarCircle, { backgroundColor: `${colors.terracotta}18` }]}>
              <Text style={{ fontSize: 24 }}>🦉</Text>
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.coachTitle, { color: colors.foreground }]}>
                  Socratic Coach
                </Text>
                <View style={[styles.coachVersionPill, { backgroundColor: colors.terracotta }]}>
                  <Text style={styles.coachVersionText}>v{strategy?.version || 1}</Text>
                </View>
              </View>
              <Text style={[styles.coachSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                {strategy?.preferredQuestionStyle || 'Scaffolded questions & memory reinforcement'}
              </Text>
            </View>

            <View style={styles.coachRightCol}>
              {dueFlashcards.length > 0 && (
                <View style={[styles.dueBadge, { backgroundColor: colors.destructive }]}>
                  <Text style={styles.dueBadgeText}>{dueFlashcards.length} DUE</Text>
                </View>
              )}
              <View style={[styles.btnEnterMini, { backgroundColor: colors.honey }]}>
                <Text style={styles.btnEnterMiniText}>CHAT ▸</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Pick Tonight's Sprint (Stages) ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.displayHeading, { color: colors.foreground }]}>
            Pick tonight's sprint
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/import')}
            style={[styles.importPill, { borderColor: `${colors.terracotta}66` }]}
          >
            <Feather name="plus" size={14} color={colors.terracotta} />
            <Text style={[styles.importPillText, { color: colors.terracotta }]}>IMPORT</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
          Every reading stage earned on the floor.
        </Text>

        {currentBooks.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            {currentBooks.map(book => (
              <BookCard
                key={book.id}
                book={book}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/reader/${book.id}`);
                }}
              />
            ))}
          </View>
        ) : latestBook ? (
          <View style={{ marginTop: 14 }}>
            <BookCard
              book={latestBook}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/reader/${latestBook.id}`);
              }}
            />
          </View>
        ) : (
          <Animated.View entering={FadeInRight.delay(350).springify()} style={{ marginTop: 14 }}>
            <TouchableOpacity
              onPress={() => router.push('/import')}
              style={[
                styles.emptySprintCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              activeOpacity={0.8}
            >
              <View
                style={[styles.emptyIconCircle, { backgroundColor: `${colors.terracotta}18` }]}
              >
                <Feather name="book-open" size={28} color={colors.terracotta} />
              </View>
              <Text style={[styles.emptySprintTitle, { color: colors.foreground }]}>
                No documents on the floor
              </Text>
              <Text style={[styles.emptySprintSub, { color: colors.mutedForeground }]}>
                Import a PDF or paste text to generate your first Socratic reading stages.
              </Text>
              <View style={[styles.btnFeltAction, { backgroundColor: colors.honey }]}>
                <Text style={styles.btnFeltActionText}>IMPORT DOCUMENT ▸</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* ── Recommended Curations ── */}
      {recommendations.length > 0 && (
        <Animated.View entering={FadeInDown.delay(450).springify()} style={styles.section}>
          <Text style={[styles.displayHeading, { color: colors.foreground }]}>
            Recommended Curations
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
            Calibrated to your reading level & ELO rating.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 14, paddingTop: 12, paddingBottom: 6 }}
          >
            {recommendations.map((rec, i) => (
              <View
                key={i}
                style={[
                  styles.recFeltCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: `${colors.slate}66`,
                    shadowColor: colors.shadow,
                  },
                ]}
              >
                <View style={styles.recTopRow}>
                  <View style={[styles.recIconWrap, { backgroundColor: `${colors.slate}22` }]}>
                    <Feather name="bookmark" size={16} color={colors.slateDeep} />
                  </View>
                  <Text style={[styles.recTopicMono, { color: colors.slateDeep }]}>
                    {rec.topic || 'EXPLORE'}
                  </Text>
                </View>

                <Text style={[styles.recTitleText, { color: colors.foreground }]} numberOfLines={2}>
                  {rec.title}
                </Text>

                <Text
                  style={[styles.recReasonText, { color: colors.mutedForeground }]}
                  numberOfLines={3}
                >
                  {rec.reason}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Footer Pattern Mantra */}
      <View style={styles.footerNote}>
        <Text style={[styles.footerNoteText, { color: colors.mutedForeground }]}>
          CLICK-DRIVEN · REPLAY-EXACT · SOCRATIC RETENTION — NOTHING MOVES UNTIL YOU DO
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  tabToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(150, 130, 110, 0.12)',
    borderRadius: 18,
    padding: 3,
    gap: 3,
  },
  tabBadgeActive: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 15,
  },
  tabBadgeActiveTitle: {
    color: '#FFFDF8',
    fontSize: 11.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  tabBadgeActiveSub: {
    color: 'rgba(255, 253, 248, 0.8)',
    fontSize: 9.5,
    fontFamily: 'Inter_400Regular',
  },
  tabBadgeInactive: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 15,
  },
  tabBadgeInactiveTitle: {
    fontSize: 11.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  tabBadgeInactiveSub: {
    fontSize: 9.5,
    fontFamily: 'Inter_400Regular',
  },
  quickPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dashedPill: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dashedPillText: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  heroWrapper: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  heroFeltCard: {
    borderRadius: 26,
    borderWidth: 2,
    padding: 22,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
    gap: 12,
  },
  heroHeaderTag: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroSeasonTag: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  heroLevelPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroLevelText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 34,
    fontFamily: 'Newsreader_700Bold',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  heroParagraph: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  gridContainer: {
    borderRadius: 16,
    padding: 12,
    marginTop: 4,
    gap: 8,
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridHeaderTitle: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
  },
  gridHeaderSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  gridChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  gridChipText: {
    fontSize: 10.5,
    fontFamily: 'Inter_600SemiBold',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  feltStatCard: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  statBigNum: {
    fontSize: 26,
    fontFamily: 'Newsreader_700Bold',
    lineHeight: 30,
  },
  statLabelMono: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  ringCenter: {
    alignItems: 'center',
  },
  ringNum: {
    fontSize: 18,
    fontFamily: 'Newsreader_700Bold',
  },
  ringMinLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    marginTop: -3,
  },
  xpTrack: {
    width: '100%',
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginTop: 2,
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#52789F',
    borderRadius: 2.5,
  },
  xpNextMono: {
    fontSize: 9.5,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 26,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  displayHeading: {
    fontSize: 22,
    fontFamily: 'Newsreader_700Bold',
    letterSpacing: -0.3,
  },
  importPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  importPillText: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 13.5,
    fontFamily: 'Inter_400Regular',
    marginTop: 3,
  },
  coachBannerFelt: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  coachAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachTitle: {
    fontSize: 16,
    fontFamily: 'Newsreader_700Bold',
  },
  coachVersionPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  coachVersionText: {
    color: '#FFFDF8',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  coachSub: {
    fontSize: 12.5,
    fontFamily: 'Inter_400Regular',
  },
  coachRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dueBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dueBadgeText: {
    color: '#FFF',
    fontSize: 9.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
  },
  btnEnterMini: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  btnEnterMiniText: {
    color: '#1F1C18',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.9,
  },
  emptySprintCard: {
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: 30,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySprintTitle: {
    fontSize: 18,
    fontFamily: 'Newsreader_700Bold',
  },
  emptySprintSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  btnFeltAction: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 6,
  },
  btnFeltActionText: {
    color: '#1F1C18',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
  },
  recFeltCard: {
    width: 230,
    borderRadius: 20,
    borderWidth: 2,
    padding: 16,
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  recTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recTopicMono: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.9,
  },
  recTitleText: {
    fontSize: 15,
    fontFamily: 'Newsreader_700Bold',
    lineHeight: 20,
  },
  recReasonText: {
    fontSize: 12.5,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
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
