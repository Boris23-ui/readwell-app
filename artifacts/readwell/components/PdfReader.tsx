import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Modal,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Book } from '@/types';
import { resolveStorageUrl } from '@/utils/api';

const DEFAULT_ASPECT = 0.7727; // A4 portrait width/height fallback

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

  const [showFinishCard, setShowFinishCard] = useState(false);
  const [sessionStart] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [zoomPage, setZoomPage] = useState<{ uri: string; aspect: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const finishAnim = useRef(new Animated.Value(0)).current;

  const segmentIndex = book.currentSegmentIndex;
  const segment = book.segments[segmentIndex];
  const totalSegments = book.segments.length;
  const allPages = book.pages ?? [];
  const totalPages = allPages.length;

  const sectionPages = segment
    ? allPages.filter(
        p =>
          p.pageNumber >= (segment.pageStart ?? 1) &&
          p.pageNumber <= (segment.pageEnd ?? totalPages),
      )
    : [];

  const [visiblePage, setVisiblePage] = useState(segment?.pageStart ?? 1);

  // Reset the visible-page indicator whenever the reader advances to a new section.
  useEffect(() => {
    setVisiblePage(segment?.pageStart ?? 1);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [segmentIndex]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionStart]);

  if (!segment) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.foreground }]}>You've finished this book!</Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.primaryBtnText}>Back to Home</Text>
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

  const handleTakeQuiz = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const secondsRead = Math.floor((Date.now() - sessionStart) / 1000);
    router.push({
      pathname: '/quiz/[bookId]',
      params: { bookId: book.id, segmentIndex: String(segmentIndex), secondsRead: String(secondsRead) },
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
          secondsRead: String(Math.floor((Date.now() - sessionStart) / 1000)),
          skipped: 'true',
        },
      });
    } else {
      await updateBook(book.id, { currentSegmentIndex: nextIndex });
      setShowFinishCard(false);
      finishAnim.setValue(0);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
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

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const imgWidth = width - 24;
  const progressFraction = totalPages > 0 ? visiblePage / totalPages : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.bookTitle, { color: colors.foreground }]} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={[styles.segmentInfo, { color: colors.mutedForeground }]}>
            Page {visiblePage} of {totalPages}
          </Text>
        </View>
        <Text style={[styles.timer, { color: colors.mutedForeground }]}>{timeStr}</Text>
      </View>

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
        <View style={[styles.segmentTag, { backgroundColor: `${book.coverColor}15`, borderColor: `${book.coverColor}30` }]}>
          <View style={[styles.segmentDot, { backgroundColor: book.coverColor }]} />
          <Text style={[styles.segmentTagText, { color: book.coverColor }]}>
            Section {segmentIndex + 1} of {totalSegments}  •  Pages {segment.pageStart}–{segment.pageEnd}
          </Text>
        </View>

        {book.ocrUsed && (
          <View style={styles.ocrBanner}>
            <Feather name="alert-triangle" size={13} color="#92400E" />
            <Text style={styles.ocrBannerText}>
              Scanned document — text was extracted via OCR and may contain errors
            </Text>
          </View>
        )}

        {sectionPages.map(page => {
          const aspect = page.width && page.height ? page.width / page.height : DEFAULT_ASPECT;
          const uri = resolveStorageUrl(page.imageUrl);
          return (
            <TouchableOpacity
              key={page.pageNumber}
              activeOpacity={0.9}
              onPress={() => setZoomPage({ uri, aspect })}
              style={styles.pageWrap}
            >
              <Image
                source={{ uri }}
                style={{ width: imgWidth, height: imgWidth / aspect, borderRadius: 6, backgroundColor: colors.muted }}
                contentFit="contain"
                transition={150}
              />
              {page.lowConfidence && (
                <View style={styles.lowConfidenceBadge} pointerEvents="none">
                  <Feather name="alert-triangle" size={12} color="#92400E" />
                  <Text style={styles.lowConfidenceBadgeText}>
                    Blurry scan — quiz questions may be limited
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {!showFinishCard && (
          <TouchableOpacity
            onPress={showFinish}
            style={[styles.doneBtn, { backgroundColor: book.coverColor }]}
            activeOpacity={0.85}
          >
            <Feather name="check" size={18} color="#FFF" />
            <Text style={styles.doneBtnText}>I've finished reading</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

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

      {zoomPage && (
        <ZoomOverlay uri={zoomPage.uri} aspect={zoomPage.aspect} onClose={() => setZoomPage(null)} />
      )}
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
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 12,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  bookTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', maxWidth: 200, textAlign: 'center' },
  segmentInfo: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  timer: { fontSize: 13, fontFamily: 'Inter_500Medium', minWidth: 42, textAlign: 'right' },
  progressTrack: { height: 3, width: '100%' },
  progressFill: { height: 3 },
  content: { paddingHorizontal: 12, paddingTop: 16, gap: 12 },
  segmentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 8,
    gap: 6,
  },
  segmentDot: { width: 7, height: 7, borderRadius: 3.5 },
  segmentTagText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  pageWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 12,
    marginHorizontal: 10,
  },
  doneBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  quizCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  quizCardTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
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
});
