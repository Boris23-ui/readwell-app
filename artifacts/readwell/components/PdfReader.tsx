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
  Modal,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeInUp,
  Layout
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/CloudAppContext';
import { Book } from '@/types';
import { resolveStorageUrl } from '@/utils/api';
import { CoachChatView } from './CoachChatView';
import {
  BookPageView,
  BookLayoutMode,
  PAPER_PALETTES,
  PaperTheme,
} from './BookPageView';

const DEFAULT_ASPECT = 0.7727; // A4 portrait width/height fallback
const READER_PREFS_KEY = '@readwell/reader-prefs';
const FONT_SIZES = [15, 17, 19, 22] as const;
const PAPER_THEMES: PaperTheme[] = ['paper', 'sepia', 'night'];

// ─── Fullscreen pinch/pan zoom overlay ──────────────────────────────────────

function ZoomOverlay({
  uri,
  aspect,
  onClose,
}: {
  uri: string;
  aspect: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 5));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate(e => {
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const imgW = width;
  const imgH = width / aspect;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlayRoot}>
        <View style={styles.overlayBg}>
          <GestureDetector gesture={composed}>
            <Reanimated.View style={[{ width, height, justifyContent: 'center' }, animatedStyle]}>
              <Image
                source={{ uri }}
                style={{ width: imgW, height: imgH }}
                contentFit="contain"
              />
            </Reanimated.View>
          </GestureDetector>
          <TouchableOpacity
            onPress={onClose}
            style={styles.overlayClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="x" size={26} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.overlayHint}>
            <Text style={styles.overlayHintText}>Pinch or double-tap to zoom</Text>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ─── PDF Reader Screen ───────────────────────────────────────────────────────

export default function PdfReader({ book }: { book: Book }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { updateBook } = useApp();
  const { width } = useWindowDimensions();
  const isCompactHeader = width < 420;

  const [showFinishCard, setShowFinishCard] = useState(false);
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [showTypographyBar, setShowTypographyBar] = useState(false);
  const [fontSizeIdx, setFontSizeIdx] = useState(1);
  const [useSerif, setUseSerif] = useState(true);
  const [paperTheme, setPaperTheme] = useState<PaperTheme>('paper');
  const [layoutMode, setLayoutMode] = useState<BookLayoutMode>('classic');
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const [zoomPage, setZoomPage] = useState<{ uri: string; aspect: number } | null>(null);
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());
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
      .catch(() => {});
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
    ).catch(() => {});
  };

  const segmentIndex = Math.max(0, book.currentSegmentIndex || 0);
  const segments = Array.isArray(book.segments) ? book.segments : [];
  const segment = segments[segmentIndex];
  const totalSegments = segments.length;
  const allPages = Array.isArray(book.pages) ? book.pages : [];
  const totalPages = allPages.length;

  const sectionPages = segment
    ? allPages.filter(
        p =>
          p.pageNumber >= (segment.pageStart ?? 1) &&
          p.pageNumber <= (segment.pageEnd ?? totalPages),
      )
    : [];
  const lowConfidencePageCount = sectionPages.filter(page => page.lowConfidence === true).length;
  const sectionHasLowConfidencePages = lowConfidencePageCount > 0;
  const sectionHasOnlyLowConfidencePages =
    sectionHasLowConfidencePages && lowConfidencePageCount === sectionPages.length;

  const [visiblePage, setVisiblePage] = useState(segment?.pageStart ?? 1);

  const sectionParagraphs = useMemo(() => {
    const fromPages = sectionPages
      .map(p => p.text?.trim())
      .filter((t): t is string => Boolean(t && t.length > 0));
    if (fromPages.length > 0) return fromPages;
    return Array.isArray(segment?.paragraphs)
      ? segment.paragraphs.filter(p => p && p.trim().length > 0)
      : [];
  }, [sectionPages, segment?.paragraphs]);

  const hasReadableSectionText = useMemo(() => {
    const wordCount = sectionParagraphs.join(' ').trim().split(/\s+/).filter(Boolean).length;
    return wordCount >= 20;
  }, [sectionParagraphs]);

  const [viewMode, setViewMode] = useState<'book' | 'scan'>('book');
  const activeViewMode = hasReadableSectionText ? viewMode : 'scan';

  // Reset the visible-page indicator & timer whenever the reader advances to a new section.
  useEffect(() => {
    setVisiblePage(segment?.pageStart ?? 1);
    setShowFinishCard(false);
    finishAnim.setValue(0);
    elapsedRef.current = 0;
    setElapsed(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [segmentIndex]);

  // Warm the disk cache for the current section so a reader can continue
  // through a brief offline period after the pages have loaded once.
  useEffect(() => {
    const sectionUris = sectionPages.map(page => resolveStorageUrl(page.imageUrl));
    if (sectionUris.length === 0) return;

    let cancelled = false;
    Promise.all(sectionUris.map(uri => Image.prefetch(uri, 'disk'))).catch(error => {
      if (!cancelled) {
        console.warn('PDF page prefetch skipped', error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [book.id, segmentIndex]);

  // Pause the reading timer automatically whenever PdfReader loses focus (e.g. during Quiz)
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
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={[styles.primaryBtnText, { color: colors.mutedForeground }]}>Back to Home</Text>
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

  const handleTakeQuiz = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const secondsRead = elapsedRef.current;
    const sectionWordCount = Array.isArray(segment?.paragraphs)
      ? segment.paragraphs.join(' ').split(/\s+/).filter(Boolean).length
      : 0;
    router.push({
      pathname: '/quiz/[bookId]',
      params: {
        bookId: book.id,
        segmentIndex: String(segmentIndex),
        secondsRead: String(secondsRead),
        wordCount: String(sectionWordCount || 200),
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
      elapsedRef.current = 0;
      setElapsed(0);
      await updateBook(book.id, { currentSegmentIndex: nextIndex });
      setShowFinishCard(false);
      finishAnim.setValue(0);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  };

  const handlePreviousSection = async () => {
    if (segmentIndex <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prevIndex = segmentIndex - 1;
    elapsedRef.current = 0;
    setElapsed(0);
    setShowFinishCard(false);
    finishAnim.setValue(0);
    await updateBook(book.id, { currentSegmentIndex: prevIndex });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (activeViewMode === 'book') return;
    // Estimate which page is at the top of the viewport within this section
    const y = e.nativeEvent.contentOffset.y;
    const imgWidth = width - 24;
    let acc = 0;
    for (const p of sectionPages) {
      const aspect = p.width && p.height ? p.width / p.height : DEFAULT_ASPECT;
      const h = imgWidth / aspect + 12; // + gap
      if (y < acc + h / 2) {
        setVisiblePage(p.pageNumber);
        return;
      }
      acc += h;
    }
    if (sectionPages.length > 0) {
      setVisiblePage(sectionPages[sectionPages.length - 1].pageNumber);
    }
  };

  const onImageError = (pageNumber: number, error: any) => {
    console.error(`PDF page ${pageNumber} failed to load`, error);
    setFailedPages(prev => new Set(prev).add(pageNumber));
  };

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const imgWidth = width - 24;
  const progressFraction = totalPages > 0 ? visiblePage / totalPages : 0;
  const fontSize = FONT_SIZES[fontSizeIdx];
  const lineHeight = Math.round(fontSize * 1.72);
  const activePalette = PAPER_PALETTES[paperTheme] ?? PAPER_PALETTES.paper;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: activeViewMode === 'book' ? activePalette.canvasBg : colors.background },
      ]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: activeViewMode === 'book' ? activePalette.pageBg : colors.background,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather
            name="arrow-left"
            size={20}
            color={activeViewMode === 'book' ? activePalette.ink : colors.foreground}
          />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text
            style={[
              styles.bookTitle,
              { color: activeViewMode === 'book' ? activePalette.ink : colors.foreground },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {book.title}
          </Text>
          <Text
            style={[
              styles.segmentInfo,
              { color: activeViewMode === 'book' ? activePalette.mutedInk : colors.mutedForeground },
            ]}
          >
            Page {visiblePage} of {totalPages}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {activeViewMode === 'book' && (
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
              <Text
                style={[
                  styles.typeToggleText,
                  { color: showTypographyBar ? colors.primary : activePalette.ink },
                ]}
              >
                Aa
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCoachModal(true);
            }}
            accessibilityLabel="Ask Reading Coach"
            style={[
              styles.coachHeaderBtn,
              isCompactHeader && { paddingHorizontal: 8 },
              { backgroundColor: `${colors.primary}18` },
            ]}
          >
            <Text style={{ fontSize: 13 }}>🦉</Text>
            {!isCompactHeader && (
              <Text style={[styles.coachHeaderBtnText, { color: colors.primary }]}>Coach</Text>
            )}
          </TouchableOpacity>
          <Text
            style={[
              styles.timer,
              { color: activeViewMode === 'book' ? activePalette.mutedInk : colors.mutedForeground },
            ]}
          >
            {timeStr}
          </Text>
        </View>
      </View>

      {/* Typography & Book Page Controls Drawer */}
      {activeViewMode === 'book' && showTypographyBar && (
        <View
          style={[
            styles.typographyDrawer,
            {
              backgroundColor: activePalette.pageBg,
              borderBottomColor: activePalette.border,
            },
          ]}
        >
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
                    <View style={[styles.paperSwatchDot, { backgroundColor: swatch.ink }]} />
                    <Text style={[styles.paperThemeText, { color: swatch.ink }]}>{swatch.label}</Text>
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
                <Feather name="book-open" size={12} color={layoutMode === 'classic' ? colors.primary : activePalette.ink} />
                <Text style={[styles.layoutModeText, { color: layoutMode === 'classic' ? colors.primary : activePalette.ink }]}>
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
                <Feather name="align-left" size={12} color={layoutMode === 'separated' ? colors.primary : activePalette.ink} />
                <Text style={[styles.layoutModeText, { color: layoutMode === 'separated' ? colors.primary : activePalette.ink }]}>
                  Cards
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: book.coverColor, width: `${progressFraction * 100}%` as any },
          ]}
        />
      </View>

      {/* Pages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 120 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
      >
        <View style={styles.topControlsRow}>
          <View style={[styles.segmentTag, { backgroundColor: `${book.coverColor}15`, borderColor: `${book.coverColor}30` }]}>
            <View style={[styles.segmentDot, { backgroundColor: book.coverColor }]} />
            <Text style={[styles.segmentTagText, { color: book.coverColor }]}>
              Section {segmentIndex + 1} of {totalSegments}  •  Pages {segment.pageStart}–{segment.pageEnd}
            </Text>
          </View>

          {hasReadableSectionText && (
            <View style={[styles.modeSwitcher, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setViewMode('book');
                }}
                style={[
                  styles.modePill,
                  activeViewMode === 'book' && { backgroundColor: colors.card },
                ]}
              >
                <Feather
                  name="book-open"
                  size={12}
                  color={activeViewMode === 'book' ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.modePillText,
                    { color: activeViewMode === 'book' ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  Book View
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setViewMode('scan');
                }}
                style={[
                  styles.modePill,
                  activeViewMode === 'scan' && { backgroundColor: colors.card },
                ]}
              >
                <Feather
                  name="file-text"
                  size={12}
                  color={activeViewMode === 'scan' ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.modePillText,
                    { color: activeViewMode === 'scan' ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  PDF Pages
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {book.ocrUsed && (
          <View style={styles.ocrBanner}>
            <Feather name="alert-triangle" size={13} color="#92400E" />
            <Text style={styles.ocrBannerText}>
              Scanned document — text was extracted via OCR and may contain errors
            </Text>
          </View>
        )}

        {activeViewMode === 'book' ? (
          <BookPageView
            bookTitle={book.title}
            bookAuthor={book.author}
            coverColor={book.coverColor}
            segmentIndex={segmentIndex}
            totalSegments={totalSegments}
            paragraphs={sectionParagraphs}
            pageRangeLabel={`${segment.pageStart ?? 1}–${segment.pageEnd ?? totalPages}`}
            fontSize={fontSize}
            lineHeight={lineHeight}
            useSerif={useSerif}
            paperTheme={paperTheme}
            layoutMode={layoutMode}
          />
        ) : (
          sectionPages.map((page, index) => {
            const aspect = page.width && page.height ? page.width / page.height : DEFAULT_ASPECT;
            const uri = resolveStorageUrl(page.imageUrl);
            return (
              <Reanimated.View 
                key={page.pageNumber} 
                entering={FadeInUp.delay(50 + index * 100).springify()}
                layout={Layout.springify()}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setZoomPage({ uri, aspect })}
                  style={styles.pageWrap}
                >
                  <Image
                    source={{ uri }}
                    style={{ width: imgWidth, height: imgWidth / aspect, borderRadius: 6, backgroundColor: colors.muted }}
                    contentFit="contain"
                    cachePolicy="disk"
                    transition={150}
                    onError={(e) => onImageError(page.pageNumber, e)}
                  />
                  {failedPages.has(page.pageNumber) && (
                    <View style={styles.imageErrorOverlay} pointerEvents="none">
                      <Feather name="image" size={20} color={colors.destructive} />
                      <Text style={[styles.imageErrorText, { color: colors.destructive }]}>Could not load page</Text>
                    </View>
                  )}
                  {page.lowConfidence && (
                    <View
                      style={[styles.lowConfidenceBadge, { backgroundColor: `${colors.honey}30`, borderColor: colors.honeyDeep }]}
                      pointerEvents="none"
                      accessibilityRole="alert"
                      accessibilityLabel="Blurry scan: quiz questions may be limited"
                    >
                      <Feather name="alert-triangle" size={12} color={colors.honeyDeep} />
                      <Text style={[styles.lowConfidenceBadgeText, { color: colors.honeyDeep }]}>
                        Blurry scan — quiz questions may be limited
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Reanimated.View>
            );
          })
        )}

        {!showFinishCard && (
          <Reanimated.View entering={FadeInUp.delay(200).springify()} style={styles.readerActions}>
            {segmentIndex > 0 && (
              <TouchableOpacity
                onPress={handlePreviousSection}
                style={[
                  styles.prevPageBtn,
                  {
                    backgroundColor: activeViewMode === 'book' ? activePalette.pageBg : colors.card,
                    borderColor: activeViewMode === 'book' ? activePalette.border : colors.border,
                  },
                ]}
                activeOpacity={0.75}
              >
                <Feather
                  name="chevron-left"
                  size={16}
                  color={activeViewMode === 'book' ? activePalette.ink : colors.foreground}
                />
                <Text
                  style={[
                    styles.prevPageBtnText,
                    { color: activeViewMode === 'book' ? activePalette.ink : colors.foreground },
                  ]}
                >
                  Previous Section
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCoachModal(true);
              }}
              style={[styles.coachDiscussBtn, { borderColor: book.coverColor, backgroundColor: `${book.coverColor}12` }]}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>🦉</Text>
              <Text style={[styles.coachDiscussBtnText, { color: book.coverColor }]}>
                Discuss this section with Coach
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={showFinish}
              style={[styles.doneBtn, { backgroundColor: book.coverColor }]}
              activeOpacity={0.85}
            >
              <Feather name="check" size={18} color="#FFF" />
              <Text style={styles.doneBtnText}>I've finished reading</Text>
            </TouchableOpacity>
          </Reanimated.View>
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
                { translateY: finishAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] }) },
              ],
              opacity: finishAnim,
            },
          ]}
        >
          <View style={styles.quizCardHandle} />
          <View style={[styles.quizIconCircle, { backgroundColor: `${book.coverColor}20` }]}>
            <Feather name="help-circle" size={26} color={book.coverColor} />
          </View>
          <Text style={[styles.quizCardTitle, { color: colors.foreground }]}>Quick check!</Text>
          <Text style={[styles.quizCardSub, { color: colors.mutedForeground }]}>
            5 short questions about what you just read. Earns you XP and builds your comprehension score.
          </Text>
          {sectionHasLowConfidencePages && (
            <View style={styles.quizQualityWarning}>
              <Feather name="alert-triangle" size={16} color="#92400E" />
              <Text style={styles.quizQualityWarningText}>
                {sectionHasOnlyLowConfidencePages
                  ? 'This section may have limited quiz questions due to scan quality.'
                  : 'Some pages in this section may limit quiz questions due to scan quality.'}
              </Text>
            </View>
          )}
          {sectionHasLowConfidencePages && (
            <TouchableOpacity
              onPress={handleSkipQuiz}
              style={styles.prominentSkipBtn}
              activeOpacity={0.85}
            >
              <Feather name="skip-forward" size={18} color="#92400E" />
              <Text style={styles.prominentSkipBtnText}>
                {segmentIndex + 1 >= totalSegments ? 'Skip quiz & finish' : 'Skip quiz & continue'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleTakeQuiz}
            style={[
              styles.quizBtn,
              sectionHasLowConfidencePages
                ? { backgroundColor: colors.card, borderColor: book.coverColor, borderWidth: 1 }
                : { backgroundColor: book.coverColor },
            ]}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.quizBtnText,
                sectionHasLowConfidencePages && { color: book.coverColor },
              ]}
            >
              Take Quiz
            </Text>
            <Feather
              name="arrow-right"
              size={18}
              color={sectionHasLowConfidencePages ? book.coverColor : '#FFF'}
            />
          </TouchableOpacity>
          {!sectionHasLowConfidencePages && (
            <TouchableOpacity onPress={handleSkipQuiz} style={styles.skipBtn}>
              <Text style={[styles.skipBtnText, { color: colors.mutedForeground }]}>
                {segmentIndex + 1 >= totalSegments ? 'Skip & finish' : 'Skip & continue'}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {zoomPage && (
        <ZoomOverlay uri={zoomPage.uri} aspect={zoomPage.aspect} onClose={() => setZoomPage(null)} />
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
            chapter: visiblePage,
            totalChapters: totalSegments,
            segmentText: (() => {
              const currentPageText =
                sectionPages.find((p) => p.pageNumber === visiblePage)?.text?.trim() || '';
              const sectionText = segment?.paragraphs?.join('\n\n')?.trim() || '';
              const combined = currentPageText.length >= 60 ? currentPageText : sectionText;
              return combined ? combined.slice(0, 1500) : `Page ${visiblePage} of ${book.title}`;
            })(),
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
  primaryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  headerCenter: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 4 },
  bookTitle: { fontSize: 15, fontFamily: 'Newsreader_700Bold', maxWidth: '100%', textAlign: 'center' },
  segmentInfo: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  timer: { fontSize: 13, fontFamily: 'Inter_500Medium', minWidth: 42, textAlign: 'right' },
  progressTrack: { height: 3, width: '100%' },
  progressFill: { height: 3 },
  content: { paddingHorizontal: 12, paddingTop: 16, gap: 12 },
  topControlsRow: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  segmentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
  },
  segmentDot: { width: 7, height: 7, borderRadius: 3.5 },
  segmentTagText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  modeSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
  },
  modePillText: {
    fontSize: 11.5,
    fontFamily: 'Inter_600SemiBold',
  },
  pageWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    position: 'relative',
  },
  readerActions: {
    gap: 12,
    marginTop: 8,
    marginHorizontal: 10,
  },
  coachDiscussBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
  },
  coachDiscussBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  doneBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
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
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  quizCardHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E5E5', marginBottom: 8 },
  quizIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  quizCardTitle: { fontSize: 20, fontFamily: 'Newsreader_700Bold' },
  quizCardSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  quizQualityWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
  },
  quizQualityWarningText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
  },
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
  prominentSkipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
  },
  prominentSkipBtnText: { color: '#92400E', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  skipBtn: { paddingVertical: 10 },
  skipBtnText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  overlayRoot: { flex: 1 },
  overlayBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  overlayClose: { position: 'absolute', top: 50, right: 20 },
  overlayHint: { position: 'absolute', bottom: 50, alignSelf: 'center' },
  overlayHintText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  ocrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  ocrBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#92400E',
    lineHeight: 17,
  },
  lowConfidenceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(254, 243, 199, 0.92)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
  },
  lowConfidenceBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#92400E',
  },
  imageErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 6,
    gap: 6,
  },
  imageErrorText: {
    fontSize: 13,
  },
  coachHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  coachHeaderBtnText: {
    fontSize: 12,
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
  prevPageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  prevPageBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
