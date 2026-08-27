import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { useColors } from '@/hooks/useColors';
import { ProgressRing } from '@/components/ProgressRing';
import { getXpProgressInLevel } from '@/utils/xp';
import { UserProfile, Book, DailyActivity } from '@/types';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export default function SponsorLearnerViewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const learnerId = Array.isArray(id) ? id[0] : id;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [todayActivity, setTodayActivity] = useState<DailyActivity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!learnerId) return;

    const fetchData = async () => {
      try {
        const pSnap = await getDoc(doc(db, 'users', learnerId));
        if (pSnap.exists()) {
          setProfile(pSnap.data() as UserProfile);
        }

        const bSnap = await getDocs(collection(db, 'users', learnerId, 'books'));
        setBooks(bSnap.docs.map(d => d.data() as Book));

        const todayStr = getTodayString();
        const aSnap = await getDoc(doc(db, 'users', learnerId, 'daily', todayStr));
        if (aSnap.exists()) {
          setTodayActivity(aSnap.data() as DailyActivity);
        }
      } catch (e) {
        console.error('Failed to fetch learner data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [learnerId]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Learner not found.</Text>
      </View>
    );
  }

  const todayMinutes = todayActivity?.minutesRead ?? 0;
  const goalProgress = Math.min(1, todayMinutes / profile.dailyGoalMinutes);
  const currentBooks = books.filter(b => b.status === 'in_progress');
  const xpProgress = getXpProgressInLevel(profile.xp);

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 34 : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Learner Dashboard</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{profile.displayName || profile.name || 'Unnamed'}</Text>
        </View>
        <View style={[styles.levelBadge, { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }]}>
          <Text style={[styles.levelText, { color: colors.primary }]}>Lv {profile.level}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
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

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Currently Reading</Text>
        {currentBooks.length === 0 ? (
          <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular' }}>Not reading any books right now.</Text>
        ) : (
          currentBooks.map(book => (
            <View key={book.id} style={[styles.continueCard, { borderColor: colors.border, marginBottom: 8 }]}>
               <View style={[styles.bookSpine, { backgroundColor: book.coverColor }]}>
                 <Text style={styles.spineInitial}>{book.title[0]?.toUpperCase()}</Text>
               </View>
               <View style={styles.continueInfo}>
                 <Text style={[styles.continueTitle, { color: colors.foreground }]} numberOfLines={2}>{book.title}</Text>
                 <Text style={[styles.continueAuthor, { color: colors.mutedForeground }]}>{book.author}</Text>
               </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 24 },
  greeting: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  name: { fontSize: 24, fontFamily: 'Newsreader_700Bold', marginTop: 2 },
  levelBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  levelText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 28 },
  streakCard: { flex: 1.1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 2 },
  streakNum: { fontSize: 28, fontFamily: 'Newsreader_700Bold', lineHeight: 34 },
  streakLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  goalCard: { flex: 1.3, borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'center', gap: 6 },
  ringCenter: { alignItems: 'center' },
  ringMin: { fontSize: 18, fontFamily: 'Newsreader_700Bold' },
  ringLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: -2 },
  goalLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  xpCard: { flex: 1.1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 2 },
  xpNum: { fontSize: 22, fontFamily: 'Newsreader_700Bold' },
  xpLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  xpTrack: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  xpFill: { height: 4, backgroundColor: '#8B5CF6', borderRadius: 2 },
  xpNext: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontFamily: 'Newsreader_700Bold', marginBottom: 14 },
  continueCard: { borderRadius: 18, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  bookSpine: { width: 48, height: 64, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  spineInitial: { fontSize: 22, fontFamily: 'Newsreader_700Bold', color: '#FFF' },
  continueInfo: { flex: 1, gap: 3 },
  continueTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', lineHeight: 22 },
  continueAuthor: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
