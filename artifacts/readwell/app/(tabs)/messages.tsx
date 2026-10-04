import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoachChatView } from '@/components/CoachChatView';

export default function LearnerMessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <CoachChatView />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
