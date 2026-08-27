import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
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
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('elo', 'desc'), limit(50));
        const querySnapshot = await getDocs(q);
        
        const fetchedUsers = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as LeaderboardUser[];
        
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error fetching leaderboard: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const renderItem = ({ item, index }: { item: LeaderboardUser, index: number }) => {
    const isCurrentUser = item.id === currentUser?.uid;
    const elo = item.elo || 100;
    const league = getLeague(elo);
    
    // Dynamic premium backgrounds for top 3
    const getBgColors = () => {
      if (index === 0) return ['#FFD70033', colors.card];
      if (index === 1) return ['#C0C0C033', colors.card];
      if (index === 2) return ['#CD7F3233', colors.card];
      return [colors.card, colors.card];
    };
    
    return (
      <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => Haptics.selectionAsync()}
          style={[styles.userRowContainer, { shadowColor: colors.shadow }]}
        >
          <LinearGradient
            colors={getBgColors()}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.userRow, 
              { borderColor: colors.border, backgroundColor: colors.card },
              isCurrentUser && { borderColor: colors.primary, borderWidth: 1.5 },
              index < 3 && { borderColor: `${getBgColors()[0]}99` }
            ]}
          >
            <View style={styles.rankContainer}>
              {index === 0 ? <Animated.Text entering={ZoomIn.delay(200)} style={styles.emoji}>👑</Animated.Text> :
               index === 1 ? <Animated.Text entering={ZoomIn.delay(300)} style={styles.emoji}>🥈</Animated.Text> :
               index === 2 ? <Animated.Text entering={ZoomIn.delay(400)} style={styles.emoji}>🥉</Animated.Text> :
               <Text style={[styles.rankText, { color: colors.mutedForeground }]}>#{index + 1}</Text>}
            </View>
            
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.foreground }, isCurrentUser && { color: colors.primary }]}>
                {item.name || item.displayName || 'Anonymous Reader'} {isCurrentUser && '(You)'}
              </Text>
              <View style={styles.leagueContainer}>
                <Text style={styles.leagueEmoji}>{league.icon}</Text>
                <Text style={[styles.leagueText, { color: league.color }]}>{league.name}</Text>
              </View>
            </View>
            
            <View style={styles.xpContainer}>
              <Text style={[styles.xpText, { color: index === 0 ? '#F59E0B' : index === 1 ? '#9CA3AF' : index === 2 ? '#D97706' : colors.primary }]}>
                {elo.toLocaleString()} ELO
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View entering={FadeInDown.springify()} style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 20) }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Global Ranking</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Compete by reading complex material.</Text>
      </Animated.View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Animated.View entering={FadeInUp.springify()} style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.muted }]}>
                <Feather name="award" size={48} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyText, { color: colors.foreground }]}>No readers found.</Text>
              <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>Start reading to appear on the leaderboard!</Text>
            </Animated.View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  title: { fontSize: 32, fontFamily: 'Newsreader_700Bold', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', marginTop: 6, opacity: 0.8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: 16, paddingBottom: 100 },
  userRowContainer: { marginBottom: 12, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, overflow: 'hidden'
  },
  rankContainer: { width: 44, alignItems: 'center', marginRight: 12 },
  emoji: { fontSize: 28 },
  rankText: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  leagueContainer: { flexDirection: 'row', alignItems: 'center' },
  leagueEmoji: { fontSize: 14, marginRight: 6 },
  leagueText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  xpContainer: { alignItems: 'flex-end', paddingLeft: 10 },
  xpText: { fontSize: 17, fontFamily: 'Newsreader_700Bold' },
  emptyContainer: { padding: 40, alignItems: 'center', marginTop: 40 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyText: { fontSize: 18, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  emptySubText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
