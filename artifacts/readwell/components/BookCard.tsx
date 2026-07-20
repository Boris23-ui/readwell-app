import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Book } from '@/types';

interface Props {
  book: Book;
  onPress: () => void;
}

export function BookCard({ book, onPress }: Props) {
  const colors = useColors();
  const progress =
    book.segments.length > 0
      ? Math.round((book.currentSegmentIndex / book.segments.length) * 100)
      : 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.75}
    >
      <View style={[styles.cover, { backgroundColor: book.coverColor }]}>
        <Text style={styles.coverInitial}>{book.title[0]?.toUpperCase() ?? 'B'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={[styles.author, { color: colors.mutedForeground }]} numberOfLines={1}>
          {book.author || 'Unknown Author'}
        </Text>
        <View style={styles.progressRow}>
          <View style={[styles.track, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.fill,
                { backgroundColor: book.coverColor, width: `${progress}%` as any },
              ]}
            />
          </View>
          <Text style={[styles.pct, { color: colors.mutedForeground }]}>{progress}%</Text>
        </View>
        <View style={styles.tagRow}>
          {book.sourceType === 'pdf' && book.pages && (
            <View style={[styles.badge, { backgroundColor: `${book.coverColor}18` }]}>
              <Text style={[styles.badgeText, { color: book.coverColor }]}>
                PDF · {book.pages.length} {book.pages.length === 1 ? 'page' : 'pages'}
              </Text>
            </View>
          )}
          {book.status === 'finished' && (
            <View style={[styles.badge, { backgroundColor: '#22C55E20' }]}>
              <Text style={[styles.badgeText, { color: '#22C55E' }]}>Finished</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  cover: {
    width: 56,
    height: 74,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter_700Bold',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 20,
  },
  author: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  pct: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    width: 30,
    textAlign: 'right',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
});
