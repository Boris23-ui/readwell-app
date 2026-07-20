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
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { ProgressRing } from '@/components/ProgressRing';
import { BookCard } from '@/components/BookCard';
import { getXpProgressInLevel } from '@/utils/xp';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, books, getTodayActivity } = useApp();

  const todayActivity = getTodayActivity();
  const todayMinutes = todayActivity?.minutesRead ?? 0;
  const goalProgress = Math.min(1, todayMinutes / profile.dailyGoalMinutes);
  const currentBooks = books.filter(b => b.status === 'in_progress');
  const latestBook = currentBooks[0] ?? null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const xpProgress = getXpProgressInLevel(profile.xp);

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 34 : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting}</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{profile.name || 'Reader'}</Text>
        </View>
        <View style={[styles.levelBadge, { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }]}>
          <Text style={[styles.levelText, { color: colors.primary }]}>Lv {profile.level}</Text>
        </View>
      </View>

      {/* Streak + Goal row */}
      <View style={styles.statsRow}>
        {/* Streak card */}
        <LinearGradient
          colors={profile.streakCurrent > 0 ? ['#EF4444', '#F97316'] : [colors.card, colors.card]}
          style={[styles.streakCard, { borderColor: profile.streakCurrent > 0 ? '#EF444460' : colors.border }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Feather name="zap" size={22} color={profile.streakCurrent > 0 ? '#FFF' : colors.mutedForeground} />
          <Text style={[styles.streakNum, { color: profile.streakCurrent > 0 ? '#FFF' : colors.foreground }]}>
            {profile.streakCurrent}
          </Text>
          <Text style={[styles.streakLabel, { color: profile.streakCurrent > 0 ? '#FFF9' : colors.mutedForeground }]}>
            day streak
          </Text>
        </LinearGradient>

        {/* Daily goal ring */}
        <View style={[styles.goalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ProgressRing
            progress={goalProgress}
            size={76}
            strokeWidth={7}
            color={colors.primary}
            trackColor={colors.muted}
          >
            <View style={styles.ringCenter}>
              <Text style={[styles.ringMin, { color: colors.foreground }]}>{todayMinutes}</Text>
              <Text style={[styles.ringLabel, { color: colors.mutedForeground }]}>min</Text>
            </View>
          </ProgressRing>
          <Text style={[styles.goalLabel, { color: colors.mutedForeground }]}>
            Goal: {profile.dailyGoalMinutes}m
          </Text>
        </View>

        {/* XP card */}
        <View style={[styles.xpCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.xpNum, { color: '#8B5CF6' }]}>{profile.xp}</Text>
          <Text style={[styles.xpLabel, { color: colors.mutedForeground }]}>total XP</Text>
          <View style={[styles.xpTrack, { backgroundColor: colors.muted }]}>
            <View style={[styles.xpFill, { width: `${xpProgress.percent * 100}%` as any }]} />
          </View>
          <Text style={[styles.xpNext, { color: colors.mutedForeground }]}>
            {xpProgress.required - xpProgress.current} to next
          </Text>
        </View>
      </View>

      {/* Continue reading */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {latestBook ? 'Continue reading' : 'Start reading'}
        </Text>
        {latestBook ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/reader/${latestBook.id}`);
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[`${latestBook.coverColor}30`, `${latestBook.coverColor}10`]}
              style={[styles.continueCard, { borderColor: `${latestBook.coverColor}40` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={[styles.bookSpine, { backgroundColor: latestBook.coverColor }]}>
                <Text style={styles.spineInitial}>{latestBook.title[0]?.toUpperCase()}</Text>
              </View>
              <View style={styles.continueInfo}>
                <Text style={[styles.continueTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {latestBook.title}
                </Text>
                <Text style={[styles.continueAuthor, { color: colors.mutedForeground }]}>
                  {latestBook.author || 'Unknown Author'}
                </Text>
                <Text style={[styles.continueProgress, { color: colors.mutedForeground }]}>
                  {(() => {
                    if (latestBook.sourceType === 'pdf' && latestBook.pages) {
                      const seg = latestBook.segments[latestBook.currentSegmentIndex];
                      const totalPages = latestBook.pages.length;
                      const currentPage = seg?.pageStart ?? 1;
                      return `Page ${currentPage} of ${totalPages}`;
                    }
                    return `Section ${latestBook.currentSegmentIndex + 1} of ${latestBook.segments.length}`;
                  })()}
                </Text>
              </View>
              <View style={[styles.continueBtn, { backgroundColor: latestBook.coverColor }]}>
                <Feather name="play" size={16} color="#FFF" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push('/import')}
            style={[styles.addBookCard, { backgroundColor: colors.card, borderColor: colors.border, borderStyle: 'dashed' }]}
            activeOpacity={0.8}
          >
            <View style={[styles.addIconCircle, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="plus" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.addBookText, { color: colors.foreground }]}>Add your first book</Text>
            <Text style={[styles.addBookSub, { color: colors.mutedForeground }]}>
              Import a PDF or paste text to start reading
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recent books list */}
      {currentBooks.length > 1 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>In progress</Text>
          {currentBooks.slice(1, 4).map(book => (
            <BookCard
              key={book.id}
              book={book}
              onPress={() => router.push(`/reader/${book.id}`)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 24 },
  greeting: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  name: { fontSize: 24, fontFamily: 'Inter_700Bold', marginTop: 2 },
  levelBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  levelText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 28 },
  streakCard: { flex: 1.1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 2 },
  streakNum: { fontSize: 28, fontFamily: 'Inter_700Bold', lineHeight: 34 },
  streakLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  goalCard: { flex: 1.3, borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'center', gap: 6 },
  ringCenter: { alignItems: 'center' },
  ringMin: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  ringLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: -2 },
  goalLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  xpCard: { flex: 1.1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 2 },
  xpNum: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  xpLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  xpTrack: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  xpFill: { height: 4, backgroundColor: '#8B5CF6', borderRadius: 2 },
  xpNext: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 14 },
  continueCard: { borderRadius: 18, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  bookSpine: { width: 48, height: 64, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  spineInitial: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFF' },
  continueInfo: { flex: 1, gap: 3 },
  continueTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', lineHeight: 22 },
  continueAuthor: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  continueProgress: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  continueBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  addBookCard: { borderRadius: 18, borderWidth: 1.5, padding: 28, alignItems: 'center', gap: 10 },
  addIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  addBookText: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  addBookSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },
});
