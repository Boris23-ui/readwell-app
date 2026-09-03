import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useCoach } from '@/context/CoachContext';

interface Props {
  onOpenCoach?: () => void;
}

export function WhileYouWereAwayCard({ onOpenCoach }: Props) {
  const colors = useColors();
  const { digest, dismissDigest, strategy } = useCoach();

  if (!digest) return null;

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dismissDigest();
  };

  const handleOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onOpenCoach?.();
  };

  return (
    <Animated.View entering={FadeInDown.springify()} style={styles.container}>
      <View
        style={[
          styles.feltCard,
          {
            backgroundColor: colors.card,
            borderColor: `${colors.terracotta}66`,
            shadowColor: colors.shadow,
          },
        ]}
      >
        {/* Top Tag Row */}
        <View style={styles.topRow}>
          <View style={styles.badgeGroup}>
            <View style={[styles.stagePill, { backgroundColor: `${colors.terracotta}18` }]}>
              <Text style={[styles.stagePillText, { color: colors.terracotta }]}>
                STAGE 0 · SOCRATIC DIGEST
              </Text>
            </View>
            <Text style={[styles.versionMono, { color: colors.mutedForeground }]}>
              v{digest.strategyVersion || strategy?.version || 1}
            </Text>
          </View>

          <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.titleRow}>
          <Text style={[styles.displayTitle, { color: colors.foreground }]}>
            While You Were Away
          </Text>
          <Text style={[styles.timeSubtitle, { color: colors.mutedForeground }]}>
            {digest.daysAway ? `${digest.daysAway} days off the floor` : 'Fresh briefing'}
          </Text>
        </View>

        {/* Digest Body */}
        <Text style={[styles.digestBody, { color: colors.foreground }]} numberOfLines={4}>
          {digest.digest}
        </Text>

        {/* Action Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={handleOpen}
            style={[styles.btnFelt, { backgroundColor: colors.honey }]}
            activeOpacity={0.85}
          >
            <Text style={styles.btnFeltText}>ENTER COACH ▸</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDismiss} style={styles.dismissBtn}>
            <Text style={[styles.dismissText, { color: colors.mutedForeground }]}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  feltCard: {
    borderRadius: 24,
    borderWidth: 2,
    padding: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stagePill: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  stagePillText: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  versionMono: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  titleRow: {
    gap: 2,
  },
  displayTitle: {
    fontSize: 21,
    fontFamily: 'Newsreader_700Bold',
    lineHeight: 26,
  },
  timeSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  digestBody: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    opacity: 0.9,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  btnFelt: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  btnFeltText: {
    color: '#1F1C18',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
  },
  dismissBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  dismissText: {
    fontSize: 12.5,
    fontFamily: 'Inter_500Medium',
  },
});
