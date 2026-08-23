import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image } from 'react-native';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types';
import { Feather } from '@expo/vector-icons';

interface LeaderboardUser extends UserProfile {
  id: string;
}

export default function LeaderboardScreen() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('xp', 'desc'), limit(50));
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
    const isTopThree = index < 3;
    
    return (
      <View style={[styles.userRow, isCurrentUser && styles.currentUserRow]}>
        <View style={styles.rankContainer}>
          {index === 0 ? <Text style={styles.emoji}>🥇</Text> :
           index === 1 ? <Text style={styles.emoji}>🥈</Text> :
           index === 2 ? <Text style={styles.emoji}>🥉</Text> :
           <Text style={styles.rankText}>#{index + 1}</Text>}
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, isCurrentUser && styles.currentUserName]}>
            {item.name || 'Anonymous Reader'} {isCurrentUser && '(You)'}
          </Text>
          <Text style={styles.userLevel}>Level {item.level}</Text>
        </View>
        <View style={styles.xpContainer}>
          <Text style={styles.xpText}>{item.xp.toLocaleString()} XP</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Global Leaderboard</Text>
        <Text style={styles.subtitle}>Top readers by comprehension XP</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="users" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No readers found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  currentUserRow: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 24,
  },
  rankText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#6B7280',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#1F2937',
  },
  currentUserName: {
    color: '#1D4ED8',
  },
  userLevel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  xpContainer: {
    alignItems: 'flex-end',
  },
  xpText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#F59E0B', // Amber for XP
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
  },
});
