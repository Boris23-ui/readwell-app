import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BadgeKey, BADGE_INFO } from '@/types';

interface Props {
  badgeKey: BadgeKey;
  earned?: boolean;
}

export function BadgeItem({ badgeKey, earned = true }: Props) {
  const colors = useColors();
  const info = BADGE_INFO[badgeKey];

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.circle,
          {
            backgroundColor: earned ? `${info.color}20` : colors.muted,
            borderColor: earned ? info.color : colors.border,
          },
        ]}
      >
        <Feather
          name={info.icon as any}
          size={22}
          color={earned ? info.color : colors.mutedForeground}
        />
      </View>
      <Text
        style={[
          styles.name,
          { color: earned ? colors.foreground : colors.mutedForeground },
        ]}
        numberOfLines={2}
      >
        {info.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 76,
    alignItems: 'center',
    gap: 6,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    lineHeight: 14,
  },
});
