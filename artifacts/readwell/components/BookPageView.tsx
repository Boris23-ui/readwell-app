import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  BookBlock,
  CalloutKind,
  countWords,
  estimateReadMinutes,
  extractParagraphLeadIn,
  formatSegmentForBookReader,
} from '@/utils/content';

export type PaperTheme = 'paper' | 'sepia' | 'night';
export type BookLayoutMode = 'classic' | 'separated';

export interface PaperPalette {
  id: PaperTheme;
  label: string;
  canvasBg: string;
  pageBg: string;
  pageStack1: string;
  pageStack2: string;
  ink: string;
  secondaryInk: string;
  mutedInk: string;
  border: string;
  rule: string;
  calloutBg: string;
  spotlightBg: string;
  spineTint: string;
}

export const PAPER_PALETTES: Record<PaperTheme, PaperPalette> = {
  paper: {
    id: 'paper',
    label: 'Paper',
    canvasBg: '#F2ECE1',
    pageBg: '#FCF9F2',
    pageStack1: '#F6F0E4',
    pageStack2: '#EDE5D5',
    ink: '#1F1C18',
    secondaryInk: '#463E33',
    mutedInk: '#786E5C',
    border: '#E3D9C6',
    rule: '#D6C9B1',
    calloutBg: '#F5EFE2',
    spotlightBg: '#F4ECDC',
    spineTint: 'rgba(110, 85, 50, 0.08)',
  },
  sepia: {
    id: 'sepia',
    label: 'Sepia',
    canvasBg: '#E5D7BE',
    pageBg: '#F4E8D1',
    pageStack1: '#EDE0C6',
    pageStack2: '#E2D2B5',
    ink: '#2A2016',
    secondaryInk: '#4E3D2C',
    mutedInk: '#78624B',
    border: '#D4C1A0',
    rule: '#C5AE87',
    calloutBg: '#ECE0C6',
    spotlightBg: '#EADBC0',
    spineTint: 'rgba(95, 65, 30, 0.11)',
  },
  night: {
    id: 'night',
    label: 'Night',
    canvasBg: '#12100E',
    pageBg: '#1D1916',
    pageStack1: '#181512',
    pageStack2: '#14110F',
    ink: '#ECE4D7',
    secondaryInk: '#C8BDAE',
    mutedInk: '#8E8373',
    border: '#342E27',
    rule: '#433B32',
    calloutBg: '#26211C',
    spotlightBg: '#28231D',
    spineTint: 'rgba(0, 0, 0, 0.35)',
  },
};

