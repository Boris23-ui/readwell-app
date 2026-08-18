import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { generateQuiz } from '@/utils/api';
import { Question, Quiz } from '@/types';
import { calculateSessionXp } from '@/utils/xp';
import { isTextQualityTooLow } from '@/utils/content';

type QuizGenerationError = Error & { code?: string };

const RETRYABLE_QUIZ_ERROR_CODES = new Set([
  'QUIZ_RATE_LIMITED',
  'GEMINI_RATE_LIMITED',
  'GEMINI_TIMEOUT',
  'GEMINI_INVALID_RESPONSE',
  'GEMINI_UNAVAILABLE',
]);

function getQuizErrorMessage(code?: string): string {
  switch (code) {
    case 'TEXT_TOO_LONG':
      return 'This reading section is too long for a quiz. Try a shorter section.';
    case 'QUIZ_RATE_LIMITED':
    case 'GEMINI_RATE_LIMITED':
      return 'Quiz generation is busy right now. Please wait a moment and try again.';
    case 'GEMINI_TIMEOUT':
      return 'Quiz generation took too long. Check your connection and try again.';
    case 'GEMINI_AUTH_ERROR':
    case 'GEMINI_NOT_CONFIGURED':
      return 'The quiz service needs to be configured. Please try again later.';
    case 'GEMINI_MODEL_UNAVAILABLE':
      return 'The quiz model is temporarily unavailable. Please try again later.';
    case 'GEMINI_INVALID_RESPONSE':
      return 'The AI returned an unusable quiz. Please try again.';
    default:
      return 'Could not generate quiz. Please try again.';
  }
}

