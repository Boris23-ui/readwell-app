import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Platform,
  Alert,
  Modal,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/CloudAppContext';
import PdfReader from '@/components/PdfReader';
import { CoachChatView } from '@/components/CoachChatView';
import {
  BookPageView,
  BookLayoutMode,
  PAPER_PALETTES,
  PaperTheme,
} from '@/components/BookPageView';
import { simplifyText } from '@/utils/api';
import { splitIntoParagraphs } from '@/utils/content';

const READER_PREFS_KEY = '@readwell/reader-prefs';
const FONT_SIZES = [15, 17, 19, 22] as const;
const PAPER_THEMES: PaperTheme[] = ['paper', 'sepia', 'night'];

export default function ReaderScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompactHeader = width < 420;
  const { getBookById, updateBook } = useApp();
  const book = getBookById(bookId ?? '');

  const [showFinishCard, setShowFinishCard] = useState(false);
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [showTypographyBar, setShowTypographyBar] = useState(false);
  const [fontSizeIdx, setFontSizeIdx] = useState(1); // default 17px
  const [useSerif, setUseSerif] = useState(true); // default Newsreader serif for deep reading
  const [paperTheme, setPaperTheme] = useState<PaperTheme>('paper');
  const [layoutMode, setLayoutMode] = useState<BookLayoutMode>('classic');
  const [isSimplifying, setIsSimplifying] = useState(false);
  const [simplifiedText, setSimplifiedText] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const finishAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(READER_PREFS_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (typeof parsed.fontSizeIdx === 'number' && parsed.fontSizeIdx >= 0 && parsed.fontSizeIdx < FONT_SIZES.length) {
          setFontSizeIdx(parsed.fontSizeIdx);
        }
        if (typeof parsed.useSerif === 'boolean') {
          setUseSerif(parsed.useSerif);
        }
        if (parsed.paperTheme === 'paper' || parsed.paperTheme === 'sepia' || parsed.paperTheme === 'night') {
          setPaperTheme(parsed.paperTheme);
        }
        if (parsed.layoutMode === 'classic' || parsed.layoutMode === 'separated') {
          setLayoutMode(parsed.layoutMode);
        }
      })
      .catch(() => { });
  }, []);

  const persistReaderPrefs = (
    nextSizeIdx: number,
    nextSerif: boolean,
    nextTheme: PaperTheme = paperTheme,
    nextLayout: BookLayoutMode = layoutMode,
  ) => {
    AsyncStorage.setItem(
      READER_PREFS_KEY,
      JSON.stringify({
        fontSizeIdx: nextSizeIdx,
        useSerif: nextSerif,
        paperTheme: nextTheme,
        layoutMode: nextLayout,
      }),
    ).catch(() => { });
  };

  // Pause the reading timer automatically whenever Reader loses focus (e.g. during Quiz)
  useFocusEffect(
    useCallback(() => {
      const interval = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);
      return () => {
        clearInterval(interval);
      };
    }, []),
  );

  const activeSegmentIndex = Math.max(0, book?.currentSegmentIndex || 0);

  // Reset per-segment state whenever the user moves to a different segment
  useEffect(() => {
    setSimplifiedText(null);
    setShowFinishCard(false);
    finishAnim.setValue(0);
    elapsedRef.current = 0;
    setElapsed(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeSegmentIndex, book?.id]);

  if (!book) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.foreground }]}>Book not found.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (book.sourceType === 'pdf' && book.pages && book.pages.length > 0) {
    return <PdfReader book={book} />;
  }

  const segmentIndex = Math.max(0, book.currentSegmentIndex || 0);
  const segments = Array.isArray(book.segments) ? book.segments : [];
  const segment = segments[segmentIndex];
  const totalSegments = segments.length;
  const progressFraction = totalSegments > 0 ? segmentIndex / totalSegments : 0;

  if (!segment) {
    const handleRestartBook = async () => {
      await updateBook(book.id, { currentSegmentIndex: 0, status: 'in_progress' });
    };

    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.foreground }]}>
          {totalSegments > 0 && segmentIndex >= totalSegments ? "You've finished this book!" : "Unable to load this section."}
        </Text>
        <TouchableOpacity
          onPress={handleRestartBook}
          style={[styles.primaryBtn, { backgroundColor: colors.primary, marginBottom: 12 }]}
        >
          <Text style={styles.primaryBtnText}>Read from Beginning</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
          <Text style={[styles.backLink, { color: colors.mutedForeground }]}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showFinish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFinishCard(true);
    Animated.spring(finishAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
      stiffness: 150,
    }).start();
  };

  const hideFinish = () => {
    Animated.timing(finishAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setShowFinishCard(false);
    });
  };

  const handleSimplify = async () => {
    if (!segment || !Array.isArray(segment.paragraphs)) return;

    try {
      setIsSimplifying(true);
      const combinedText = segment.paragraphs.join(' ');
      const res = await simplifyText(combinedText, 'beginner');
      setSimplifiedText(res.text);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to simplify text.');
    } finally {
      setIsSimplifying(false);
    }
  };

  const handleTakeQuiz = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const secondsRead = elapsedRef.current;

    // We send additional metrics for the ML Insight
    const wordCount = Array.isArray(segment?.paragraphs)
      ? segment.paragraphs.join(' ').split(/\s+/).filter(Boolean).length || 200
      : 200;

    router.push({
      pathname: '/quiz/[bookId]',
      params: {
        bookId: book.id,
        segmentIndex: String(segmentIndex),
        secondsRead: String(secondsRead),
        wordCount: String(wordCount),
      },
    });
  };

  const handleSkipQuiz = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextIndex = segmentIndex + 1;
    if (nextIndex >= totalSegments) {
      await updateBook(book.id, { status: 'finished', currentSegmentIndex: nextIndex });
      router.replace({
        pathname: '/session-summary/[bookId]',
        params: {
          bookId: book.id,
          segmentIndex: String(segmentIndex),
          score: '0',
          total: '0',
          secondsRead: String(elapsedRef.current),
          skipped: 'true',
        },
      });
    } else {
      setSimplifiedText(null);
      setShowFinishCard(false);
      finishAnim.setValue(0);
      elapsedRef.current = 0;
      setElapsed(0);
      await updateBook(book.id, { currentSegmentIndex: nextIndex });
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  };

  const handlePreviousSection = async () => {
    if (segmentIndex <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prevIndex = segmentIndex - 1;
    setSimplifiedText(null);
    setShowFinishCard(false);
    finishAnim.setValue(0);
    elapsedRef.current = 0;
    setElapsed(0);
    await updateBook(book.id, { currentSegmentIndex: prevIndex });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const fontSize = FONT_SIZES[fontSizeIdx];
  const lineHeight = Math.round(fontSize * 1.72);
  const activePalette = PAPER_PALETTES[paperTheme] ?? PAPER_PALETTES.paper;

  const displayedParagraphs = useMemo(() => {
    if (simplifiedText) {
      const split = splitIntoParagraphs(simplifiedText);
      return split.length > 0 ? split : [simplifiedText];
    }
    return Array.isArray(segment.paragraphs) ? segment.paragraphs : [];
  }, [simplifiedText, segment.paragraphs]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: activePalette.canvasBg }]}>
      {/* Fixed header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: activePalette.pageBg,
            borderBottomColor: activePalette.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerBtn}
        >
          <Feather name="arrow-left" size={20} color={activePalette.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text
            style={[styles.bookTitle, { color: activePalette.ink }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {book.title}
          </Text>
          <View style={[styles.segmentBadge, { backgroundColor: `${book.coverColor}18` }]}>
            <Text style={[styles.segmentInfo, { color: book.coverColor }]}>
              Page {segmentIndex + 1} of {totalSegments}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setShowTypographyBar((v) => !v);
            }}
            accessibilityLabel="Reader typography settings"
            style={[
              styles.typeToggleBtn,
              {
                backgroundColor: showTypographyBar ? `${colors.primary}20` : activePalette.calloutBg,
                borderColor: showTypographyBar ? colors.primary : activePalette.border,
              },
            ]}
          >
            <Text style={[styles.typeToggleText, { color: showTypographyBar ? colors.primary : activePalette.ink }]}>
              Aa
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCoachModal(true);
            }}
            accessibilityLabel="Ask Reading Coach"
            style={[
              styles.coachHeaderBtn,
              isCompactHeader && styles.coachHeaderBtnCompact,
              { backgroundColor: `${colors.primary}18` },
            ]}
          >
            <Text style={{ fontSize: 13 }}>🦉</Text>
            {!isCompactHeader && (
              <Text style={[styles.coachHeaderBtnText, { color: colors.primary }]}>Coach</Text>
            )}
          </TouchableOpacity>
          <View style={styles.headerTimerWrap}>
            <Text style={[styles.timer, { color: activePalette.mutedInk }]}>{timeStr}</Text>
          </View>
        </View>
      </View>

      {/* Typography & Book Page Controls Drawer */}
      {showTypographyBar && (
        <View
          style={[
            styles.typographyDrawer,
            {
              backgroundColor: activePalette.pageBg,
              borderBottomColor: activePalette.border,
            },
          ]}
        >
          {/* Row 1: Font size & Typeface */}
          <View style={styles.typographyRow}>
            <View style={styles.typographyGroup}>
              <TouchableOpacity
                onPress={() => {
                  const next = Math.max(0, fontSizeIdx - 1);
                  setFontSizeIdx(next);
                  persistReaderPrefs(next, useSerif, paperTheme, layoutMode);
                }}
                disabled={fontSizeIdx === 0}
                style={[styles.sizeBtn, { backgroundColor: activePalette.calloutBg, opacity: fontSizeIdx === 0 ? 0.45 : 1 }]}
              >
                <Text style={[styles.sizeBtnText, { color: activePalette.ink }]}>A-</Text>
              </TouchableOpacity>
              <Text style={[styles.sizeIndicator, { color: activePalette.mutedInk }]}>{fontSize}px</Text>
              <TouchableOpacity
                onPress={() => {
                  const next = Math.min(FONT_SIZES.length - 1, fontSizeIdx + 1);
                  setFontSizeIdx(next);
                  persistReaderPrefs(next, useSerif, paperTheme, layoutMode);
                }}
                disabled={fontSizeIdx === FONT_SIZES.length - 1}
                style={[styles.sizeBtn, { backgroundColor: activePalette.calloutBg, opacity: fontSizeIdx === FONT_SIZES.length - 1 ? 0.45 : 1 }]}
              >
                <Text style={[styles.sizeBtnText, { color: activePalette.ink }]}>A+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.typographyGroup}>
              <TouchableOpacity
                onPress={() => {
                  setUseSerif(true);
                  persistReaderPrefs(fontSizeIdx, true, paperTheme, layoutMode);
                }}
                style={[
                  styles.fontPill,
                  {
                    backgroundColor: useSerif ? `${colors.primary}18` : activePalette.calloutBg,
                    borderColor: useSerif ? colors.primary : activePalette.border,
                  },
                ]}
              >
                <Text style={[styles.fontPillText, { fontFamily: 'Newsreader_600SemiBold', color: useSerif ? colors.primary : activePalette.ink }]}>
                  Book Serif
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setUseSerif(false);
                  persistReaderPrefs(fontSizeIdx, false, paperTheme, layoutMode);
                }}
                style={[
                  styles.fontPill,
                  {
                    backgroundColor: !useSerif ? `${colors.primary}18` : activePalette.calloutBg,
                    borderColor: !useSerif ? colors.primary : activePalette.border,
                  },
                ]}
              >
                <Text style={[styles.fontPillText, { fontFamily: 'Inter_600SemiBold', color: !useSerif ? colors.primary : activePalette.ink }]}>
                  Clean Sans
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Row 2: Paper Theme & Paragraph Layout Style */}
          <View style={styles.typographyRow}>
            <View style={styles.typographyGroup}>
              {PAPER_THEMES.map((themeKey) => {
                const swatch = PAPER_PALETTES[themeKey];
                const isSelected = paperTheme === themeKey;
                return (
                  <TouchableOpacity
                    key={themeKey}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPaperTheme(themeKey);
                      persistReaderPrefs(fontSizeIdx, useSerif, themeKey, layoutMode);
                    }}
                    style={[
                      styles.paperThemePill,
                      {
                        backgroundColor: swatch.pageBg,
                        borderColor: isSelected ? colors.primary : swatch.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.paperSwatchDot,
                        { backgroundColor: swatch.ink },
                      ]}
                    />
                    <Text
                      style={[
                        styles.paperThemeText,
                        { color: swatch.ink },
                      ]}
                    >
                      {swatch.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.typographyGroup}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setLayoutMode('classic');
                  persistReaderPrefs(fontSizeIdx, useSerif, paperTheme, 'classic');
                }}
                style={[
                  styles.layoutModePill,
                  {
                    backgroundColor: layoutMode === 'classic' ? `${colors.primary}18` : activePalette.calloutBg,
                    borderColor: layoutMode === 'classic' ? colors.primary : activePalette.border,
                  },
                ]}
              >
                <Feather
                  name="book-open"
                  size={12}
                  color={layoutMode === 'classic' ? colors.primary : activePalette.ink}
                />
                <Text
                  style={[
                    styles.layoutModeText,
                    { color: layoutMode === 'classic' ? colors.primary : activePalette.ink },
                  ]}
                >
                  Book Page
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setLayoutMode('separated');
                  persistReaderPrefs(fontSizeIdx, useSerif, paperTheme, 'separated');
                }}
                style={[
                  styles.layoutModePill,
                  {
                    backgroundColor: layoutMode === 'separated' ? `${colors.primary}18` : activePalette.calloutBg,
                    borderColor: layoutMode === 'separated' ? colors.primary : activePalette.border,
                  },
                ]}
              >
                <Feather
                  name="align-left"
                  size={12}
                  color={layoutMode === 'separated' ? colors.primary : activePalette.ink}
                />
                <Text
                  style={[
                    styles.layoutModeText,
                    { color: layoutMode === 'separated' ? colors.primary : activePalette.ink },
                  ]}
                >
                  Cards
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: activePalette.border }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: book.coverColor, width: `${progressFraction * 100}%` as any },
          ]}
        />
      </View>

      {/* Reading content: Typeset Book Page View */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <BookPageView
          bookTitle={book.title}
          bookAuthor={book.author}
          coverColor={book.coverColor}
          segmentIndex={segmentIndex}
          totalSegments={totalSegments}
          paragraphs={displayedParagraphs}
          fontSize={fontSize}
          lineHeight={lineHeight}
          useSerif={useSerif}
          paperTheme={paperTheme}
          layoutMode={layoutMode}
          isSimplified={Boolean(simplifiedText)}
          onExitSimplified={() => setSimplifiedText(null)}
        />

        {/* End-of-section actions with balanced vertical rhythm */}
        {!showFinishCard && (
          <View style={styles.readerActions}>
            <View style={styles.secondaryActionRow}>
              {segmentIndex > 0 && (
                <TouchableOpacity
                  onPress={handlePreviousSection}
                  style={[
                    styles.prevPageBtn,
                    {
                      backgroundColor: activePalette.pageBg,
                      borderColor: activePalette.border,
                    },
                  ]}
                  activeOpacity={0.75}
                >
                  <Feather name="chevron-left" size={16} color={activePalette.ink} />
                  <Text style={[styles.prevPageBtnText, { color: activePalette.ink }]}>
                    Previous Page
                  </Text>
                </TouchableOpacity>
              )}

              {!simplifiedText && (
                <TouchableOpacity
                  onPress={handleSimplify}
                  style={[
                    styles.simplifyBtn,
                    {
                      flex: 1,
                      borderColor: book.coverColor,
                      backgroundColor: activePalette.pageBg,
                    },
                  ]}
                  activeOpacity={0.7}
                  disabled={isSimplifying}
                >
                  <Feather name="zap" size={15} color={book.coverColor} />
                  <Text style={[styles.simplifyBtnText, { color: book.coverColor }]}>
                    {isSimplifying ? 'Simplifying...' : 'Simplify Section'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCoachModal(true);
              }}
              style={[
                styles.coachDiscussBtn,
                {
                  borderColor: book.coverColor,
                  backgroundColor: activePalette.pageBg,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>🦉</Text>
              <Text style={[styles.coachDiscussBtnText, { color: book.coverColor }]}>
                Discuss this chapter with Coach
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={showFinish}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[book.coverColor, book.coverColor + 'CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.doneBtn}
              >
                <Feather name="check-circle" size={20} color="#FFF" />
                <Text style={styles.doneBtnText}>I've finished reading this page</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Dimmed scrim behind Quick Check sheet */}
      {showFinishCard && (
        <Pressable
          onPress={hideFinish}
          accessibilityLabel="Dismiss quick check sheet"
          style={styles.sheetBackdrop}
        />
      )}

      {/* Quiz prompt card */}
      {showFinishCard && (
        <Animated.View
          style={[
            styles.quizCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: botPad + 16,
              transform: [
                {
                  translateY: finishAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [200, 0],
                  }),
                },
              ],
              opacity: finishAnim,
            },
          ]}
        >
          <View style={styles.quizCardHandle} />
          <View style={[styles.quizIconCircle, { backgroundColor: `${book.coverColor}20` }]}>
            <Feather name="help-circle" size={26} color={book.coverColor} />
          </View>
          <Text style={[styles.quizCardTitle, { color: colors.foreground }]}>
            Quick check!
          </Text>
          <Text style={[styles.quizCardSub, { color: colors.mutedForeground }]}>
            5 short questions about what you just read. Earns you XP and builds your comprehension score.
          </Text>
          <TouchableOpacity
            onPress={handleTakeQuiz}
            style={[styles.quizBtn, { backgroundColor: book.coverColor }]}
            activeOpacity={0.85}
          >
            <Text style={styles.quizBtnText}>Take Quiz</Text>
            <Feather name="arrow-right" size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkipQuiz} style={styles.skipBtn}>
            <Text style={[styles.skipBtnText, { color: colors.mutedForeground }]}>
              {segmentIndex + 1 >= totalSegments ? 'Skip & finish' : 'Skip & continue'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Coach Chat Sheet Modal */}
      <Modal
        visible={showCoachModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCoachModal(false)}
      >
        <CoachChatView
          isModal
          onClose={() => setShowCoachModal(false)}
          initialBookContext={{
            bookId: book.id,
            title: book.title,
            author: book.author,
            chapter: segmentIndex + 1,
            totalChapters: totalSegments,
            segmentText: segment?.paragraphs?.join('\n\n')?.slice(0, 1500),
          }}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  errorText: { fontSize: 17, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  backLink: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  primaryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  bookTitle: { fontSize: 15.5, fontFamily: 'Newsreader_700Bold', maxWidth: '100%', textAlign: 'center' },
  segmentBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  segmentInfo: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  timer: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'right' },
  progressTrack: { height: 4, width: '100%' },
  progressFill: { height: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  content: { paddingHorizontal: 14, paddingTop: 18, gap: 0 },
  readerActions: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    gap: 12,
    marginTop: 4,
  },
  secondaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prevPageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  prevPageBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  simplifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  simplifyBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  doneBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Newsreader_700Bold' },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 10,
  },
  quizCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 11,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    paddingTop: 16,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 12,
  },
  quizCardHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5E5',
    marginBottom: 8,
  },
  quizIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  quizCardTitle: { fontSize: 20, fontFamily: 'Newsreader_700Bold' },
  quizCardSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  quizBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    justifyContent: 'center',
    marginTop: 6,
  },
  quizBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  skipBtn: { paddingVertical: 10 },
  skipBtnText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  coachHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  coachHeaderBtnCompact: {
    paddingHorizontal: 8,
  },
  coachHeaderBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  coachDiscussBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
  },
  coachDiscussBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  typeToggleBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeToggleText: {
    fontSize: 12.5,
    fontFamily: 'Newsreader_700Bold',
  },
  headerTimerWrap: {
    minWidth: 38,
    alignItems: 'flex-end',
  },
  typographyDrawer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  typographyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  typographyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sizeBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sizeBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  sizeIndicator: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    minWidth: 34,
    textAlign: 'center',
  },
  fontPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  fontPillText: {
    fontSize: 12.5,
  },
  paperThemePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  paperSwatchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  paperThemeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  layoutModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  layoutModeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
