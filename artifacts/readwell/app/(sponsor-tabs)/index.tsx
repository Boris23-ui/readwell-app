import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { getSponsorLearners, linkLearnerByEmail } from '@/utils/supabaseDb';
import { UserProfile } from '@/types';
import { useRouter } from 'expo-router';
import { UserPlus, ChevronRight, Users, LogOut } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export default function SponsorLearnersScreen() {
  const colors = useColors();
  const { user, signOut } = useAuth();
  const router = useRouter();
  
  const [learners, setLearners] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkEmail, setLinkEmail] = useState('');
  const [linking, setLinking] = useState(false);

  const fetchLearners = async () => {
    if (!user) return;
    try {
      const fetched = await getSponsorLearners(user.uid);
      setLearners(fetched);
    } catch (error) {
      console.error('Error fetching learners', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLearners();
  }, [user]);

  const handleLinkLearner = async () => {
    if (!linkEmail.trim() || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLinking(true);
    try {
      const result = await linkLearnerByEmail(user.uid, linkEmail.trim());
      if (!result.success) {
        Alert.alert('Error', result.message || 'Could not link learner.');
        return;
      }
      
      Alert.alert('Success', 'Learner linked successfully!');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLinkEmail('');
      fetchLearners();
    } catch (error: any) {
      Alert.alert('Error linking learner', error.message || 'Failed to link');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLinking(false);
    }
  };

  const renderItem = ({ item, index }: { item: UserProfile, index: number }) => (
    <Animated.View entering={FadeInRight.delay(100 + index * 100).springify()}>
      <TouchableOpacity 
        style={[styles.learnerCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/(sponsor-tabs)/learner/${item.uid}`);
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[`${colors.primary}10`, `transparent`]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <View style={styles.learnerInfo}>
          <Text style={[styles.learnerName, { color: colors.text }]}>{item.displayName || 'Unnamed Learner'}</Text>
          <Text style={[styles.learnerLevel, { color: colors.textSecondary }]}>Level {item.level} • {item.totalXp} XP</Text>
        </View>
        <View style={[styles.arrowContainer, { backgroundColor: `${colors.primary}15` }]}>
          <ChevronRight size={20} color={colors.primary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Animated.Text entering={FadeInDown.springify()} style={[styles.header, { color: colors.text }]}>
          My Learners
        </Animated.Text>
        <TouchableOpacity
          style={[styles.signOutBtn, { borderColor: colors.border }]}
          onPress={() => {
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
            ]);
          }}
          activeOpacity={0.7}
        >
          <LogOut size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      
      <Animated.View entering={FadeInDown.delay(100).springify()} style={[styles.linkContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LinearGradient
           colors={[`${colors.primary}15`, 'transparent']}
           style={StyleSheet.absoluteFillObject}
           start={{ x: 0, y: 0 }}
           end={{ x: 0, y: 1 }}
        />
        <Text style={[styles.linkTitle, { color: colors.text }]}>Link a new learner</Text>
        <View style={styles.linkInputRow}>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Learner's email address"
            placeholderTextColor={colors.textSecondary}
            value={linkEmail}
            onChangeText={setLinkEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TouchableOpacity 
            style={[styles.linkButton, { backgroundColor: colors.primary }]}
            onPress={handleLinkLearner}
            disabled={linking}
          >
            {linking ? <ActivityIndicator color="#fff" /> : <UserPlus size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : learners.length === 0 ? (
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: `${colors.primary}15` }]}>
            <Users size={32} color={colors.primary} />
          </View>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>You haven't linked any learners yet. Link their account using their email above.</Text>
        </Animated.View>
      ) : (
        <FlatList
          data={learners}
          keyExtractor={(item, index) => item.uid || String(index)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  header: {
    fontSize: 28,
    fontFamily: 'Newsreader_700Bold',
  },
  signOutBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkContainer: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  linkTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  linkInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    fontFamily: 'Inter_500Medium',
  },
  linkButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  listContent: {
    gap: 16,
    paddingBottom: 40,
  },
  learnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  learnerInfo: {
    flex: 1,
  },
  learnerName: {
    fontSize: 18,
    fontFamily: 'Newsreader_700Bold',
    marginBottom: 4,
  },
  learnerLevel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  arrowContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
});
