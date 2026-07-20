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
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.value, { color: accent ?? colors.foreground }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    marginBottom: 4,
  },
  value: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