function toRomanNumeral(num: number): string {
  if (num <= 0 || num > 200) return String(num);
  const lookup: Array<[number, string]> = [
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let n = num;
  let result = '';
  for (const [value, symbol] of lookup) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
}

function getCalloutAccent(kind: CalloutKind | undefined, defaultAccent: string): {
  accent: string;
  icon: keyof typeof Feather.glyphMap;
} {
  switch (kind) {
    case 'definition':
      return { accent: '#CF6D4D', icon: 'book-open' };
    case 'theorem':
      return { accent: '#52789F', icon: 'compass' };
    case 'example':
      return { accent: '#6A9862', icon: 'layers' };
    default:
      return { accent: defaultAccent || '#B98F2F', icon: 'bookmark' };
  }
}

export interface BookPageViewProps {
  bookTitle: string;
  bookAuthor?: string;
  coverColor: string;
  segmentIndex: number;
  totalSegments: number;
  paragraphs: string[];
  pageRangeLabel?: string;
  fontSize: number;
  lineHeight: number;
  useSerif: boolean;
  paperTheme: PaperTheme;
  layoutMode: BookLayoutMode;
  isSimplified?: boolean;
  onExitSimplified?: () => void;
}

export function BookPageView({
  bookTitle,
  bookAuthor,
  coverColor,
  segmentIndex,
  totalSegments,
  paragraphs,
  pageRangeLabel,
  fontSize,
  lineHeight,
  useSerif,
  paperTheme,
  layoutMode,
  isSimplified = false,
  onExitSimplified,
}: BookPageViewProps) {
  const palette = PAPER_PALETTES[paperTheme] ?? PAPER_PALETTES.paper;
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  useEffect(() => {
    setFocusedBlockId(null);
  }, [segmentIndex, paragraphs, isSimplified]);

  const blocks: BookBlock[] = useMemo(
    () => formatSegmentForBookReader(paragraphs),
    [paragraphs],
  );

  const proseParagraphCount = useMemo(
    () => blocks.filter(b => b.type === 'paragraph').length,
    [blocks],
  );

  const sectionWordCount = useMemo(
    () => countWords(paragraphs.join(' ')),
    [paragraphs],
  );

  const estimatedMinutes = useMemo(
    () => estimateReadMinutes(sectionWordCount),
    [sectionWordCount],
  );

  const bodyFont = useSerif ? 'Newsreader_400Regular' : 'Inter_400Regular';
  const boldBodyFont = useSerif ? 'Newsreader_700Bold' : 'Inter_600SemiBold';
  const italicBodyFont = useSerif ? 'Newsreader_400Regular_Italic' : 'Inter_400Regular';

  const romanSection = toRomanNumeral(segmentIndex + 1);
  const pageFolioText = pageRangeLabel
    ? `Pages ${pageRangeLabel}`
    : `Page ${segmentIndex + 1} of ${totalSegments}`;

  const handleToggleFocus = (blockId: string) => {
    Haptics.selectionAsync();
    setFocusedBlockId(prev => (prev === blockId ? null : blockId));
  };

  return (
    <View style={styles.outerBookWrap}>
      {/* Main Open Book Page Sheet */}
      <View
        style={[
          styles.bookPageSheet,
          {
            backgroundColor: palette.pageBg,
            borderColor: palette.border,
          },
        ]}
      >
        {/* Subtle book spine shadow strip along the left gutter */}
        <View
          pointerEvents="none"
          style={[
            styles.spineGutter,
            {
              backgroundColor: palette.spineTint,
              borderRightColor: palette.border,
            },
          ]}
        />

        <View style={styles.pageInner}>
          {/* Classic Book Running Header */}
          <View style={[styles.runningHeader, { borderBottomColor: palette.rule }]}>
            <Text
              style={[styles.runningHeaderLeft, { color: palette.mutedInk }]}
              numberOfLines={1}
            >
              {pageRangeLabel ? `PAGES ${pageRangeLabel.toUpperCase()}` : `SECTION ${romanSection}`}
            </Text>
            <Text
              style={[styles.runningHeaderRight, { color: palette.mutedInk }]}
              numberOfLines={1}
            >
              {bookAuthor ? `${bookAuthor}  •  ${bookTitle}` : bookTitle}
            </Text>
          </View>

          {/* Simplified Banner if viewing AI simplified passage */}
          {isSimplified && (
            <View
              style={[
                styles.simplifiedBanner,
                {
                  backgroundColor: `${coverColor}15`,
                  borderColor: `${coverColor}45`,
                },
              ]}
            >
              <View style={styles.simplifiedBannerLeft}>
                <Feather name="zap" size={15} color={coverColor} />
                <Text style={[styles.simplifiedBannerTitle, { color: coverColor }]}>
                  AI Simplified Book Edition
                </Text>
              </View>
              {onExitSimplified && (
                <TouchableOpacity
                  onPress={onExitSimplified}
                  style={[styles.simplifiedRestoreBtn, { borderColor: coverColor }]}
                >
                  <Text style={[styles.simplifiedRestoreText, { color: coverColor }]}>
                    Original Text
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Ornamental Chapter / Section Title Plate */}
          <View style={styles.chapterPlate}>
            <View
              style={[
                styles.sectionNumeralPill,
                {
                  backgroundColor: `${coverColor}14`,
                  borderColor: `${coverColor}38`,
                },
              ]}
            >
              <Text style={[styles.sectionNumeralText, { color: coverColor }]}>
                CHAPTER SECTION {romanSection}
              </Text>
            </View>

            <Text style={[styles.chapterMetaText, { color: palette.mutedInk }]}>
              {proseParagraphCount} paragraph{proseParagraphCount !== 1 ? 's' : ''}  •  {sectionWordCount} words  •  ~{estimatedMinutes} min read
            </Text>

            {/* Ornamental Rule beneath Chapter Plate */}
            <View style={styles.ornamentalRuleRow}>
              <View style={[styles.ornamentalLine, { backgroundColor: palette.rule }]} />
              <Text style={[styles.ornamentalGlyph, { color: coverColor }]}>❖</Text>
              <View style={[styles.ornamentalLine, { backgroundColor: palette.rule }]} />
            </View>

            {/* Interactive Reading Guide / Spotlight Helper */}
            <View style={styles.focusHintRow}>
              {focusedBlockId ? (
                <TouchableOpacity
                  onPress={() => setFocusedBlockId(null)}
                  style={[
                    styles.focusActivePill,
                    { backgroundColor: `${coverColor}18`, borderColor: `${coverColor}45` },
                  ]}
                >
                  <Feather name="eye" size={12} color={coverColor} />
                  <Text style={[styles.focusActiveText, { color: coverColor }]}>
                    Paragraph Spotlight Active  •  Tap to clear
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.focusHintText, { color: palette.mutedInk }]}>
                  Tip: Tap any paragraph to spotlight your current reading position
                </Text>
              )}
            </View>
          </View>

          {/* Structured Book Content Blocks */}
          <View style={styles.blocksContainer}>
            {blocks.map((block, idx) => {
              const isFocused = focusedBlockId === block.id;
              const isDimmed = focusedBlockId !== null && !isFocused;

              if (block.type === 'divider') {
                return (
                  <View
                    key={block.id}
                    style={[styles.dividerWrap, isDimmed && styles.dimmedBlock]}
                  >
                    <View style={[styles.dividerLine, { backgroundColor: palette.rule }]} />
                    <Text style={[styles.dividerOrnament, { color: palette.mutedInk }]}>
                      {block.text}
                    </Text>
                    <View style={[styles.dividerLine, { backgroundColor: palette.rule }]} />
                  </View>
                );
              }

              if (block.type === 'heading') {
                return (
                  <View
                    key={block.id}
                    style={[
                      styles.headingWrap,
                      { borderBottomColor: palette.rule },
                      isDimmed && styles.dimmedBlock,
                    ]}
                  >
                    <Text
                      style={[
                        styles.headingText,
                        {
                          color: palette.ink,
                          fontSize: Math.round(fontSize * 1.28),
                          lineHeight: Math.round(fontSize * 1.65),
                        },
                      ]}
                    >
                      {block.text}
                    </Text>
                  </View>
                );
              }

              if (block.type === 'subheading') {
                return (
                  <View
                    key={block.id}
                    style={[
                      styles.subheadingWrap,
                      { borderLeftColor: coverColor },
                      isDimmed && styles.dimmedBlock,
                    ]}
                  >
                    <Text
                      style={[
                        styles.subheadingText,
                        {
                          color: palette.ink,
                          fontSize: Math.round(fontSize * 1.12),
                          lineHeight: Math.round(fontSize * 1.5),
                        },
                      ]}
                    >
                      {block.text}
                    </Text>
                  </View>
                );
              }

              if (block.type === 'callout') {
                const { accent, icon } = getCalloutAccent(block.calloutKind, coverColor);
                return (
                  <Pressable
                    key={block.id}
                    onPress={() => handleToggleFocus(block.id)}
                    style={[
                      styles.calloutBox,
                      {
                        backgroundColor: isFocused ? palette.spotlightBg : palette.calloutBg,
                        borderColor: isFocused ? accent : palette.border,
                        borderLeftColor: accent,
                      },
                      isDimmed && styles.dimmedBlock,
                    ]}
                  >
                    <View style={styles.calloutHeader}>
                      <View
                        style={[
                          styles.calloutBadge,
                          { backgroundColor: `${accent}18`, borderColor: `${accent}40` },
                        ]}
                      >
                        <Feather name={icon} size={11} color={accent} />
                        <Text style={[styles.calloutLabel, { color: accent }]}>
                          {block.label || 'KEY NOTE'}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.calloutBodyText,
                        {
                          color: palette.ink,
                          fontSize,
                          lineHeight,
                          fontFamily: bodyFont,
                        },
                      ]}
                    >
                      {block.text}
                    </Text>
                  </Pressable>
                );
              }

              if (block.type === 'quote') {
                return (
                  <Pressable
                    key={block.id}
                    onPress={() => handleToggleFocus(block.id)}
                    style={[
                      styles.quoteBox,
                      {
                        borderLeftColor: coverColor,
                        backgroundColor: isFocused ? palette.spotlightBg : `${coverColor}08`,
                      },
                      isDimmed && styles.dimmedBlock,
                    ]}
                  >
                    <Text
                      style={[
                        styles.quoteBodyText,
                        {
                          color: palette.secondaryInk,
                          fontSize,
                          lineHeight,
                          fontFamily: italicBodyFont,
                        },
                      ]}
                    >
                      “{block.text}”
                    </Text>
                    {block.attribution && (
                      <Text style={[styles.quoteAttribution, { color: palette.mutedInk }]}>
                        — {block.attribution}
                      </Text>
                    )}
                  </Pressable>
                );
              }

              if (block.type === 'list-item') {
                return (
                  <Pressable
                    key={block.id}
                    onPress={() => handleToggleFocus(block.id)}
                    style={[
                      styles.listItemRow,
                      {
                        backgroundColor: isFocused ? palette.spotlightBg : 'transparent',
                        borderColor: isFocused ? `${coverColor}50` : 'transparent',
                      },
                      isDimmed && styles.dimmedBlock,
                    ]}
                  >
                    <View
                      style={[
                        styles.listMarkerBadge,
                        { backgroundColor: `${coverColor}16` },
                      ]}
                    >
                      <Text style={[styles.listMarkerText, { color: coverColor }]}>
                        {block.marker || '•'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.listItemText,
                        {
                          color: palette.ink,
                          fontSize,
                          lineHeight,
                          fontFamily: bodyFont,
                        },
                      ]}
                    >
                      {block.text}
                    </Text>
                  </Pressable>
                );
              }

              // Standard Book Paragraph ('paragraph')
              const paraNum = block.paragraphNumber ?? idx + 1;
              const isFirstProse = Boolean(block.isOpeningParagraph);
              const nextBlock = blocks[idx + 1];
              const showBottomSeparation =
                nextBlock &&
                nextBlock.type === 'paragraph';

              // Separated Editorial Card Mode
              if (layoutMode === 'separated') {
                return (
                  <Pressable
                    key={block.id}
                    onPress={() => handleToggleFocus(block.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Paragraph ${paraNum}`}
                    style={[
                      styles.separatedParaCard,
                      {
                        backgroundColor: isFocused ? palette.spotlightBg : palette.calloutBg,
                        borderColor: isFocused ? coverColor : palette.border,
                        borderLeftColor: isFocused ? coverColor : `${coverColor}75`,
                      },
                      isDimmed && styles.dimmedBlock,
                    ]}
                  >
                    <View style={styles.separatedParaHeader}>
                      <Text style={[styles.separatedParaBadge, { color: coverColor }]}>
                        PARAGRAPH {String(paraNum).padStart(2, '0')}
                      </Text>
                      {isFocused && (
                        <Text style={[styles.focusedTag, { color: coverColor }]}>
                          ● Reading Focus
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.paragraphText,
                        {
                          color: palette.ink,
                          fontSize,
                          lineHeight,
                          fontFamily: bodyFont,
                        },
                      ]}
                    >
                      {block.text}
                    </Text>
                  </Pressable>
                );
              }

              // Classic Book Mode (with Drop Cap on opening paragraph, book indentation,
              // paragraph margin numeral ¶, and subtle inter-paragraph separation)
              const prevBlock = idx > 0 ? blocks[idx - 1] : null;
              const isAfterHeadingOrBreak =
                prevBlock !== null &&
                (prevBlock.type === 'heading' ||
                  prevBlock.type === 'subheading' ||
                  prevBlock.type === 'divider');
              const leadIn = isFirstProse ? extractParagraphLeadIn(block.text) : null;
              const useDropCap = Boolean(leadIn && leadIn.dropCap);
              const firstLineIndent = !isFirstProse && !isAfterHeadingOrBreak ? '\u2003\u2003' : '';

              return (
                <Pressable
                  key={block.id}
                  onPress={() => handleToggleFocus(block.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Paragraph ${paraNum}`}
                  style={[
                    styles.classicParaWrap,
                    showBottomSeparation && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: palette.rule,
                      paddingBottom: 18,
                      marginBottom: 18,
                    },
                    isFocused && [
                      styles.classicParaFocused,
                      {
                        backgroundColor: palette.spotlightBg,
                        borderLeftColor: coverColor,
                      },
                    ],
                    isDimmed && styles.dimmedBlock,
                  ]}
                >
                  {/* Top paragraph margin marker row */}
                  <View style={styles.paraMarginRow}>
                    <Text
                      style={[
                        styles.paraMarginMarker,
                        { color: isFocused ? coverColor : palette.mutedInk },
                      ]}
                    >
                      ¶ {paraNum}
                    </Text>
                    {isFocused && (
                      <Text style={[styles.focusedTag, { color: coverColor }]}>
                        Focused Paragraph
                      </Text>
                    )}
                  </View>

                  {useDropCap && leadIn ? (
                    <Text
                      style={[
                        styles.paragraphText,
                        {
                          color: palette.ink,
                          fontSize,
                          lineHeight,
                          fontFamily: bodyFont,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropCapLetter,
                          {
                            color: coverColor,
                            fontSize: Math.round(fontSize * 1.65),
                            lineHeight: Math.round(lineHeight * 1.05),
                          },
                        ]}
                      >
                        {leadIn.dropCap}
                      </Text>
                      <Text
                        style={{
                          fontFamily: boldBodyFont,
                          letterSpacing: 0.35,
                        }}
                      >
                        {leadIn.leadWords}
                      </Text>
                      {leadIn.rest}
                    </Text>
                  ) : (
                    <Text
                      style={[
                        styles.paragraphText,
                        {
                          color: palette.ink,
                          fontSize,
                          lineHeight,
                          fontFamily: bodyFont,
                        },
                      ]}
                    >
                      {firstLineIndent}
                      {block.text}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Classic Book Page Folio Footer */}
          <View style={[styles.pageFolioFooter, { borderTopColor: palette.rule }]}>
            <View style={styles.folioRow}>
              <View style={[styles.folioTick, { backgroundColor: palette.rule }]} />
              <Text style={[styles.folioPageText, { color: palette.mutedInk }]}>
                —  {pageFolioText}  —
              </Text>
              <View style={[styles.folioTick, { backgroundColor: palette.rule }]} />
            </View>
          </View>
        </View>
      </View>

      {/* Stacked Physical Book Page Edges underneath */}
      <View
        pointerEvents="none"
        style={[
          styles.pageStackLayer1,
          {
            backgroundColor: palette.pageStack1,
            borderColor: palette.border,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.pageStackLayer2,
          {
            backgroundColor: palette.pageStack2,
            borderColor: palette.border,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outerBookWrap: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    marginBottom: 24,
  },
  bookPageSheet: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#2A1E10',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 5,
  },
  spineGutter: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  pageInner: {
    paddingLeft: 26,
    paddingRight: 22,
    paddingTop: 18,
    paddingBottom: 22,
  },
  runningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  runningHeaderLeft: {
    fontSize: 10.5,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  runningHeaderRight: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: 'Newsreader_400Regular_Italic',
    fontStyle: 'italic',
    textAlign: 'right',
  },
  simplifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 18,
    gap: 10,
  },
  simplifiedBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
  },
  simplifiedBannerTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  simplifiedRestoreBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  simplifiedRestoreText: {
    fontSize: 11.5,
    fontFamily: 'Inter_600SemiBold',
  },
  chapterPlate: {
    alignItems: 'center',
    marginBottom: 22,
  },
  sectionNumeralPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 6,
  },
  sectionNumeralText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
  },
  chapterMetaText: {
    fontSize: 12,
    fontFamily: 'Newsreader_400Regular_Italic',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  ornamentalRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '65%',
    gap: 10,
    marginBottom: 10,
  },
  ornamentalLine: {
    flex: 1,
    height: 1,
  },
  ornamentalGlyph: {
    fontSize: 13,
  },
  focusHintRow: {
    alignItems: 'center',
    marginTop: 2,
  },
  focusHintText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    opacity: 0.85,
  },
  focusActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  focusActiveText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  blocksContainer: {
    gap: 4,
  },
  dimmedBlock: {
    opacity: 0.52,
  },
  headingWrap: {
    marginTop: 12,
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headingText: {
    fontFamily: 'Newsreader_700Bold',
    letterSpacing: 0.3,
  },
  subheadingWrap: {
    marginTop: 14,
    marginBottom: 12,
    paddingLeft: 12,
    borderLeftWidth: 3,
  },
  subheadingText: {
    fontFamily: 'Newsreader_700Bold',
    letterSpacing: 0.15,
  },
  calloutBox: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginVertical: 10,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  calloutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  calloutLabel: {
    fontSize: 10.5,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
  },
  calloutBodyText: {
    letterSpacing: 0.1,
  },
  quoteBox: {
    borderLeftWidth: 3,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 12,
    marginVertical: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  quoteBodyText: {
    letterSpacing: 0.15,
    fontStyle: 'italic',
  },
  quoteAttribution: {
    fontSize: 12.5,
    fontFamily: 'Inter_500Medium',
    marginTop: 6,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 2,
  },
  listMarkerBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginTop: 2,
  },
  listMarkerText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  listItemText: {
    flex: 1,
    letterSpacing: 0.1,
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    paddingHorizontal: 28,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerOrnament: {
    fontSize: 12,
    letterSpacing: 3,
  },
  classicParaWrap: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
    marginBottom: 14,
  },
  classicParaFocused: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 10,
  },
  paraMarginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  paraMarginMarker: {
    fontSize: 10.5,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
    opacity: 0.65,
  },
  focusedTag: {
    fontSize: 10.5,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.4,
  },
  dropCapLetter: {
    fontFamily: 'Newsreader_700Bold',
  },
  paragraphText: {
    letterSpacing: 0.12,
  },
  separatedParaCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  separatedParaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  separatedParaBadge: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.2,
  },
  pageFolioFooter: {
    marginTop: 22,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  folioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  folioTick: {
    width: 24,
    height: 1,
  },
  folioPageText: {
    fontSize: 12,
    fontFamily: 'Newsreader_400Regular_Italic',
    fontStyle: 'italic',
    letterSpacing: 0.6,
  },
  pageStackLayer1: {
    height: 6,
    marginHorizontal: 10,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1,
    borderTopWidth: 0,
  },
  pageStackLayer2: {
    height: 5,
    marginHorizontal: 22,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderTopWidth: 0,
  },
});