export default function QuizScreen() {
  const params = useLocalSearchParams<{
    bookId: string;
    segmentIndex: string;
    secondsRead: string;
  }>();
  const { bookId, segmentIndex: segIdxStr, secondsRead: secondsStr } = params;
  const segmentIndex = parseInt(segIdxStr ?? '0', 10);
  const secondsRead = parseInt(secondsStr ?? '0', 10);

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getBookById, profile } = useApp();
  const book = getBookById(bookId ?? '');

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadErrorCode, setLoadErrorCode] = useState<string>();
  const [retryNonce, setRetryNonce] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | string | null)[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [slideAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (!book) return;
    const segment = book.segments[segmentIndex];
    if (!segment) return;

    // Check if quiz is already cached
    if (segment.quiz) {
      setQuiz(segment.quiz);
      setAnswers(new Array(segment.quiz.questions.length).fill(null));
      setLoading(false);
      return;
    }

    // Generate quiz
    const segmentText = segment.paragraphs.join('\n\n');

    // Guard against garbled OCR text before hitting the API
    if (isTextQualityTooLow(segmentText)) {
      setLoadError('Text quality too low to generate a useful quiz for this section. The scanned text may be too garbled or short.');
      setLoadErrorCode('TEXT_TOO_SHORT');
      setLoading(false);
      return;
    }

    generateQuiz(segmentText, profile.readingLevel ?? 'intermediate')
      .then(data => {
        const q: Quiz = { questions: data.questions };
        setQuiz(q);
        setAnswers(new Array(data.questions.length).fill(null));
        setLoading(false);
      })
      .catch(err => {
        console.error('Quiz generation error:', err);
        const error = err as QuizGenerationError;
        if (error?.code === 'TEXT_TOO_SHORT') {
          setLoadError('Text quality too low to generate a useful quiz for this section. The scanned text may be too garbled or short.');
        } else {
          setLoadError(getQuizErrorMessage(error?.code));
        }
        setLoadErrorCode(error?.code);
        setLoading(false);
      });
  }, [book, segmentIndex, bookId, profile.readingLevel, retryNonce]);

  if (!book) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTxt, { color: colors.foreground }]}>Book not found.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.link, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Generating your quiz...
        </Text>
        <Text style={[styles.loadingSub, { color: colors.mutedForeground }]}>
          AI is reading your segment
        </Text>
      </View>
    );
  }

  if (loadError || !quiz) {
    const isQualityError = loadError.startsWith('Text quality too low');
    const isRetryableError =
      !isQualityError &&
      RETRYABLE_QUIZ_ERROR_CODES.has(loadErrorCode ?? '');
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather
          name={isQualityError ? 'alert-triangle' : 'alert-circle'}
          size={32}
          color={isQualityError ? colors.mutedForeground : colors.destructive}
        />
        <Text style={[styles.errorTxt, { color: colors.foreground }]}>
          {loadError || 'Failed to load quiz'}
        </Text>
        {isQualityError ? (
          <>
            <TouchableOpacity
              onPress={() => {
                const minutesRead = Math.floor(secondsRead / 60);
                const xpEarned = calculateSessionXp(minutesRead, 0, 0, false);
                router.replace({
                  pathname: '/session-summary/[bookId]',
                  params: {
                    bookId: book.id,
                    segmentIndex: String(segmentIndex),
                    score: '0',
                    total: '0',
                    xpEarned: String(xpEarned),
                    secondsRead: String(secondsRead),
                  },
                });
              }}
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.retryBtnText}>Skip quiz</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.link, { color: colors.mutedForeground }]}>Go back</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {isRetryableError && (
              <TouchableOpacity
                onPress={() => {
                  setQuiz(null);
                  setLoadError('');
                  setLoadErrorCode(undefined);
                  setLoading(true);
                  setRetryNonce((value) => value + 1);
                }}
                style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.retryBtnText}>Try again</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.link, { color: colors.mutedForeground }]}>Go back</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  const question = quiz.questions[currentQ];
  const totalQ = quiz.questions.length;
  const currentAnswer = answers[currentQ];
  const isLast = currentQ === totalQ - 1;

  const handleSelectOption = (idx: number) => {
    if (revealed) return;
    const newAnswers = [...answers];
    newAnswers[currentQ] = idx;
    setAnswers(newAnswers);
  };

  const handleReveal = () => {
    if (question.isOpenEnded) {
      if (!freeText.trim()) return;
      const newAnswers = [...answers];
      newAnswers[currentQ] = freeText;
      setAnswers(newAnswers);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRevealed(true);
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isLast) {
      // Calculate score
      let score = 0;
      quiz.questions.forEach((q, i) => {
        if (!q.isOpenEnded && answers[i] === q.correctIndex) score++;
      });

      const minutesRead = Math.floor(secondsRead / 60);
      const xpEarned = calculateSessionXp(minutesRead, score, totalQ - 1, false); // -1 for open-ended

      router.replace({
        pathname: '/session-summary/[bookId]',
        params: {
          bookId: book.id,
          segmentIndex: String(segmentIndex),
          score: String(score),
          total: String(totalQ),
          xpEarned: String(xpEarned),
          secondsRead: String(secondsRead),
        },
      });
      return;
    }

    // Animate to next question
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -1, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    setCurrentQ(q => q + 1);
    setRevealed(false);
    setFreeText('');
  };

  const isCorrect = !question.isOpenEnded && currentAnswer === question.correctIndex;
  const canReveal = question.isOpenEnded ? freeText.trim().length > 0 : currentAnswer !== null;

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 12;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Quiz</Text>
        <Text style={[styles.qNum, { color: colors.mutedForeground }]}>
          {currentQ + 1}/{totalQ}
        </Text>
      </View>

      {/* Progress dots */}
      <View style={styles.dots}>
        {quiz.questions.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i < currentQ
                    ? '#22C55E'
                    : i === currentQ
                    ? book.coverColor
                    : colors.muted,
              },
            ]}
          />
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ transform: [{ translateX: slideAnim as any }] }}>
          {/* Question type tag */}
          <View style={[styles.typeTag, { backgroundColor: `${book.coverColor}15` }]}>
            <Text style={[styles.typeTagText, { color: book.coverColor }]}>
              {question.type === 'recall'
                ? 'Recall'
                : question.type === 'vocabulary'
                ? 'Vocabulary'
                : question.type === 'inference'
                ? 'Inference'
                : 'Reflect'}
            </Text>
          </View>

          {/* Question */}
          <Text style={[styles.questionText, { color: colors.foreground }]}>
            {question.prompt}
          </Text>

          {/* MCQ options */}
          {!question.isOpenEnded && question.options && (
            <View style={styles.options}>
              {question.options.map((option, i) => {
                let bg = colors.card;
                let border = colors.border;
                let textColor = colors.foreground;

                if (revealed) {
                  if (i === question.correctIndex) {
                    bg = '#22C55E20';
                    border = '#22C55E';
                    textColor = '#22C55E';
                  } else if (i === currentAnswer && i !== question.correctIndex) {
                    bg = `${colors.destructive}15`;
                    border = colors.destructive;
                    textColor = colors.destructive;
                  }
                } else if (currentAnswer === i) {
                  bg = `${book.coverColor}15`;
                  border = book.coverColor;
                }

                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => handleSelectOption(i)}
                    style={[styles.option, { backgroundColor: bg, borderColor: border }]}
                    activeOpacity={revealed ? 1 : 0.75}
                  >
                    <View style={[styles.optionLetter, { backgroundColor: `${border}30` }]}>
                      <Text style={[styles.optionLetterText, { color: textColor }]}>
                        {String.fromCharCode(65 + i)}
                      </Text>
                    </View>
                    <Text style={[styles.optionText, { color: textColor }]}>{option}</Text>
                    {revealed && i === question.correctIndex && (
                      <Feather name="check" size={16} color="#22C55E" />
                    )}
                    {revealed && i === currentAnswer && i !== question.correctIndex && (
                      <Feather name="x" size={16} color={colors.destructive} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Free text input */}
          {question.isOpenEnded && (
            <TextInput
              style={[
                styles.freeText,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder="Type your reflection here..."
              placeholderTextColor={colors.mutedForeground}
              value={freeText}
              onChangeText={setFreeText}
              multiline
              textAlignVertical="top"
              editable={!revealed}
            />
          )}

          {/* Evidence quote */}
          {revealed && question.evidenceQuote && (
            <View style={[styles.evidenceBox, { backgroundColor: `${book.coverColor}10`, borderColor: `${book.coverColor}30` }]}>
              <Feather name="book-open" size={14} color={book.coverColor} />
              <Text style={[styles.evidenceText, { color: colors.foreground }]}>
                "{question.evidenceQuote}"
              </Text>
            </View>
          )}

          {/* Open-ended accepted confirmation */}
          {revealed && question.isOpenEnded && (
            <View style={[styles.evidenceBox, { backgroundColor: '#22C55E12', borderColor: '#22C55E40' }]}>
              <Feather name="check-circle" size={14} color="#22C55E" />
              <Text style={[styles.evidenceText, { color: colors.foreground }]}>
                Reflection recorded. There's no wrong answer here — it's about engaging with the text.
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Bottom action */}
      <View style={[styles.footer, { paddingBottom: botPad, borderTopColor: colors.border }]}>
        {!revealed ? (
          <TouchableOpacity
            onPress={handleReveal}
            disabled={!canReveal}
            style={[styles.footerBtn, { backgroundColor: canReveal ? book.coverColor : colors.muted }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.footerBtnText, { color: canReveal ? '#FFF' : colors.mutedForeground }]}>
              Check Answer
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleNext}
            style={[styles.footerBtn, { backgroundColor: book.coverColor }]}
            activeOpacity={0.85}
          >
            <Text style={styles.footerBtnText}>{isLast ? 'See Results' : 'Next Question'}</Text>
            <Feather name="arrow-right" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  errorTxt: { fontSize: 16, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  link: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  loadingText: { fontSize: 16, fontFamily: 'Inter_500Medium', marginTop: 12 },
  loadingSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  qNum: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  dots: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 24 },
  dot: { flex: 1, height: 5, borderRadius: 2.5 },
  scrollContent: { paddingHorizontal: 20, gap: 16 },
  typeTag: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, marginBottom: 8 },
  typeTagText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  questionText: { fontSize: 20, fontFamily: 'Inter_700Bold', lineHeight: 30, marginBottom: 16 },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    gap: 12,
  },
  optionLetter: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  optionText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  freeText: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 120,
    lineHeight: 22,
  },
  evidenceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  evidenceText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, fontStyle: 'italic' },
  footer: { padding: 16, borderTopWidth: 1 },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  footerBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
