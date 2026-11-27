import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
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
import { ReviewQueueCard } from '@/components/ReviewQueueCard';
import { getXpProgressInLevel } from '@/utils/xp';
import { createStarterBook, STARTER_BOOK_ID } from '@/utils/content';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;
  const isCompact = width < 430;
  const { profile, books, addBook, getTodayActivity } = useApp();
  const { dueFlashcards } = useCoach();

  const todayActivity = getTodayActivity ? getTodayActivity() : null;
  const todayMinutes = Number.isFinite(todayActivity?.minutesRead)
    ? Math.max(0, todayActivity!.minutesRead)
    : 0;
  const goalMinutes =
    Number.isFinite(profile?.dailyGoalMinutes) && profile.dailyGoalMinutes > 0
      ? profile.dailyGoalMinutes
      : 20;
  const goalProgress = Math.min(1, todayMinutes / goalMinutes);
  const goalMet = todayMinutes >= goalMinutes;

  const currentBooks = (books || []).filter((b) => b && b.status === 'in_progress');
  const primaryBook = currentBooks[0] ?? (books && books.length > 0 ? books[0] : null);
  const otherActiveBooks = currentBooks.slice(1);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = (profile?.name || 'Reader').trim().split(' ')[0] || 'Reader';

  const xp = Number.isFinite(profile?.xp) ? Math.max(0, profile.xp) : 0;
  const xpProgress = getXpProgressInLevel(xp);

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 10;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleStartStarterBook = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const existing = books.find((b) => b.id === STARTER_BOOK_ID);
    if (existing) {
      router.push(`/reader/${existing.id}`);
      return;
    }
    const starter = createStarterBook();
    await addBook(starter);
    router.push(`/reader/${starter.id}`);
  };

  const renderPrimaryReadingCard = () => {
    if (!primaryBook) {
      return (
        <Animated.View
          entering={FadeInDown.duration(350)}
          style={[styles.heroWrapper, isWide && { paddingHorizontal: 0, marginBottom: 0 }]}
        >
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.card,
                borderColor: `${colors.terracotta}55`,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <View style={[styles.heroIconWrap, { backgroundColor: `${colors.terracotta}16` }]}>
              <Feather name="book-open" size={26} color={colors.terracotta} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              Start your daily reading habit
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
              Import a PDF, paste an article, or jump right into a 3-minute starter passage with a quick AI check at the end.
            </Text>

            <View style={[styles.emptyCtaRow, isCompact && styles.emptyCtaColumn]}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/import');
                }}
                style={[styles.primaryCta, isCompact && styles.ctaFullWidth, { backgroundColor: colors.honey }]}
                activeOpacity={0.85}
              >
                <Feather name="plus" size={16} color="#1F1C18" />
                <Text style={styles.primaryCtaText} numberOfLines={1}>Import a Book</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleStartStarterBook}
                style={[
                  styles.secondaryCta,
                  isCompact && styles.ctaFullWidth,
                  { backgroundColor: colors.cardFelt, borderColor: colors.border },
                ]}
                activeOpacity={0.85}
              >
                <Feather name="play" size={14} color={colors.terracotta} />
                <Text style={[styles.secondaryCtaText, { color: colors.foreground }]} numberOfLines={1}>
                  Try Starter Read
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      );
    }

    const totalSegments =
      primaryBook.segments.length || (primaryBook.pages ? primaryBook.pages.length : 1);
    const completedSegments =
      primaryBook.status === 'finished'
        ? totalSegments
        : Math.min(Math.max(0, primaryBook.currentSegmentIndex || 0), totalSegments);
    const progressPct =
      totalSegments > 0 ? Math.min(100, Math.round((completedSegments / totalSegments) * 100)) : 0;
    const activeSeg =
      primaryBook.segments[Math.min(completedSegments, Math.max(0, totalSegments - 1))];
    const positionLabel =
      primaryBook.status === 'finished'
        ? 'Completed'
        : primaryBook.sourceType === 'pdf' && primaryBook.pages?.length
        ? `Page ${activeSeg?.pageStart ?? 1} of ${primaryBook.pages.length}`
        : `Section ${Math.min(completedSegments + 1, totalSegments)} of ${totalSegments}`;

    const accent = primaryBook.coverColor || colors.terracotta;

    return (
      <Animated.View
        entering={FadeInDown.duration(350)}
        style={[styles.heroWrapper, isWide && { paddingHorizontal: 0, marginBottom: 0 }]}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push(`/reader/${primaryBook.id}`);
          }}
          activeOpacity={0.9}
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.card,
              borderColor: `${accent}55`,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={[styles.eyebrowPill, { backgroundColor: `${accent}18` }]}>
              <Text style={[styles.eyebrowText, { color: accent }]}>
                {primaryBook.status === 'finished' ? 'RECENTLY FINISHED' : 'CONTINUE READING'}
              </Text>
            </View>
            <Text style={[styles.positionText, { color: colors.mutedForeground }]}>
              {positionLabel}
            </Text>
          </View>

          <View style={styles.heroBookRow}>
            <View style={[styles.heroBookCover, { backgroundColor: accent }]}>
              <Text style={styles.heroBookCoverLetter}>
                {primaryBook.title[0]?.toUpperCase() ?? 'R'}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.heroBookTitle, { color: colors.foreground }]} numberOfLines={2}>
                {primaryBook.title}
              </Text>
              <Text style={[styles.heroBookAuthor, { color: colors.mutedForeground }]} numberOfLines={1}>
                {primaryBook.author || 'Imported reading'}
              </Text>
            </View>
          </View>

          <View style={styles.heroProgressWrap}>
            <View style={[styles.heroProgressTrack, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.heroProgressFill,
                  {
                    backgroundColor: primaryBook.status === 'finished' ? colors.sageDeep : accent,
                    width: `${progressPct}%` as any,
                  },
                ]}
              />
            </View>
            <Text style={[styles.heroProgressPct, { color: colors.mutedForeground }]}>
              {progressPct}%
            </Text>
          </View>

          <View style={[styles.primaryCtaFull, { backgroundColor: colors.honey }]}>
            <Text style={styles.primaryCtaText}>
              {primaryBook.status === 'finished'
                ? 'Read Again'
                : completedSegments > 0
                ? 'Continue Reading'
                : 'Start Reading'}
            </Text>
            <Feather name="arrow-right" size={16} color="#1F1C18" />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderStatsRow = () => (
    <View style={[styles.statsRow, isWide && { paddingHorizontal: 0, marginBottom: 0 }]}>
      {/* Streak Card */}
      <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(80).springify()}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/stats')}
          activeOpacity={0.85}
          style={[
            styles.feltStatCard,
            {
              backgroundColor: colors.card,
              borderColor:
                (profile?.streakCurrent ?? 0) > 0 ? `${colors.terracotta}66` : colors.border,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <Feather
            name="zap"
            size={20}
            color={(profile?.streakCurrent ?? 0) > 0 ? colors.terracotta : colors.mutedForeground}
          />
          <Text style={[styles.statBigNum, { color: colors.foreground }]}>
            {profile?.streakCurrent ?? 0}
          </Text>
          <Text style={[styles.statLabelMono, { color: colors.mutedForeground }]}>
            DAY STREAK
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Daily Goal Ring */}
      <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(140).springify()}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/stats')}
          activeOpacity={0.85}
          style={[
            styles.feltStatCard,
            {
              backgroundColor: colors.card,
              borderColor: goalMet ? `${colors.sageDeep}66` : `${colors.honey}66`,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <ProgressRing
            progress={goalProgress}
            size={width < 380 ? 60 : 68}
            strokeWidth={6}
            color={goalMet ? colors.sageDeep : colors.honeyDeep}
            trackColor={colors.muted}
          >
            <View style={styles.ringCenter}>
              <Text style={[styles.ringNum, { color: colors.foreground }]}>{todayMinutes}</Text>
              <Text style={[styles.ringMinLabel, { color: colors.mutedForeground }]}>min</Text>
            </View>
          </ProgressRing>
          <Text
            style={[
              styles.statLabelMono,
              { color: goalMet ? colors.sageDeep : colors.mutedForeground, marginTop: 4 },
            ]}
          >
            {goalMet ? 'GOAL MET' : `GOAL ${goalMinutes}M`}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Total XP */}
      <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(200).springify()}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/stats')}
          activeOpacity={0.85}
          style={[
            styles.feltStatCard,
            {
              backgroundColor: colors.card,
              borderColor: `${colors.slateDeep}55`,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <Text style={[styles.statBigNum, { color: colors.slateDeep }]}>{xp}</Text>
          <Text style={[styles.statLabelMono, { color: colors.mutedForeground }]}>TOTAL XP</Text>
          <View style={[styles.xpTrack, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.xpFill,
                { width: `${xpProgress.percent * 100}%` as any, backgroundColor: colors.slateDeep },
              ]}
            />
          </View>
          <Text style={[styles.xpNextMono, { color: colors.mutedForeground }]}>
            {xpProgress.required - xpProgress.current} to Lv {(profile?.level ?? 1) + 1}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  const renderCoachBanner = () => (
    <Animated.View
      entering={FadeInDown.delay(240).springify()}
      style={[styles.section, isWide && { paddingHorizontal: 0, marginBottom: 0 }]}
    >
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
              borderColor: `${colors.terracotta}44`,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View style={[styles.coachAvatarCircle, { backgroundColor: `${colors.terracotta}18` }]}>
            <Text style={{ fontSize: 22 }}>🦉</Text>
          </View>

          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.coachTitle, { color: colors.foreground }]}>
              Reading Coach
            </Text>
            <Text style={[styles.coachSub, { color: colors.mutedForeground }]} numberOfLines={2}>
              Discuss passages & review flashcards
            </Text>
          </View>

          <View style={styles.coachRightCol}>
            {dueFlashcards.length > 0 && (
              <View style={[styles.dueBadge, { backgroundColor: colors.destructive }]}>
                <Text style={styles.dueBadgeText}>{dueFlashcards.length} due</Text>
              </View>
            )}
            <View style={[styles.btnEnterMini, { backgroundColor: `${colors.terracotta}15` }]}>
              <Text style={[styles.btnEnterMiniText, { color: colors.terracotta }]}>Chat</Text>
              <Feather name="chevron-right" size={14} color={colors.terracotta} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderReviewCard = () => (
    <Animated.View
      entering={FadeInDown.delay(280).springify()}
      style={[isWide ? { paddingHorizontal: 0, marginBottom: 0 } : styles.section]}
    >
      <ReviewQueueCard />
    </Animated.View>
  );

  const renderUpNextSection = () => {
    if (otherActiveBooks.length === 0) return null;
    return (
      <Animated.View
        entering={FadeInRight.delay(260).springify()}
        style={[styles.section, isWide && { paddingHorizontal: 0, marginBottom: 0 }]}
      >
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.displayHeading, { color: colors.foreground }]}>
            Also in progress
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/library')}>
            <Text style={[styles.seeAllText, { color: colors.terracotta }]}>See library</Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 12 }}>
          {otherActiveBooks.map((book, idx) => (
            <BookCard
              key={book?.id || `curr-${idx}`}
              book={book}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (book?.id) router.push(`/reader/${book.id}`);
              }}
            />
          ))}
        </View>
      </Animated.View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: topPad,
          paddingBottom: botPad + 110,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Greeting Header ── */}
      <View style={styles.topBar}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.greetingMetaRow}>
            <Text style={[styles.greetingEyebrow, { color: colors.mutedForeground }]}>
              {greeting}
            </Text>
            <View style={[styles.levelPill, { backgroundColor: `${colors.honey}33` }]}>
              <Text style={[styles.levelPillText, { color: colors.honeyDeep }]}>
                Lv {profile?.level ?? 1}
              </Text>
            </View>
          </View>
          <Text style={[styles.greetingTitle, { color: colors.foreground }]} numberOfLines={1}>
            {displayName}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/import');
          }}
          style={[
            styles.importHeaderBtn,
            { borderColor: `${colors.terracotta}66`, backgroundColor: `${colors.terracotta}10` },
          ]}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={15} color={colors.terracotta} />
          <Text style={[styles.importHeaderBtnText, { color: colors.terracotta }]}>Import</Text>
        </TouchableOpacity>
      </View>

      {/* ── Responsive Dashboard Area ── */}
      {isWide ? (
        <View style={styles.dashboardRow}>
          <View style={styles.dashboardLeftCol}>
            {renderPrimaryReadingCard()}
            <WhileYouWereAwayCard
              style={{ paddingHorizontal: 0, marginBottom: 0 }}
              onOpenCoach={() => router.push('/(tabs)/messages')}
            />
            {renderUpNextSection()}
          </View>

          <View style={styles.dashboardRightCol}>
            {renderStatsRow()}
            {renderCoachBanner()}
            {renderReviewCard()}
          </View>
        </View>
      ) : (
        <>
          {renderPrimaryReadingCard()}
          {renderStatsRow()}
          <WhileYouWereAwayCard onOpenCoach={() => router.push('/(tabs)/messages')} />
          {renderReviewCard()}
          {renderCoachBanner()}
          {renderUpNextSection()}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    maxWidth: 1200,
    width: '100%',
    marginHorizontal: 'auto',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 18,
    gap: 12,
  },
  greetingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greetingEyebrow: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  levelPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelPillText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  greetingTitle: {
    fontSize: 28,
    fontFamily: 'Newsreader_700Bold',
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  importHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  importHeaderBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  dashboardRow: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  dashboardLeftCol: {
    flex: 1.15,
    gap: 20,
  },
  dashboardRightCol: {
    flex: 0.85,
    gap: 20,
  },
  heroWrapper: {
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    gap: 14,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: 'Newsreader_700Bold',
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 21,
  },
  emptyCtaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  emptyCtaColumn: {
    flexDirection: 'column',
  },
  ctaFullWidth: {
    flex: 0,
    width: '100%',
  },
  primaryCta: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
  },
  primaryCtaFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 2,
  },
  primaryCtaText: {
    color: '#1F1C18',
    fontSize: 14.5,
    fontFamily: 'Inter_700Bold',
  },
  secondaryCta: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  secondaryCtaText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  eyebrowPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  eyebrowText: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  positionText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  heroBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroBookCover: {
    width: 54,
    height: 72,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBookCoverLetter: {
    color: '#FFFDF8',
    fontSize: 26,
    fontFamily: 'Newsreader_700Bold',
  },
  heroBookTitle: {
    fontSize: 20,
    fontFamily: 'Newsreader_700Bold',
    lineHeight: 25,
  },
  heroBookAuthor: {
    fontSize: 13.5,
    fontFamily: 'Inter_400Regular',
  },
  heroProgressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroProgressTrack: {
    flex: 1,
    height: 7,
    borderRadius: 3.5,
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 3.5,
  },
  heroProgressPct: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    minWidth: 34,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 18,
  },
  feltStatCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 118,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  statBigNum: {
    fontSize: 24,
    fontFamily: 'Newsreader_700Bold',
    lineHeight: 28,
  },
  statLabelMono: {
    fontSize: 9.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  ringCenter: { alignItems: 'center' },
  ringNum: { fontSize: 17, fontFamily: 'Newsreader_700Bold' },
  ringMinLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', marginTop: -3 },
  xpTrack: {
    width: '100%',
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginTop: 2,
  },
  xpFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  xpNextMono: {
    fontSize: 9.5,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  displayHeading: {
    fontSize: 20,
    fontFamily: 'Newsreader_700Bold',
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  coachBannerFelt: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  coachAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachTitle: {
    fontSize: 16,
    fontFamily: 'Newsreader_700Bold',
  },
  coachSub: {
    fontSize: 12.5,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
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
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  btnEnterMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  btnEnterMiniText: {
    fontSize: 12.5,
    fontFamily: 'Inter_600SemiBold',
  },
});
