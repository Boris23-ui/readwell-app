import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { getLeaderboardFromDb } from '../../utils/supabaseDb';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { getLeague } from '../../utils/xp';
import { useColors } from '../../hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

interface LeaderboardUser extends UserProfile {
  id: string;
}

export default function LeaderboardScreen() {
  const { user: currentUser } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const fetchedUsers = await getLeaderboardFromDb(50);
        setUsers(
          fetchedUsers.map(u => ({
            id: u.uid || u.name,
            ...u,
          }))
        );
      } catch (error) {
        console.error('Error fetching leaderboard: ', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const renderItem = ({ item, index }: { item: LeaderboardUser; index: number }) => {
    const isCurrentUser = item.id === currentUser?.uid;
    const elo = item.elo || 100;
    const league = getLeague(elo);

    // Dynamic accent border per rank tier
    const getBorderAccent = () => {
      if (index === 0) return '#E8C46B';
      if (index === 1) return '#8FB0D4';
      if (index === 2) return '#CF6D4D';
      return colors.border;
    };

    return (
      <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => Haptics.selectionAsync()}
          style={styles.userRowContainer}
        >
          <View
            style={[
              styles.feltUserCard,
              {
                backgroundColor: colors.card,
                borderColor: isCurrentUser ? colors.primary : `${getBorderAccent()}88`,
                shadowColor: colors.shadow,
              },
              isCurrentUser && { borderWidth: 2.5 },
            ]}
          >
            {/* Rank Badge */}
            <View style={styles.rankBadge}>
              {index === 0 ? (
                <Animated.Text entering={ZoomIn.delay(100)} style={styles.trophyEmoji}>
                  👑
                </Animated.Text>
              ) : index === 1 ? (
                <Animated.Text entering={ZoomIn.delay(150)} style={styles.trophyEmoji}>
                  🥈
                </Animated.Text>
              ) : index === 2 ? (
                <Animated.Text entering={ZoomIn.delay(200)} style={styles.trophyEmoji}>
                  🥉
                </Animated.Text>
              ) : (
                <Text style={[styles.rankNumberText, { color: colors.mutedForeground }]}>
                  #{index + 1}
                </Text>
              )}
            </View>

            {/* Reader Identity */}
            <View style={styles.readerInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text
                  style={[
                    styles.readerName,
                    { color: colors.foreground },
                    isCurrentUser && { color: colors.primary, fontFamily: 'Inter_700Bold' },
                  ]}
                  numberOfLines={1}
                >
                  {item.name || item.displayName || 'Anonymous Reader'}
                </Text>
                {isCurrentUser && (
                  <View style={[styles.youBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.youBadgeText}>YOU</Text>
                  </View>
                )}
              </View>

              <View style={styles.leagueRow}>
                <Text style={styles.leagueEmoji}>{league.icon}</Text>
                <Text style={[styles.leagueLabel, { color: league.color }]}>
                  {league.name.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* ELO Rating */}
            <View style={styles.eloBox}>
              <Text
                style={[
                  styles.eloScore,
                  {
                    color:
                      index === 0
                        ? '#B98F2F'
                        : index === 1
                        ? '#52789F'
                        : index === 2
                        ? '#CF6D4D'
                        : colors.foreground,
                  },
                ]}
              >
                {elo.toLocaleString()}
              </Text>
              <Text style={[styles.eloLabelMono, { color: colors.mutedForeground }]}>ELO</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const topPad = Platform.OS === 'web' ? 44 : insets.top + 8;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={users}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContainer, { paddingTop: topPad, paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.springify()} style={styles.headerHeroWrapper}>
            {/* Pattern Marathon Style Banner */}
            <View
              style={[
                styles.marathonFeltHero,
                {
                  backgroundColor: colors.card,
                  borderColor: `${colors.slateDeep}66`,
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <View style={styles.heroTopTagRow}>
                <Text style={[styles.seasonTag, { color: colors.slateDeep }]}>
                  SEASON 2 · THE PATTERN MARATHON
                </Text>
                <View style={[styles.ladderPill, { backgroundColor: `${colors.slateDeep}18` }]}>
                  <Text style={[styles.ladderPillText, { color: colors.slateDeep }]}>
                    ADK 2 LADDER
                  </Text>
                </View>
              </View>

              <Text style={[styles.displayTitle, { color: colors.foreground }]}>
                The Reading <Text style={{ color: colors.slateDeep }}>Marathon</Text>
              </Text>

              <Text style={[styles.marathonSubtitle, { color: colors.mutedForeground }]}>
                Ten stages, one question: who decides what you read next? The syllabus you
                drew, the Socratic AI, or your habits at runtime.
              </Text>

              {/* 3 Pillars Chips */}
              <View style={styles.pillarsRow}>
                <View style={[styles.pillarChip, { backgroundColor: `${colors.slateDeep}15` }]}>
                  <Text style={[styles.pillarText, { color: colors.slateDeep }]}>
                    P1 · GRAPH (Syllabus)
                  </Text>
                </View>
                <View style={[styles.pillarChip, { backgroundColor: `${colors.sageDeep}15` }]}>
                  <Text style={[styles.pillarText, { color: colors.sageDeep }]}>
                    P2 · COLLAB (Socratic AI)
                  </Text>
                </View>
                <View style={[styles.pillarChip, { backgroundColor: `${colors.honeyDeep}15` }]}>
                  <Text style={[styles.pillarText, { color: colors.honeyDeep }]}>
                    P3 · DYNAMIC (Habits)
                  </Text>
                </View>
              </View>

              {/* Course Checkpoint Rail */}
              <View style={[styles.courseTrack, { backgroundColor: colors.muted }]}>
                <View style={styles.courseHeader}>
                  <Text style={[styles.courseLabel, { color: colors.mutedForeground }]}>
                    THE EXPEDITION COURSE
                  </Text>
                  <Text style={[styles.courseSteps, { color: colors.slateDeep }]}>
                    L0 → L1 → L2 → L3 → L4 → L5 🏁
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.subHeadingRow}>
              <Text style={[styles.rankSectionTitle, { color: colors.foreground }]}>
                Floor Rankings
              </Text>
              <Text style={[styles.rankSectionSub, { color: colors.mutedForeground }]}>
                Ranked by text complexity & retention ELO
              </Text>
            </View>
          </Animated.View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.muted }]}>
                <Feather name="award" size={42} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyText, { color: colors.foreground }]}>
                No readers on the marathon floor yet
              </Text>
              <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>
                Complete reading sessions and quizzes to log your initial ELO score!
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContainer: { paddingHorizontal: 20 },
  headerHeroWrapper: {
    marginBottom: 16,
  },
  marathonFeltHero: {
    borderRadius: 26,
    borderWidth: 2,
    padding: 22,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
    gap: 12,
  },
  heroTopTagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seasonTag: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  ladderPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ladderPillText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  displayTitle: {
    fontSize: 32,
    fontFamily: 'Newsreader_700Bold',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  marathonSubtitle: {
    fontSize: 13.5,
    fontFamily: 'Inter_400Regular',
    lineHeight: 21,
  },
  pillarsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  pillarChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  pillarText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  courseTrack: {
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  courseSteps: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  subHeadingRow: {
    marginTop: 24,
    marginBottom: 12,
    gap: 2,
  },
  rankSectionTitle: {
    fontSize: 22,
    fontFamily: 'Newsreader_700Bold',
  },
  rankSectionSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  userRowContainer: {
    marginBottom: 12,
  },
  feltUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    gap: 12,
  },
  rankBadge: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyEmoji: {
    fontSize: 24,
  },
  rankNumberText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  readerInfo: {
    flex: 1,
    gap: 4,
  },
  readerName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  youBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youBadgeText: {
    color: '#FFFDF8',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leagueEmoji: {
    fontSize: 13,
  },
  leagueLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  eloBox: {
    alignItems: 'flex-end',
    paddingLeft: 8,
  },
  eloScore: {
    fontSize: 18,
    fontFamily: 'Newsreader_700Bold',
    lineHeight: 22,
  },
  eloLabelMono: {
    fontSize: 9.5,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  centerLoading: {
    padding: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 17,
    fontFamily: 'Newsreader_700Bold',
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
});
