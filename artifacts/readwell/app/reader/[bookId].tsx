import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';

export default function ReaderScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getBookById, updateBook } = useApp();
  const book = getBookById(bookId ?? '');

  const [showFinishCard, setShowFinishCard] = useState(false);
  const [sessionStart] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const finishAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionStart]);

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

  const segmentIndex = book.currentSegmentIndex;
  const segment = book.segments[segmentIndex];
  const totalSegments = book.segments.length;
  const progressFraction = totalSegments > 0 ? segmentIndex / totalSegments : 0;

  if (!segment) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.foreground }]}>You've finished this book!</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
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

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.bookTitle, { color: colors.foreground }]} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={[styles.segmentInfo, { color: colors.mutedForeground }]}>
            Segment {segmentIndex + 1} of {totalSegments}
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

      {/* Reading content */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.segmentTag, { backgroundColor: `${book.coverColor}15`, borderColor: `${book.coverColor}30` }]}>
          <View style={[styles.segmentDot, { backgroundColor: book.coverColor }]} />
          <Text style={[styles.segmentTagText, { color: book.coverColor }]}>
            Segment {segmentIndex + 1}  •  {segment.paragraphs.length} paragraph{segment.paragraphs.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {segment.paragraphs.map((para, i) => (
          <Text key={i} style={[styles.paragraph, { color: colors.foreground }]}>
            {para}
          </Text>
        ))}

        {/* End of segment */}
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
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 0,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  bookTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', maxWidth: 200, textAlign: 'center' },
  segmentInfo: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  timer: { fontSize: 13, fontFamily: 'Inter_500Medium', minWidth: 42, textAlign: 'right' },
  progressTrack: { height: 3, width: '100%' },
  progressFill: { height: 3 },
  content: { paddingHorizontal: 22, paddingTop: 24, gap: 0 },
  segmentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 28,
    gap: 6,
  },
  segmentDot: { width: 7, height: 7, borderRadius: 3.5 },
  segmentTagText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  paragraph: {
    fontSize: 17,
    lineHeight: 30,
    fontFamily: 'Inter_400Regular',
    marginBottom: 22,
    letterSpacing: 0.1,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
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
  quizCardHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5E5',
    marginBottom: 8,
  },
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
});
