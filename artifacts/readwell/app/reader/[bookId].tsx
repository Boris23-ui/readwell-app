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
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/CloudAppContext';
import PdfReader from '@/components/PdfReader';
import { CoachChatView } from '@/components/CoachChatView';
import { simplifyText } from '@/utils/api';

export default function ReaderScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getBookById, updateBook, consumeToken } = useApp();
  const book = getBookById(bookId ?? '');

  const [showFinishCard, setShowFinishCard] = useState(false);
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [isSimplifying, setIsSimplifying] = useState(false);
  const [simplifiedText, setSimplifiedText] = useState<string | null>(null);
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

  if (book.sourceType === 'pdf' && book.pages && book.pages.length > 0) {
    return <PdfReader book={book} />;
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

  const handleSimplify = async () => {
    if (!segment) return;
    
    if (!consumeToken()) {
      Alert.alert('Not enough tokens', 'You need at least 1 token to simplify this section.');
      return;
    }

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
    const secondsRead = Math.floor((Date.now() - sessionStart) / 1000);
    
    // We send additional metrics for the ML Insight
    const wordCount = segment?.paragraphs.join(' ').split(/\s+/).length || 200;
    
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
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerBtn}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.bookTitle, { color: colors.foreground }]} numberOfLines={1}>
            {book.title}
          </Text>
          <View style={styles.segmentBadge}>
            <Text style={[styles.segmentInfo, { color: colors.primary }]}>
              {segmentIndex + 1} / {totalSegments}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCoachModal(true);
            }}
            style={[styles.coachHeaderBtn, { backgroundColor: `${colors.primary}18` }]}
          >
            <Text style={{ fontSize: 14 }}>🦉</Text>
            <Text style={[styles.coachHeaderBtnText, { color: colors.primary }]}>Coach</Text>
          </TouchableOpacity>
          <View style={styles.headerBtn}>
            <Text style={[styles.timer, { color: colors.mutedForeground }]}>{timeStr}</Text>
          </View>
        </View>
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

        {simplifiedText ? (
          <View style={[styles.simplifiedContainer, { backgroundColor: `${book.coverColor}10` }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 }}>
              <Feather name="zap" size={16} color={book.coverColor} />
              <Text style={[styles.simplifiedHeader, { color: book.coverColor }]}>AI Simplified Version</Text>
            </View>
            <Text style={[styles.paragraph, { color: colors.foreground }]}>{simplifiedText}</Text>
            <TouchableOpacity onPress={() => setSimplifiedText(null)} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}>Return to Original</Text>
            </TouchableOpacity>
          </View>
        ) : (
          segment.paragraphs.map((para, i) => (
            <Text key={i} style={[styles.paragraph, { color: colors.foreground }]}>
              {para}
            </Text>
          ))
        )}

        {/* Simplify Button */}
        {!showFinishCard && !simplifiedText && (
          <TouchableOpacity
            onPress={handleSimplify}
            style={[styles.simplifyBtn, { borderColor: book.coverColor }]}
            activeOpacity={0.7}
            disabled={isSimplifying}
          >
            <Feather name="zap" size={16} color={book.coverColor} />
            <Text style={[styles.simplifyBtnText, { color: book.coverColor }]}>
              {isSimplifying ? 'Simplifying...' : 'Simplify Section (Cost: 1 Token)'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Ask Coach Discuss Button */}
        {!showFinishCard && (
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
              Discuss this chapter with Coach
            </Text>
          </TouchableOpacity>
        )}

        {/* End of segment */}
        {!showFinishCard && (
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
              <Text style={styles.doneBtnText}>I've finished reading</Text>
            </LinearGradient>
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  bookTitle: { fontSize: 16, fontFamily: 'Newsreader_700Bold', maxWidth: 220, textAlign: 'center' },
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
  simplifiedContainer: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  simplifiedHeader: {
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
    borderWidth: 1,
    marginBottom: 16,
  },
  simplifyBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  doneBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Newsreader_700Bold' },
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
    marginTop: 18,
  },
  coachDiscussBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
