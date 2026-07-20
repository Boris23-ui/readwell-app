import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { getXpProgressInLevel } from '@/utils/xp';

const GOAL_OPTIONS = [10, 15, 20, 30, 45, 60];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useApp();
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
      <View style={styles.hero}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
        <Text style={[styles.profileName, { color: colors.foreground }]}>{profile.name || 'Reader'}</Text>
        <View style={[styles.levelBadge, { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }]}>
          <Text style={[styles.levelText, { color: colors.primary }]}>Level {profile.level}</Text>
        </View>
      </View>

      {/* XP bar */}
      <View style={[styles.section, styles.xpCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.xpHeader}>
          <Text style={[styles.xpLabel, { color: colors.foreground }]}>XP Progress</Text>
          <Text style={[styles.xpValue, { color: colors.primary }]}>
            {xpProgress.current} / {xpProgress.required}
          </Text>
        </View>
        <View style={[styles.xpTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.xpFill, { width: `${levelProgress * 100}%` as any, backgroundColor: '#8B5CF6' }]} />
        </View>
        <Text style={[styles.xpSub, { color: colors.mutedForeground }]}>
          {xpProgress.required - xpProgress.current} XP until Level {profile.level + 1}
        </Text>
      </View>

      {/* Stats summary */}
      <View style={[styles.section, styles.statsGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.primary }]}>{profile.totalMinutesRead}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>min read</Text>
        </View>
        <View style={[styles.vDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#EF4444' }]}>{profile.streakCurrent}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>day streak</Text>
        </View>
        <View style={[styles.vDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#22C55E' }]}>{profile.totalBooksFinished}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>finished</Text>
        </View>
      </View>

      {/* Settings */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Settings</Text>
      </View>

      <View style={[styles.section, styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Daily goal */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setShowGoalPicker(!showGoalPicker)}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="target" size={18} color={colors.primary} />
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
                      backgroundColor: profile.dailyGoalMinutes === g ? `${colors.primary}20` : colors.muted,
                      borderColor: profile.dailyGoalMinutes === g ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.goalOptionText, { color: profile.dailyGoalMinutes === g ? colors.primary : colors.foreground }]}>
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
          <View style={[styles.settingIcon, { backgroundColor: '#8B5CF615' }]}>
            <Feather name="book-open" size={18} color="#8B5CF6" />
          </View>
          <View style={styles.settingLabel}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Reading Level</Text>
            <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>
              {profile.readingLevel.charAt(0).toUpperCase() + profile.readingLevel.slice(1)}
            </Text>
          </View>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* Badges earned */}
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: '#F59E0B15' }]}>
            <Feather name="award" size={18} color="#F59E0B" />
          </View>
          <View style={styles.settingLabel}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Badges Earned</Text>
            <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>
              {profile.badges.length} / 8
            </Text>
          </View>
        </View>
      </View>

      {/* Member since */}
      <View style={styles.section}>
        <Text style={[styles.memberText, { color: colors.mutedForeground }]}>
          Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 30, fontFamily: 'Inter_700Bold', color: '#FFF' },
  profileName: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  levelBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  levelText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  section: { marginHorizontal: 20, marginBottom: 16 },
  xpCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 10 },
  xpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  xpValue: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  xpTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  xpFill: { height: 8, borderRadius: 4 },
  xpSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  statsGrid: { borderRadius: 18, borderWidth: 1, padding: 18, flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statNum: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  vDivider: { width: 1, height: 40 },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  settingsCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1 },
  settingTitle: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  settingValue: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 1 },
  separator: { height: 1, marginHorizontal: 16 },
  goalPicker: {},
  goalOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  goalOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  goalOptionText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  memberText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
