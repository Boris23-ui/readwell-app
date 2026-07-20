import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { DailyActivity } from '@/types';

interface Props {
  activities: DailyActivity[];
  goalMinutes: number;
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function WeeklyChart({ activities, goalMinutes }: Props) {
  const colors = useColors();

  // Build last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const activity = activities.find(a => a.date === dateStr);
    return {
      label: DAY_LABELS[d.getDay()],
      minutes: activity?.minutesRead ?? 0,
      isToday: i === 6,
      goalMet: activity?.goalMet ?? false,
    };
  });

  const maxMinutes = Math.max(goalMinutes, ...days.map(d => d.minutes), 1);
  const BAR_HEIGHT = 100;

  return (
    <View style={styles.container}>
      <View style={styles.chartRow}>
        {days.map((day, i) => {
          const barH = Math.max(4, Math.round((day.minutes / maxMinutes) * BAR_HEIGHT));
          const barColor = day.goalMet
            ? colors.primary
            : day.minutes > 0
            ? `${colors.primary}60`
            : colors.muted;

          return (
            <View key={i} style={styles.barCol}>
              <View style={[styles.barTrack, { height: BAR_HEIGHT }]}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barH,
                      backgroundColor: barColor,
                      borderRadius: day.isToday ? 6 : 4,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: day.isToday ? colors.primary : colors.mutedForeground,
                    fontFamily: day.isToday ? 'Inter_600SemiBold' : 'Inter_400Regular',
                  },
                ]}
              >
                {day.label}
              </Text>
              {day.minutes > 0 && (
                <Text style={[styles.minLabel, { color: colors.mutedForeground }]}>
                  {day.minutes}m
                </Text>
              )}
            </View>
          );
        })}
      </View>
      <View style={[styles.goalLine, { bottom: 34 + Math.round((goalMinutes / maxMinutes) * BAR_HEIGHT) - 1 }]}>
        <View style={[styles.goalDash, { borderColor: `${colors.primary}60` }]} />
        <Text style={[styles.goalLabel, { color: `${colors.primary}80` }]}>goal</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingBottom: 34,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barTrack: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  bar: {
    width: '70%',
  },
  dayLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  minLabel: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goalDash: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  goalLabel: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
});
