import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/CloudAppContext';
import { useCoach } from '@/context/CoachContext';
import { BadgeItem } from '@/components/BadgeItem';
import { BadgeKey, BADGE_INFO } from '@/types';
import { calculateEloGain } from '@/utils/xp';

export default function SessionSummaryScreen() {
  const coach = useCoach();
  const params = useLocalSearchParams<{
    bookId: string;
    segmentIndex: string;
    score: string;
    total: string;
    xpEarned: string;
    secondsRead: string;
    complexityIndex?: string;
    skipped?: string;
  }>();

  const {
    bookId,
    segmentIndex: segIdxStr,
    score: scoreStr,
    total: totalStr,
    xpEarned: xpStr,
    secondsRead: secStr,
    complexityIndex: compStr,
    skipped,
  } = params;

  const segmentIndex = parseInt(segIdxStr ?? '0', 10);
  const score = parseInt(scoreStr ?? '0', 10);
  const total = parseInt(totalStr ?? '5', 10);
  const xpEarned = parseInt(xpStr ?? '0', 10);
  const secondsRead = parseInt(secStr ?? '0', 10);
  const complexityIndex = parseFloat(compStr ?? '1.0');
  const wasSkipped = skipped === 'true';

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getBookById, updateBook, completeSession, profile, addTokens } = useApp();
  const book = getBookById(bookId ?? '');

  const [newBadges, setNewBadges] = useState<BadgeKey[]>([]);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [showStreak, setShowStreak] = useState(false);
  const [earnedToken, setEarnedToken] = useState(false);

  const xpAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!book || sessionSaved) return;

    const save = async () => {
      setSessionSaved(true);

      const nextIndex = segmentIndex + 1;
      const isLastSegment = nextIndex >= (book.segments.length ?? 0);

      if (isLastSegment) {
        await updateBook(book.id, {
          status: 'finished',
          currentSegmentIndex: nextIndex,
        });
      } else if (!wasSkipped) {
        await updateBook(book.id, { currentSegmentIndex: nextIndex });
      }

      const comprehensionScore = total > 0 ? Math.round((score / Math.max(total - 1, 1)) * 100) : 0;
      const isPerfectQuiz = !wasSkipped && total > 1 && score === total - 1;
      const eloEarned = calculateEloGain(comprehensionScore, complexityIndex);

      const result = await completeSession({
        bookId: book.id,
        startedAt: new Date().toISOString(),
        secondsRead,
        segmentsCompleted: 1,
        comprehensionScore,
        xpEarned,
        eloEarned,
      }, { bookFinished: isLastSegment, isPerfectQuiz });

      if (isPerfectQuiz) {
        addTokens(1);
        setEarnedToken(true);
      }

      setNewBadges(result.newBadges);
      if (result.newBadges.length > 0 || profile.streakCurrent > 0) {
        setShowStreak(true);
      }

      // Notify Coach Agent to evolve reading strategy
      coach?.evolveStrategy(`Session completed on "${book.title}". Score: ${comprehensionScore}%, XP: ${xpEarned}, Time: ${secondsRead}s.`).catch(() => {});
    };

    save();

    // Entrance animations
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 120,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // XP count-up
    Animated.timing(xpAnim, {
      toValue: xpEarned,
      duration: 1200,
      useNativeDriver: false,
    }).start();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [book, sessionSaved]);

  if (!book) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
          <Text style={[styles.link, { color: colors.terracotta }]}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const minutesRead = Math.floor(secondsRead / 60);
  const comprScore = total > 1 ? Math.round((score / (total - 1)) * 100) : (wasSkipped ? 0 : 100);
  const eloEarnedDisplay = calculateEloGain(comprScore, complexityIndex);
  const isBookFinished = segmentIndex + 1 >= book.segments.length;
  const nextSegmentIndex = segmentIndex + 1;

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 20;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  // Determine score-tier accent
  const scoreAccent = comprScore >= 80 ? colors.sageDeep : comprScore >= 60 ? colors.honeyDeep : colors.terracotta;
  const scoreAccentBg = comprScore >= 80 ? `${colors.sage}30` : comprScore >= 60 ? `${colors.honey}30` : `${colors.terracotta}30`;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad + 20 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        {/* Score hero — Felt circle instead of gradient */}
        <View style={styles.hero}>
          {wasSkipped ? (
            <View style={[styles.scoreCircle, { backgroundColor: colors.muted }]}>
              <Feather name="skip-forward" size={36} color={colors.mutedForeground} />
            </View>
          ) : (
            <View
              style={[
                styles.scoreCircle,
                {
                  backgroundColor: scoreAccentBg,
                  borderColor: `${scoreAccent}66`,
                  borderWidth: 3,
                },
              ]}
            >
              <Text style={[styles.scoreNum, { color: scoreAccent }]}>{wasSkipped ? '—' : score}/{total > 0 ? total - 1 : 0}</Text>
              <Text style={[styles.scoreLabelMono, { color: `${scoreAccent}99` }]}>SCORE</Text>
            </View>
          )}

          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            {wasSkipped
              ? 'Segment Complete'
              : comprScore >= 80
              ? 'Excellent work!'
              : comprScore >= 60
              ? 'Good reading!'
              : 'Keep going!'}
          </Text>

          {isBookFinished && (
            <View style={[styles.finishedBadge, { backgroundColor: `${colors.sage}22`, borderColor: `${colors.sageDeep}66` }]}>
              <Feather name="check-circle" size={14} color={colors.sageDeep} />
              <Text style={[styles.finishedBadgeText, { color: colors.sageDeep }]}>BOOK FINISHED!</Text>
            </View>
          )}
        </View>

        {/* Stats cards — felt cards */}
        <View style={styles.statsRow}>
          <View style={[styles.feltStatCard, { backgroundColor: colors.card, borderColor: `${colors.terracotta}55`, shadowColor: colors.shadow }]}>
            <Feather name="clock" size={18} color={colors.terracotta} />
            <Text style={[styles.statVal, { color: colors.foreground }]}>
              {minutesRead > 0 ? `${minutesRead}m` : `${secondsRead}s`}
            </Text>
            <Text style={[styles.statLblMono, { color: colors.mutedForeground }]}>TIME</Text>
          </View>

          {!wasSkipped && (
            <View style={[styles.feltStatCard, { backgroundColor: colors.card, borderColor: `${colors.slateDeep}55`, shadowColor: colors.shadow }]}>
              <Feather name="bar-chart-2" size={18} color={colors.slateDeep} />
              <Text style={[styles.statVal, { color: colors.foreground }]}>{comprScore}%</Text>
              <Text style={[styles.statLblMono, { color: colors.mutedForeground }]}>COMPR.</Text>
            </View>
          )}

          {!wasSkipped && (
            <View style={[styles.feltStatCard, { backgroundColor: colors.card, borderColor: `${colors.honey}55`, shadowColor: colors.shadow }]}>
              <Feather name="trending-up" size={18} color={colors.honeyDeep} />
              <Animated.Text style={[styles.statVal, { color: colors.honeyDeep }]}>
                +{eloEarnedDisplay}
              </Animated.Text>
              <Text style={[styles.statLblMono, { color: colors.mutedForeground }]}>ELO</Text>
            </View>
          )}

          <View style={[styles.feltStatCard, { backgroundColor: colors.card, borderColor: `${colors.sage}55`, shadowColor: colors.shadow }]}>
            <Feather name="zap" size={18} color={colors.sageDeep} />
            <Animated.Text style={[styles.statVal, { color: colors.sageDeep }]}>
              {xpEarned > 0 ? `+${xpEarned}` : '0'}
            </Animated.Text>
            <Text style={[styles.statLblMono, { color: colors.mutedForeground }]}>XP</Text>
          </View>
          
          {earnedToken && (
            <View style={[styles.feltStatCard, { backgroundColor: colors.card, borderColor: `${colors.honey}55`, shadowColor: colors.shadow }]}>
              <Feather name="plus-circle" size={18} color={colors.honeyDeep} />
              <Animated.Text style={[styles.statVal, { color: colors.honeyDeep }]}>+1</Animated.Text>
              <Text style={[styles.statLblMono, { color: colors.mutedForeground }]}>TOKEN</Text>
            </View>
          )}
        </View>

        {/* New badges — felt card */}
        {newBadges.length > 0 && (
          <View
            style={[
              styles.section,
              styles.feltCardLg,
              { backgroundColor: colors.card, borderColor: `${colors.honey}55`, shadowColor: colors.shadow },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              New Badge{newBadges.length > 1 ? 's' : ''}!
            </Text>
            <View style={styles.badgesRow}>
              {newBadges.map(k => (
                <BadgeItem key={k} badgeKey={k} earned />
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {!isBookFinished && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.replace(`/reader/${book.id}`);
              }}
              style={[styles.primaryBtn, { backgroundColor: colors.honey }]}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>CONTINUE READING ▸</Text>
              <Feather name="arrow-right" size={18} color="#1F1C18" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => router.replace('/(tabs)')}
            style={[styles.secondaryBtn, { backgroundColor: colors.card, borderColor: `${colors.terracotta}55` }]}
            activeOpacity={0.85}
          >
            <Feather name="home" size={17} color={colors.foreground} />
            <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
              BACK TO THE FLOOR ▸
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  hero: { alignItems: 'center', paddingHorizontal: 20, gap: 12, marginBottom: 28 },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  scoreNum: { fontSize: 30, fontFamily: 'Newsreader_700Bold' },
  scoreLabelMono: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  summaryTitle: { fontSize: 26, fontFamily: 'Newsreader_700Bold', textAlign: 'center' },
  finishedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  finishedBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  feltStatCard: {
    flex: 1,
    minWidth: 70,
    borderRadius: 22,
    borderWidth: 2,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  statVal: { fontSize: 20, fontFamily: 'Newsreader_700Bold', lineHeight: 24 },
  statLblMono: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  section: { marginHorizontal: 20, marginBottom: 16 },
  feltCardLg: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 18,
    gap: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitle: { fontSize: 16, fontFamily: 'Newsreader_700Bold' },
  badgesRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  actions: { paddingHorizontal: 20, gap: 12, marginTop: 8 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  primaryBtnText: {
    color: '#1F1C18',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 22,
    paddingVertical: 14,
    borderWidth: 2,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.9,
  },
});
