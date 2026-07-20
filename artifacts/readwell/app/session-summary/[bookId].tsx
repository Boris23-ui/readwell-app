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
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { BadgeItem } from '@/components/BadgeItem';
import { BadgeKey, BADGE_INFO } from '@/types';

export default function SessionSummaryScreen() {
  const params = useLocalSearchParams<{
    bookId: string;
    segmentIndex: string;
    score: string;
    total: string;
    xpEarned: string;
    secondsRead: string;
    skipped?: string;
  }>();

  const {
    bookId,
    segmentIndex: segIdxStr,
    score: scoreStr,
    total: totalStr,
    xpEarned: xpStr,
    secondsRead: secStr,
    skipped,
  } = params;

  const segmentIndex = parseInt(segIdxStr ?? '0', 10);
  const score = parseInt(scoreStr ?? '0', 10);
  const total = parseInt(totalStr ?? '5', 10);
  const xpEarned = parseInt(xpStr ?? '0', 10);
  const secondsRead = parseInt(secStr ?? '0', 10);
  const wasSkipped = skipped === 'true';

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getBookById, updateBook, completeSession, profile } = useApp();
  const book = getBookById(bookId ?? '');

  const [newBadges, setNewBadges] = useState<BadgeKey[]>([]);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [showStreak, setShowStreak] = useState(false);

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

      const result = await completeSession({
        bookId: book.id,
        startedAt: new Date().toISOString(),
        secondsRead,
        segmentsCompleted: 1,
        comprehensionScore,
        xpEarned,
      }, { bookFinished: isLastSegment, isPerfectQuiz });

      setNewBadges(result.newBadges);
      if (result.newBadges.length > 0 || profile.streakCurrent > 0) {
        setShowStreak(true);
      }
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
          <Text style={[styles.link, { color: colors.primary }]}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const minutesRead = Math.floor(secondsRead / 60);
  const comprScore = total > 1 ? Math.round((score / (total - 1)) * 100) : (wasSkipped ? 0 : 100);
  const isBookFinished = segmentIndex + 1 >= book.segments.length;
  const nextSegmentIndex = segmentIndex + 1;

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 20;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad + 20 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        {/* Score hero */}
        <View style={styles.hero}>
          {wasSkipped ? (
            <View style={[styles.scoreCircle, { backgroundColor: `${colors.muted}` }]}>
              <Feather name="skip-forward" size={36} color={colors.mutedForeground} />
            </View>
          ) : (
            <LinearGradient
              colors={
                comprScore >= 80
                  ? ['#22C55E', '#16A34A']
                  : comprScore >= 60
                  ? [book.coverColor, `${book.coverColor}CC`]
                  : ['#F97316', '#EF4444']
              }
              style={styles.scoreCircle}
            >
              <Text style={styles.scoreNum}>{wasSkipped ? '—' : score}/{total > 0 ? total - 1 : 0}</Text>
              <Text style={styles.scoreLabel}>score</Text>
            </LinearGradient>
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
            <View style={[styles.finishedBadge, { backgroundColor: '#22C55E20', borderColor: '#22C55E' }]}>
              <Feather name="check-circle" size={14} color="#22C55E" />
              <Text style={[styles.finishedBadgeText, { color: '#22C55E' }]}>Book Finished!</Text>
            </View>
          )}
        </View>

        {/* Stats cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="clock" size={18} color={colors.primary} />
            <Text style={[styles.statVal, { color: colors.foreground }]}>
              {minutesRead > 0 ? `${minutesRead}m` : `${secondsRead}s`}
            </Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>reading time</Text>
          </View>

          {!wasSkipped && (
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="bar-chart-2" size={18} color="#8B5CF6" />
              <Text style={[styles.statVal, { color: colors.foreground }]}>{comprScore}%</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>comprehension</Text>
            </View>
          )}

          <View style={[styles.statCard, { backgroundColor: '#8B5CF615', borderColor: '#8B5CF640' }]}>
            <Feather name="zap" size={18} color="#8B5CF6" />
            <Animated.Text style={[styles.statVal, { color: '#8B5CF6' }]}>
              {xpEarned > 0 ? `+${xpEarned}` : '0'}
            </Animated.Text>
            <Text style={[styles.statLbl, { color: '#8B5CF6' }]}>XP earned</Text>
          </View>
        </View>

        {/* New badges */}
        {newBadges.length > 0 && (
          <View style={[styles.section, styles.badgesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
              style={[styles.primaryBtn, { backgroundColor: book.coverColor }]}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Continue Reading</Text>
              <Feather name="arrow-right" size={18} color="#FFF" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => router.replace('/(tabs)')}
            style={[styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.85}
          >
            <Feather name="home" size={17} color={colors.foreground} />
            <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
              {isBookFinished ? 'Back to Home' : 'Back to Home'}
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
  link: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  hero: { alignItems: 'center', paddingHorizontal: 20, gap: 12, marginBottom: 28 },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  scoreNum: { fontSize: 32, fontFamily: 'Inter_700Bold', color: '#FFF' },
  scoreLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#FFF9' },
  summaryTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  finishedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  finishedBadgeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  statCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 2 },
  statLbl: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  section: { marginHorizontal: 20, marginBottom: 16 },
  badgesCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
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
  primaryBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
});
