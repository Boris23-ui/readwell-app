import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/CloudAppContext';
import { useAuth } from '@/context/AuthContext';
import { getXpProgressInLevel } from '@/utils/xp';

const GOAL_OPTIONS = [10, 15, 20, 30, 45, 60];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, addTokens } = useApp();
  const { user, isGuest, signOut } = useAuth();
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  const xpProgress = getXpProgressInLevel(profile.xp);
  const initials = profile.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'R';

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 34 : 0;

  const levelProgress = xpProgress.percent;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile hero */}
      <Animated.View entering={ZoomIn.springify()} layout={Layout.springify()} style={styles.hero}>
        <View style={[styles.avatar, { backgroundColor: colors.terracotta }]}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
        <Text style={[styles.profileName, { color: colors.foreground }]}>{profile.name || 'Reader'}</Text>
        <View style={[styles.levelBadge, { backgroundColor: `${colors.honeyDeep}18`, borderColor: `${colors.honeyDeep}66` }]}>
          <Text style={[styles.levelText, { color: colors.honeyDeep }]}>LV {profile.level} · READER</Text>
        </View>
      </Animated.View>

      {/* XP bar — felt card style */}
      <Animated.View
        entering={FadeInDown.delay(100).springify()}
        layout={Layout.springify()}
        style={[
          styles.section,
          styles.feltCard,
          { backgroundColor: colors.card, borderColor: `${colors.slateDeep}55`, shadowColor: colors.shadow },
        ]}
      >
        <View style={styles.xpHeader}>
          <Text style={[styles.xpLabel, { color: colors.foreground }]}>XP Progress</Text>
          <Text style={[styles.xpValue, { color: colors.slateDeep }]}>
            {xpProgress.current} / {xpProgress.required}
          </Text>
        </View>
        <View style={[styles.xpTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.xpFill, { width: `${levelProgress * 100}%` as any, backgroundColor: colors.slateDeep }]} />
        </View>
        <Text style={[styles.xpSub, { color: colors.mutedForeground }]}>
          {xpProgress.required - xpProgress.current} XP until Level {profile.level + 1}
        </Text>
      </Animated.View>

      {/* Stats summary — felt card */}
      <Animated.View
        entering={FadeInDown.delay(200).springify()}
        layout={Layout.springify()}
        style={[
          styles.section,
          styles.feltCard,
          styles.statsGrid,
          { backgroundColor: colors.card, borderColor: `${colors.terracotta}55`, shadowColor: colors.shadow },
        ]}
      >
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.terracotta }]}>{profile.totalMinutesRead}</Text>
          <Text style={[styles.statLabelMono, { color: colors.mutedForeground }]}>MIN READ</Text>
        </View>
        <View style={[styles.vDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.terracotta }]}>{profile.streakCurrent}</Text>
          <Text style={[styles.statLabelMono, { color: colors.mutedForeground }]}>STREAK</Text>
        </View>
        <View style={[styles.vDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.sageDeep }]}>{profile.totalBooksFinished}</Text>
          <Text style={[styles.statLabelMono, { color: colors.mutedForeground }]}>FINISHED</Text>
        </View>
        <View style={[styles.vDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.honeyDeep }]}>{profile.tokens}</Text>
          <Text style={[styles.statLabelMono, { color: colors.mutedForeground }]}>TOKENS</Text>
        </View>
      </Animated.View>

      {/* Settings */}
      <Animated.View entering={FadeInUp.delay(300).springify()} layout={Layout.springify()} style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Settings</Text>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(350).springify()}
        layout={Layout.springify()}
        style={[
          styles.section,
          styles.feltCard,
          styles.settingsCard,
          { backgroundColor: colors.card, borderColor: `${colors.honey}55`, shadowColor: colors.shadow },
        ]}
      >
        {/* Daily goal */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setShowGoalPicker(!showGoalPicker)}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIcon, { backgroundColor: `${colors.terracotta}15` }]}>
            <Feather name="target" size={18} color={colors.terracotta} />
          </View>
          <View style={styles.settingLabel}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Daily Goal</Text>
            <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>
              {profile.dailyGoalMinutes} minutes/day
            </Text>
          </View>
          <Feather name={showGoalPicker ? 'chevron-up' : 'chevron-right'} size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        {showGoalPicker && (
          <View style={styles.goalPicker}>
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <View style={styles.goalOptions}>
              {GOAL_OPTIONS.map(g => (
                <TouchableOpacity
                  key={g}
                  onPress={() => {
                    updateProfile({ dailyGoalMinutes: g });
                    setShowGoalPicker(false);
                  }}
                  style={[
                    styles.goalOption,
                    {
                      backgroundColor: profile.dailyGoalMinutes === g ? `${colors.honey}30` : colors.muted,
                      borderColor: profile.dailyGoalMinutes === g ? colors.honeyDeep : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.goalOptionText, { color: profile.dailyGoalMinutes === g ? colors.honeyDeep : colors.foreground }]}>
                    {g}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* Reading level */}
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: `${colors.sageDeep}15` }]}>
            <Feather name="book-open" size={18} color={colors.sageDeep} />
          </View>
          <View style={styles.settingLabel}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Reading Level</Text>
            <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>
              {profile.readingLevel.charAt(0).toUpperCase() + profile.readingLevel.slice(1)}
            </Text>
          </View>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* Mock Refill Tokens */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => addTokens(10)}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIcon, { backgroundColor: `${colors.honeyDeep}15` }]}>
            <Feather name="plus-circle" size={18} color={colors.honeyDeep} />
          </View>
          <View style={styles.settingLabel}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Refill Tokens (Mock)</Text>
            <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>
              Add 10 tokens for testing
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* Badges earned */}
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: `${colors.honey}15` }]}>
            <Feather name="award" size={18} color={colors.honeyDeep} />
          </View>
          <View style={styles.settingLabel}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Badges Earned</Text>
            <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>
              {profile.badges.length} / 8
            </Text>
          </View>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* Account / Auth Provider Status */}
        <View style={styles.settingRow}>
          <View
            style={[
              styles.settingIcon,
              {
                backgroundColor:
                  user?.provider === 'google'
                    ? '#4285F418'
                    : user?.provider === 'apple'
                    ? '#00000018'
                    : `${colors.sageDeep}15`,
              },
            ]}
          >
            <Feather
              name={
                user?.provider === 'google'
                  ? 'check-circle'
                  : user?.provider === 'apple'
                  ? 'command'
                  : isGuest
                  ? 'user'
                  : 'mail'
              }
              size={18}
              color={
                user?.provider === 'google'
                  ? '#4285F4'
                  : user?.provider === 'apple'
                  ? colors.foreground
                  : colors.sageDeep
              }
            />
          </View>
          <View style={styles.settingLabel}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>
              {user?.provider === 'google'
                ? 'Google Account'
                : user?.provider === 'apple'
                ? 'Apple Account'
                : isGuest
                ? 'Guest Session'
                : 'Email Account'}
            </Text>
            <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>
              {user?.email || (isGuest ? 'Offline local profile' : 'Connected')}
            </Text>
          </View>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out of ReadWell?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: async () => {
                    await signOut();
                  },
                },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIcon, { backgroundColor: `${colors.destructive}18` }]}>
            <Feather name="log-out" size={18} color={colors.destructive} />
          </View>
          <View style={styles.settingLabel}>
            <Text style={[styles.settingTitle, { color: colors.destructive }]}>Sign Out</Text>
            <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>
              Switch account or return to login
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </Animated.View>

      {/* Footer mantra */}
      <Animated.View entering={FadeInUp.delay(400).springify()} layout={Layout.springify()} style={styles.footerSection}>
        <Text style={[styles.memberText, { color: colors.mutedForeground }]}>
          Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <Text style={[styles.footerMantra, { color: colors.mutedForeground }]}>
          CLICK-DRIVEN · REPLAY-EXACT · SOCRATIC RETENTION
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 30, fontFamily: 'Newsreader_700Bold', color: '#FFFDF8' },
  profileName: { fontSize: 22, fontFamily: 'Newsreader_700Bold' },
  levelBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  levelText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  section: { marginHorizontal: 20, marginBottom: 16 },
  feltCard: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  xpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  xpValue: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  xpTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  xpFill: { height: 6, borderRadius: 3 },
  xpSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  statsGrid: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statNum: { fontSize: 24, fontFamily: 'Newsreader_700Bold', lineHeight: 28 },
  statLabelMono: { fontSize: 9.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  vDivider: { width: 1, height: 36 },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontFamily: 'Newsreader_700Bold' },
  settingsCard: { overflow: 'hidden', padding: 0 },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1 },
  settingTitle: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  settingValue: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 1 },
  separator: { height: 1, marginHorizontal: 16 },
  goalPicker: {},
  goalOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  goalOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  goalOptionText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  footerSection: { paddingHorizontal: 20, marginTop: 8, gap: 8 },
  memberText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  footerMantra: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    letterSpacing: 1.1,
    opacity: 0.6,
  },
});
