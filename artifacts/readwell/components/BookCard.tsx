import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Book } from '@/types';
import { estimateReadMinutes } from '@/utils/content';

interface Props {
  book: Book;
  onPress: () => void;
  onDelete?: () => void;
}

export function BookCard({ book, onPress, onDelete }: Props) {
  const colors = useColors();
  const totalSegments = book.segments.length || (book.pages ? book.pages.length : 1);
  const completedSegments =
    book.status === 'finished'
      ? totalSegments
      : Math.min(Math.max(0, book.currentSegmentIndex || 0), totalSegments);
  const progress =
    totalSegments > 0
      ? Math.min(100, Math.round((completedSegments / totalSegments) * 100))
      : 0;

  const accentColor = book.coverColor || colors.primary;
  const activeSegment = book.segments[Math.min(completedSegments, Math.max(0, totalSegments - 1))];

  const statusLabel =
    book.status === 'finished'
      ? 'Finished'
      : book.sourceType === 'pdf' && book.pages?.length
      ? completedSegments === 0
        ? 'Not started'
        : `Page ${activeSegment?.pageStart ?? 1} of ${book.pages.length}`
      : completedSegments === 0
      ? 'Not started'
      : `Section ${Math.min(completedSegments + 1, totalSegments)} of ${totalSegments}`;

  const ctaLabel =
    book.status === 'finished'
      ? 'Read again'
      : completedSegments > 0
      ? 'Continue'
      : 'Start';

  const metaLabel =
    book.sourceType === 'pdf'
      ? `PDF · ${book.pages?.length || 0} pgs`
      : `~${estimateReadMinutes(book.wordCount || 0)} min`;

  return (
    <View
      style={[
        styles.feltCard,
        {
          backgroundColor: colors.card,
          borderColor: `${accentColor}44`,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {/* Top Header Row: Status + Format Meta (clickable) + Sibling Delete Button */}
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={styles.topRowMain}
          accessibilityRole="button"
          accessibilityLabel={`Open ${book.title}`}
        >
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  book.status === 'finished' ? `${colors.sage}28` : `${accentColor}16`,
                borderColor:
                  book.status === 'finished' ? `${colors.sageDeep}55` : `${accentColor}38`,
              },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                { color: book.status === 'finished' ? colors.sageDeep : accentColor },
              ]}
            >
              {statusLabel}
            </Text>
          </View>

          <View style={[styles.modePill, { backgroundColor: colors.muted }]}>
            <Text style={[styles.modePillText, { color: colors.mutedForeground }]}>
              {metaLabel}
            </Text>
          </View>
        </TouchableOpacity>

        {onDelete && (
          <TouchableOpacity
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${book.title}`}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.deleteBtn, { backgroundColor: colors.muted }]}
          >
            <Feather name="trash-2" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Main Card Body & Footer (separate pressable so delete is never nested inside a button) */}
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${book.title} by ${book.author || 'Unknown Author'}. ${progress}% complete, ${statusLabel}. ${ctaLabel}`}
        activeOpacity={0.85}
        style={styles.bodyPressable}
      >
        <View style={styles.bodyRow}>
          <View style={[styles.feltCover, { backgroundColor: accentColor }]}>
            <Text style={styles.coverLetter}>{book.title[0]?.toUpperCase() ?? 'R'}</Text>
          </View>

          <View style={styles.textCol}>
            <Text style={[styles.displayTitle, { color: colors.foreground }]} numberOfLines={2}>
              {book.title}
            </Text>
            <Text style={[styles.authorSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              {book.author || 'Imported reading'}
            </Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.progressCol}>
            <View style={[styles.progressBarTrack, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: book.status === 'finished' ? colors.sageDeep : accentColor,
                    width: `${progress}%` as any,
                  },
                ]}
              />
            </View>
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressMono, { color: colors.mutedForeground }]}>
                {completedSegments} of {totalSegments} {totalSegments === 1 ? 'section' : 'sections'}
              </Text>
              <Text style={[styles.progressMono, { color: colors.foreground }]}>
                {progress}%
              </Text>
            </View>
          </View>

          <View style={[styles.btnFelt, { backgroundColor: colors.honey, shadowColor: colors.shadow }]}>
            <Text style={styles.btnFeltText}>{ctaLabel}</Text>
            <Feather name="arrow-right" size={13} color="#1F1C18" />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  feltCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  topRowMain: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  bodyPressable: {
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontFamily: 'Inter_600SemiBold',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modePillText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  feltCover: {
    width: 48,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 2,
  },
  coverLetter: {
    color: '#FFFDF8',
    fontSize: 24,
    fontFamily: 'Newsreader_700Bold',
  },
  textCol: {
    flex: 1,
    gap: 3,
  },
  displayTitle: {
    fontSize: 17,
    fontFamily: 'Newsreader_700Bold',
    lineHeight: 22,
  },
  authorSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 130, 110, 0.12)',
  },
  progressCol: {
    flex: 1,
    gap: 6,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressMono: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  btnFelt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  btnFeltText: {
    color: '#1F1C18',
    fontSize: 12.5,
    fontFamily: 'Inter_700Bold',
  },
});
