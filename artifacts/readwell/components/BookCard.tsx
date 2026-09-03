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
  const totalSegments = book.segments.length || (book.pages ? book.pages.length : 1);
  const currentStage = book.currentSegmentIndex;
  const progress =
    totalSegments > 0
      ? Math.min(100, Math.round((currentStage / totalSegments) * 100))
      : 0;

  // Determine accent color theme for the stage
  const accentColor = book.coverColor || colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.feltCard,
        {
          backgroundColor: colors.card,
          borderColor: `${accentColor}55`,
          shadowColor: colors.shadow,
        },
      ]}
      activeOpacity={0.85}
    >
      {/* Top Header Row: Stage Pill + Mode Badge */}
      <View style={styles.topRow}>
        <View style={[styles.stageBadge, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}44` }]}>
          <Text style={[styles.stageBadgeText, { color: accentColor }]}>
            STAGE {currentStage}
          </Text>
        </View>

        <View style={styles.tagRow}>
          {book.sourceType === 'pdf' ? (
            <View style={[styles.modePill, { backgroundColor: colors.muted }]}>
              <Text style={[styles.modePillText, { color: colors.mutedForeground }]}>
                PDF · {book.pages?.length || 0} PGS
              </Text>
            </View>
          ) : (
            <View style={[styles.modePill, { backgroundColor: colors.muted }]}>
              <Text style={[styles.modePillText, { color: colors.mutedForeground }]}>
                SEQUENTIAL
              </Text>
            </View>
          )}

          {book.status === 'finished' && (
            <View style={[styles.modePill, { backgroundColor: `${colors.sageDeep}22` }]}>
              <Text style={[styles.modePillText, { color: colors.sageDeep }]}>COMPLETE 🏁</Text>
            </View>
          )}
        </View>
      </View>

      {/* Main Body: Cover Initial + Title & Author */}
      <View style={styles.bodyRow}>
        <View style={[styles.feltCover, { backgroundColor: accentColor }]}>
          <Text style={styles.coverLetter}>{book.title[0]?.toUpperCase() ?? 'R'}</Text>
        </View>

        <View style={styles.textCol}>
          <Text style={[styles.displayTitle, { color: colors.foreground }]} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={[styles.authorSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {book.author || 'Anonymous Author'}
          </Text>
        </View>
      </View>

      {/* Bottom Progress Bar & Tactile ENTER Action */}
      <View style={styles.footerRow}>
        <View style={styles.progressCol}>
          <View style={[styles.progressBarTrack, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.progressBarFill,
                { backgroundColor: accentColor, width: `${progress}%` as any },
              ]}
            />
          </View>
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressMono, { color: colors.mutedForeground }]}>
              {currentStage} OF {totalSegments} PARTS
            </Text>
            <Text style={[styles.progressMono, { color: colors.foreground }]}>
              {progress}%
            </Text>
          </View>
        </View>

        <View style={[styles.btnFelt, { backgroundColor: colors.honey, shadowColor: colors.shadow }]}>
          <Text style={styles.btnFeltText}>
            {book.status === 'finished' ? 'REVIEW ▸' : 'ENTER ▸'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  feltCard: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  stageBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
  },
  modePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  modePillText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  feltCover: {
    width: 50,
    height: 66,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
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
    gap: 16,
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 130, 110, 0.1)',
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
    fontSize: 10.5,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
  },
  btnFelt: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  btnFeltText: {
    color: '#1F1C18',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
  },
});
