import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { getDueReviews, ReviewItem, processReviewResult } from '@/utils/reviewQueue';

export function ReviewQueueCard() {
  const colors = useColors();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [activeItem, setActiveItem] = useState<ReviewItem | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    const due = await getDueReviews(3); // 3-5 items
    setItems(due);
    if (due.length > 0 && !activeItem) {
      setActiveItem(due[0]);
    } else if (due.length === 0) {
      setActiveItem(null);
    }
  };

  const handleReveal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAnswer(true);
  };

  const handleScore = async (correct: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!activeItem) return;
    
    await processReviewResult(activeItem.id, correct);
    setShowAnswer(false);
    
    // Load next item
    const due = await getDueReviews(3);
    setItems(due);
    if (due.length > 0) {
      setActiveItem(due[0]);
    } else {
      setActiveItem(null);
    }
  };

  if (items.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: `${colors.honey}66`, shadowColor: colors.shadow }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name="refresh-cw" size={16} color={colors.honeyDeep} />
          <Text style={[styles.title, { color: colors.foreground }]}>Review Missed Questions</Text>
        </View>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>{items.length} due</Text>
      </View>

      {activeItem && (
        <View style={styles.cardContent}>
          <Text style={[styles.bookTitle, { color: colors.primary }]}>{activeItem.bookTitle}</Text>
          <Text style={[styles.prompt, { color: colors.foreground }]}>{activeItem.question.prompt}</Text>
          
          {showAnswer ? (
            <View style={{ gap: 16 }}>
              <View style={[styles.answerBox, { backgroundColor: `${colors.sage}15`, borderColor: `${colors.sageDeep}40` }]}>
                <Text style={[styles.correctAnswerLabel, { color: colors.sageDeep }]}>Correct Answer</Text>
                <Text style={[styles.correctAnswerText, { color: colors.foreground }]}>
                  {activeItem.question.options?.[activeItem.question.correctIndex!]}
                </Text>
              </View>

              {activeItem.question.evidenceQuote && (
                <View style={[styles.answerBox, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30` }]}>
                  <Text style={[styles.correctAnswerLabel, { color: colors.primary }]}>Original Evidence</Text>
                  <Text style={[styles.evidenceText, { color: colors.foreground }]}>
                    "{activeItem.question.evidenceQuote}"
                  </Text>
                </View>
              )}
              
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: colors.destructive }]} onPress={() => handleScore(false)}>
                  <Feather name="x" size={16} color="#FFF" />
                  <Text style={styles.btnText}>Still Missed</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: colors.sageDeep }]} onPress={() => handleScore(true)}>
                  <Feather name="check" size={16} color="#FFF" />
                  <Text style={styles.btnText}>Got It</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleReveal}
              style={[styles.revealBtn, { backgroundColor: colors.honey }]}
              activeOpacity={0.8}
            >
              <Text style={styles.revealText}>Reveal Answer</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 20,
    marginTop: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Newsreader_700Bold',
  },
  count: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  cardContent: {
    gap: 12,
  },
  bookTitle: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prompt: {
    fontSize: 18,
    fontFamily: 'Newsreader_700Bold',
    lineHeight: 24,
  },
  revealBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  revealText: {
    color: '#1F1C18',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  answerBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  correctAnswerLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  correctAnswerText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  evidenceText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  btnText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
