import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoachChatView } from '@/components/CoachChatView';

export default function LearnerMessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 768;

  // ClassicTabLayout uses an absolute bottom tab bar; keep the chat composer cleanly above it.
  const bottomClearance =
    Platform.OS === 'web'
      ? isWide
        ? 98
        : 76
      : Platform.OS === 'ios'
      ? 86
      : 68;

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === 'web' ? 12 : insets.top,
          paddingBottom: bottomClearance,
        },
      ]}
    >
      <CoachChatView />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
