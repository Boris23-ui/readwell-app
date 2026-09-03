import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useCoach } from '@/context/CoachContext';
import { Flashcard } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function FlashcardDeckModal({ visible, onClose }: Props) {
  const colors = useColors();
  const { flashcards, dueFlashcards, reviewCard, addCard } = useCoach();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newType, setNewType] = useState<Flashcard['cardType']>('concept');

  const deck = dueFlashcards.length > 0 ? dueFlashcards : flashcards;
  const currentCard = deck[currentIndex];

  const handleFlip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFlipped(prev => !prev);
  };

  const handleRate = async (quality: number) => {
    if (!currentCard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await reviewCard(currentCard.id, quality, currentCard.front);
    setIsFlipped(false);
    if (currentIndex >= deck.length - 1) {
      setCurrentIndex(0);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleCreate = async () => {
    if (!newFront.trim() || !newBack.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addCard({
      front: newFront.trim(),
      back: newBack.trim(),
      cardType: newType,
    });
    setNewFront('');
    setNewBack('');
    setShowAddForm(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
                <Feather name="layers" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.foreground }]}>Concept Flashcards</Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  {dueFlashcards.length} due for review • SM-2 Spaced Repetition
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Toggle Add Form */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              onPress={() => setShowAddForm(false)}
              style={[
                styles.tabBtn,
                !showAddForm && [styles.tabBtnActive, { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }],
              ]}
            >
              <Text style={[styles.tabBtnText, { color: !showAddForm ? colors.primary : colors.mutedForeground }]}>
                Review Deck ({deck.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowAddForm(true)}
              style={[
                styles.tabBtn,
                showAddForm && [styles.tabBtnActive, { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }],
              ]}
            >
              <Feather name="plus" size={14} color={showAddForm ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabBtnText, { color: showAddForm ? colors.primary : colors.mutedForeground }]}>
                New Card
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {showAddForm ? (
              <Animated.View entering={FadeInDown.springify()} style={styles.formWrap}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Front (Term or Prompt)</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  placeholder="e.g. Socratic Method"
                  placeholderTextColor={colors.mutedForeground}
                  value={newFront}
                  onChangeText={setNewFront}
                />

                <Text style={[styles.formLabel, { color: colors.foreground, marginTop: 14 }]}>Back (Insight or Definition)</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  placeholder="e.g. Form of cooperative argumentative dialogue between individuals..."
                  placeholderTextColor={colors.mutedForeground}
                  value={newBack}
                  onChangeText={setNewBack}
                  multiline
                  numberOfLines={4}
                />

                <Text style={[styles.formLabel, { color: colors.foreground, marginTop: 14 }]}>Card Type</Text>
                <View style={styles.typeRow}>
                  {(['concept', 'vocabulary', 'theme', 'quote'] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setNewType(t)}
                      style={[
                        styles.typeChip,
                        { borderColor: colors.border },
                        newType === t && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      <Text style={[styles.typeChipText, { color: newType === t ? '#FFF' : colors.foreground }]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={handleCreate}
                  disabled={!newFront.trim() || !newBack.trim()}
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: newFront.trim() && newBack.trim() ? colors.primary : colors.muted },
                  ]}
                >
                  <Text style={styles.primaryBtnText}>Save Flashcard</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : deck.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Animated.View entering={ZoomIn.springify()} style={[styles.emptyCircle, { backgroundColor: `${colors.primary}12` }]}>
                  <Feather name="check-circle" size={40} color={colors.primary} />
                </Animated.View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All Caught Up!</Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  No flashcards due right now. The Coach automatically creates concept cards as you explore books.
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddForm(true)}
                  style={[styles.secondaryBtn, { borderColor: colors.primary }]}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Create Your Own Card</Text>
                </TouchableOpacity>
              </View>
            ) : currentCard ? (
              <View style={styles.deckWrap}>
                <View style={styles.cardHeader}>
                  <View style={[styles.badgePill, { backgroundColor: `${colors.primary}15` }]}>
                    <Text style={[styles.badgePillText, { color: colors.primary }]}>
                      {currentCard.cardType.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.cardCounter, { color: colors.mutedForeground }]}>
                    {currentIndex + 1} of {deck.length}
                  </Text>
                </View>

                {/* Flip Card */}
                <TouchableOpacity
                  onPress={handleFlip}
                  activeOpacity={0.9}
                  style={[
                    styles.flashcard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isFlipped ? colors.primary : colors.border,
                      borderWidth: isFlipped ? 1.5 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.cardSideHint, { color: colors.mutedForeground }]}>
                    {isFlipped ? 'ANSWER / INSIGHT' : 'QUESTION / CONCEPT (Tap to flip)'}
                  </Text>
                  <Text style={[styles.cardText, { color: colors.foreground }]}>
                    {isFlipped ? currentCard.back : currentCard.front}
                  </Text>
                  {currentCard.bookTitle ? (
                    <Text style={[styles.cardSource, { color: colors.mutedForeground }]}>
                      From: {currentCard.bookTitle} {currentCard.chapter ? `• Ch. ${currentCard.chapter}` : ''}
                    </Text>
                  ) : null}
                </TouchableOpacity>

                {/* SM-2 Quality Rating Buttons (visible once flipped) */}
                {isFlipped ? (
                  <Animated.View entering={FadeInDown.springify()} style={styles.ratingSection}>
                    <Text style={[styles.ratePrompt, { color: colors.mutedForeground }]}>How well did you recall this?</Text>
                    <View style={styles.ratingButtonsRow}>
                      <TouchableOpacity
                        onPress={() => handleRate(0)}
                        style={[styles.rateBtn, { backgroundColor: `${colors.destructive}18`, borderColor: colors.destructive }]}
                      >
                        <Text style={[styles.rateBtnNum, { color: colors.destructive }]}>Again</Text>
                        <Text style={[styles.rateBtnSub, { color: colors.destructive }]}>1 day</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleRate(2)}
                        style={[styles.rateBtn, { backgroundColor: `${colors.terracotta}18`, borderColor: colors.terracotta }]}
                      >
                        <Text style={[styles.rateBtnNum, { color: colors.terracotta }]}>Hard</Text>
                        <Text style={[styles.rateBtnSub, { color: colors.terracotta }]}>2 days</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleRate(4)}
                        style={[styles.rateBtn, { backgroundColor: `${colors.slateDeep}18`, borderColor: colors.slateDeep }]}
                      >
                        <Text style={[styles.rateBtnNum, { color: colors.slateDeep }]}>Good</Text>
                        <Text style={[styles.rateBtnSub, { color: colors.slateDeep }]}>
                          {Math.max(3, currentCard.intervalDays * 2)}d
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleRate(5)}
                        style={[styles.rateBtn, { backgroundColor: `${colors.sageDeep}18`, borderColor: colors.sageDeep }]}
                      >
                        <Text style={[styles.rateBtnNum, { color: colors.sageDeep }]}>Easy</Text>
                        <Text style={[styles.rateBtnSub, { color: colors.sageDeep }]}>
                          {Math.max(5, currentCard.intervalDays * 3)}d
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                ) : (
                  <TouchableOpacity
                    onPress={handleFlip}
                    style={[styles.revealBtn, { backgroundColor: `${colors.primary}15` }]}
                  >
                    <Feather name="eye" size={16} color={colors.primary} />
                    <Text style={[styles.revealBtnText, { color: colors.primary }]}>Tap Card to Reveal Answer</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    height: '84%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Newsreader_700Bold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnActive: {
    borderWidth: 1,
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  body: {
    padding: 20,
    paddingBottom: 40,
  },
  deckWrap: {
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgePillText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  cardCounter: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  flashcard: {
    borderRadius: 24,
    minHeight: 220,
    padding: 24,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardSideHint: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  cardText: {
    fontSize: 20,
    fontFamily: 'Newsreader_600SemiBold',
    lineHeight: 28,
    marginVertical: 16,
  },
  cardSource: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  revealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    gap: 8,
  },
  revealBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  ratingSection: {
    alignItems: 'center',
    gap: 12,
  },
  ratePrompt: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  ratingButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  rateBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  rateBtnNum: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  rateBtnSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'Newsreader_700Bold',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  secondaryBtn: {
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 12,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  formWrap: {
    gap: 8,
  },
  formLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
