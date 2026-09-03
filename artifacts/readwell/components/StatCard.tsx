import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: string;
}

export function StatCard({ label, value, icon, accent }: Props) {
  const colors = useColors();
  const borderTint = accent ? `${accent}55` : colors.border;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: borderTint,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.value, { color: accent ?? colors.foreground }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 2,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  icon: {
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontFamily: 'Newsreader_700Bold',
    lineHeight: 28,
  },
  label: {
    fontSize: 9.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
});
