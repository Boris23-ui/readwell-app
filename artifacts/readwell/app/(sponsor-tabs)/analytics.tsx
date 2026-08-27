import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/utils/firebase';
import { collection, query, where, getDocs, doc, runTransaction } from 'firebase/firestore';
import { UserProfile, DailyActivity } from '@/types';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight, Layout } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export default function AnalyticsAndTokensScreen() {
  const colors = useColors();
  const { user, profile, updateProfile } = useAuth();
  
  const [learners, setLearners] = useState<UserProfile[]>([]);
  const [selectedLearner, setSelectedLearner] = useState<UserProfile | null>(null);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferAmount, setTransferAmount] = useState('1');
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchLearners = async () => {
      try {
        const q = query(collection(db, 'users'), where('sponsorId', '==', user.uid));
        const snap = await getDocs(q);
        const fetched = snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
        setLearners(fetched);
        if (fetched.length > 0) handleSelectLearner(fetched[0]);
      } catch (error) {
        console.error('Error fetching learners', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLearners();
  }, [user]);

  const handleSelectLearner = async (learner: UserProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLearner(learner);
    try {
      const dailyRef = collection(db, 'users', learner.uid as string, 'daily');
      const snap = await getDocs(dailyRef);
      const activities = snap.docs.map(d => d.data() as DailyActivity);
      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDailyActivity(activities);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransferTokens = async () => {
    if (!user || !profile || !selectedLearner) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const amount = parseInt(transferAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid number of tokens.');
      return;
    }
    if (profile.tokens < amount) {
      Alert.alert('Insufficient balance', 'You do not have enough tokens.');
      return;
    }

    setIsTransferring(true);
    try {
      const sponsorRef = doc(db, 'users', user.uid);
      const learnerRef = doc(db, 'users', selectedLearner.uid as string);

      await runTransaction(db, async (transaction) => {
        const sponsorDoc = await transaction.get(sponsorRef);
        const learnerDoc = await transaction.get(learnerRef);

        if (!sponsorDoc.exists() || !learnerDoc.exists()) throw new Error('Document missing');

        const newSponsorTokens = sponsorDoc.data().tokens - amount;
        if (newSponsorTokens < 0) throw new Error('Insufficient funds');
        
        const newLearnerTokens = learnerDoc.data().tokens + amount;

        transaction.update(sponsorRef, { tokens: newSponsorTokens });
        transaction.update(learnerRef, { tokens: newLearnerTokens });
      });

      updateProfile({ tokens: profile.tokens - amount });
      setSelectedLearner(prev => prev ? { ...prev, tokens: prev.tokens + amount } : prev);
      
      Alert.alert('Success', `Transferred ${amount} tokens to ${selectedLearner.displayName || 'the learner'}.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTransferAmount('1');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Transaction failed.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsTransferring(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (learners.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_500Medium' }}>No learners linked yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.springify()} layout={Layout.springify()} style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Analytics</Text>
        <LinearGradient
          colors={['#EAB30830', '#EAB30810']}
          style={styles.balanceContainer}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <Feather name="zap" size={16} color="#EAB308" />
          <Text style={[styles.balanceText, { color: colors.text }]}>{profile?.tokens || 0} tokens</Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).springify()} layout={Layout.springify()} style={styles.selectorContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
          {learners.map((l, index) => (
            <Animated.View key={l.uid} entering={FadeInRight.delay(150 + index * 50).springify()} layout={Layout.springify()}>
              <TouchableOpacity 
                style={[
                  styles.learnerTab, 
                  { borderColor: colors.border },
                  selectedLearner?.uid === l.uid && { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }
                ]}
                onPress={() => handleSelectLearner(l)}
              >
                <Text style={[
                  styles.learnerTabText, 
                  { color: selectedLearner?.uid === l.uid ? colors.primary : colors.textSecondary }
                ]}>
                  {l.displayName || l.name || 'Unnamed'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </ScrollView>
      </Animated.View>

      {selectedLearner && (
        <View style={styles.content}>
          <Animated.View entering={FadeInDown.delay(200).springify()} layout={Layout.springify()} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <LinearGradient
              colors={[`${colors.primary}08`, 'transparent']}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Token Manager</Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 16, fontFamily: 'Inter_400Regular' }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.text }}>{selectedLearner.displayName || 'Learner'}</Text> currently has <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.text }}>{selectedLearner.tokens || 0}</Text> tokens.
            </Text>
            
            <View style={styles.transferRow}>
              <TextInput 
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                keyboardType="numeric"
                value={transferAmount}
                onChangeText={setTransferAmount}
              />
              <TouchableOpacity 
                style={[styles.btn, { backgroundColor: colors.primary }]}
                onPress={handleTransferTokens}
                disabled={isTransferring}
              >
                {isTransferring ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.btnText}>Transfer</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          <View style={styles.statsGrid}>
            <Animated.View entering={FadeInDown.delay(250).springify()} layout={Layout.springify()} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconBg, { backgroundColor: '#EAB30820' }]}>
                <Feather name="star" size={20} color="#EAB308" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{selectedLearner.xp || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total XP</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(300).springify()} layout={Layout.springify()} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconBg, { backgroundColor: '#EF444420' }]}>
                <Feather name="flame" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{selectedLearner.streakCurrent || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Current Streak</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(350).springify()} layout={Layout.springify()} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconBg, { backgroundColor: '#3B82F620' }]}>
                <Feather name="book-open" size={20} color="#3B82F6" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{selectedLearner.totalBooksFinished || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Books Read</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(400).springify()} layout={Layout.springify()} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconBg, { backgroundColor: '#10B98120' }]}>
                <Feather name="clock" size={20} color="#10B981" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{selectedLearner.totalMinutesRead || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Mins</Text>
            </Animated.View>
          </View>

          <Animated.View entering={FadeInDown.delay(500).springify()} layout={Layout.springify()} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
            <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 16 }]}>Recent Activity</Text>
            {dailyActivity.length === 0 ? (
              <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular' }}>No reading activity found.</Text>
            ) : (
              dailyActivity.slice(0, 5).map((act, index) => (
                <View key={act.date} style={[styles.activityRow, { borderBottomColor: index === Math.min(4, dailyActivity.length - 1) ? 'transparent' : colors.border }]}>
                  <Text style={[styles.actDate, { color: colors.text }]}>{act.date}</Text>
                  <Text style={[styles.actData, { color: colors.textSecondary }]}>{act.minutesRead} mins</Text>
                  <Text style={[styles.actData, { color: colors.primary }]}>+{act.xpEarned} XP</Text>
                </View>
              ))
            )}
          </Animated.View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 60, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontFamily: 'Newsreader_700Bold' },
  balanceContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#EAB30830' },
  balanceText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  
  selectorContainer: { paddingLeft: 20, paddingBottom: 16 },
  learnerTab: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, borderWidth: 1, marginRight: 10 },
  learnerTabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  
  content: { padding: 20, paddingTop: 4 },
  card: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardTitle: { fontSize: 18, fontFamily: 'Newsreader_700Bold', marginBottom: 4 },
  
  transferRow: { flexDirection: 'row', gap: 12 },
  input: { flex: 1, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, height: 52, fontFamily: 'Inter_500Medium' },
  btn: { height: 52, paddingHorizontal: 24, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  btnText: { color: '#FFF', fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statBox: { flex: 1, minWidth: '45%', padding: 16, borderRadius: 20, borderWidth: 1, alignItems: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statIconBg: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 24, fontFamily: 'Newsreader_700Bold', marginTop: 4 },
  statLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 2 },

  activityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1 },
  actDate: { flex: 1, fontFamily: 'Inter_500Medium' },
  actData: { fontFamily: 'Inter_600SemiBold', marginLeft: 16 }
});
