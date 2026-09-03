import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp, Layout, ZoomIn } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/CloudAppContext';
import { useCoach } from '@/context/CoachContext';
import { CoachMessage, Book } from '@/types';
import { FlashcardDeckModal } from './FlashcardDeckModal';

interface Props {
  initialBookContext?: CoachMessage['bookContext'];
  onClose?: () => void;
  isModal?: boolean;
}

export function CoachChatView({ initialBookContext, onClose, isModal = false }: Props) {
  const colors = useColors();
  const { books } = useApp();
  const {
    messages,
    strategy,
    sendMessage,
    isSending,
    dueFlashcards,
    selectedBook,
    setSelectedBook,
    evolveStrategy,
    clearConversation,
  } = useCoach();

  const [inputText, setInputText] = useState('');
  const [showEvolutionModal, setShowEvolutionModal] = useState(false);
  const [showFlashcardModal, setShowFlashcardModal] = useState(false);
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [isEvolving, setIsEvolving] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isSending]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isSending) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText('');
    await sendMessage(textToSend, initialBookContext);
  };

  const handleManualEvolve = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsEvolving(true);
    try {
      await evolveStrategy('Manual reader evaluation requested via Coach panel');
    } finally {
      setIsEvolving(false);
    }
  };

  const renderMessage = ({ item }: { item: CoachMessage }) => {
    const isMe = item.role === 'user';
    return (
      <Animated.View
        entering={FadeInUp.delay(40).springify()}
        layout={Layout.springify()}
        style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}
      >
        {!isMe && (
          <View style={[styles.avatarCircle, { backgroundColor: `${colors.primary}20` }]}>
            <Text style={styles.avatarEmoji}>🦉</Text>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isMe
              ? [styles.messageBubbleMe, { backgroundColor: colors.primary }]
              : [styles.messageBubbleThem, { backgroundColor: colors.card, borderColor: colors.border }],
          ]}
        >
          {item.bookContext?.title && !isMe && (
            <View style={styles.contextPill}>
              <Feather name="book-open" size={11} color={colors.primary} />
              <Text style={[styles.contextPillText, { color: colors.primary }]}>
                {item.bookContext.title} {item.bookContext.chapter ? `• Ch. ${item.bookContext.chapter}` : ''}
              </Text>
            </View>
          )}

          <Text style={[styles.messageText, { color: isMe ? '#FFF' : colors.foreground }]}>
            {item.content}
          </Text>

          <View style={styles.bubbleFooter}>
            {item.strategyVersion && !isMe ? (
              <Text style={[styles.strategyTag, { color: colors.mutedForeground }]}>
                Strategy v{item.strategyVersion}
              </Text>
            ) : null}
            <Text style={[styles.messageTime, { color: isMe ? '#FFF9' : colors.mutedForeground }]}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const quickPrompts = [
    'What Socratic question do you have for me?',
    'Unpack the core themes in this book',
    'Why did you adapt your coaching style?',
    'Create a reading plan for me',
    'Review my due flashcards',
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? (isModal ? 20 : 64) : 0}
    >
      {/* Top Header & Strategy Bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <View style={styles.topBarLeft}>
          {isModal && onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="chevron-down" size={24} color={colors.foreground} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowBookPicker(true)}
            style={[styles.bookPickerPill, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="book" size={13} color={colors.primary} />
            <Text style={[styles.bookPickerText, { color: colors.foreground }]} numberOfLines={1}>
              {initialBookContext?.title || selectedBook?.title || 'General Reading'}
            </Text>
            <Feather name="chevron-down" size={13} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.topBarRight}>
          {/* Strategy Inspector Pill */}
          <TouchableOpacity
            onPress={() => setShowEvolutionModal(true)}
            style={[styles.strategyPill, { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }]}
          >
            <Feather name="cpu" size={12} color={colors.primary} />
            <Text style={[styles.strategyPillText, { color: colors.primary }]}>
              v{strategy?.version || 1} • {((strategy?.difficultyLevel ?? 0.5) * 10).toFixed(0)}/10
            </Text>
          </TouchableOpacity>

          {/* Flashcards Deck Button */}
          <TouchableOpacity
            onPress={() => setShowFlashcardModal(true)}
            style={[styles.flashcardsPill, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="layers" size={14} color={colors.foreground} />
            {dueFlashcards.length > 0 && (
              <View style={[styles.badgeCount, { backgroundColor: colors.destructive }]}>
                <Text style={styles.badgeCountText}>{dueFlashcards.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Clear chat */}
          {messages.length > 0 && (
            <TouchableOpacity onPress={clearConversation} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="trash-2" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Animated.View entering={ZoomIn.springify()} style={[styles.owlCircle, { backgroundColor: `${colors.primary}18` }]}>
              <Text style={{ fontSize: 36 }}>🦉</Text>
            </Animated.View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>ReadWell Coach</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              I'm your self-evolving Socratic reading companion. I ask insightful questions, scaffold complex concepts, and evolve my coaching style as you read.
            </Text>

            {/* Quick Starters */}
            <View style={styles.promptsContainer}>
              <Text style={[styles.promptsLabel, { color: colors.mutedForeground }]}>Suggested prompts:</Text>
              {quickPrompts.map((prompt, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleSend(prompt)}
                  style={[styles.promptChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Feather name="corner-down-right" size={12} color={colors.primary} style={{ marginTop: 2 }} />
                  <Text style={[styles.promptText, { color: colors.foreground }]}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListFooterComponent={
          isSending ? (
            <View style={styles.typingRow}>
              <View style={[styles.avatarCircle, { backgroundColor: `${colors.primary}20` }]}>
                <Text style={styles.avatarEmoji}>🦉</Text>
              </View>
              <View style={[styles.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.typingText, { color: colors.mutedForeground }]}>Coach is reflecting...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Input Area */}
      <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          placeholder="Ask or reflect on your reading..."
          placeholderTextColor={colors.mutedForeground}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={600}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: inputText.trim() && !isSending ? colors.primary : colors.muted },
          ]}
          onPress={() => handleSend()}
          disabled={!inputText.trim() || isSending}
          activeOpacity={0.8}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Feather name="arrow-up" size={20} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Flashcard Review Modal */}
      <FlashcardDeckModal visible={showFlashcardModal} onClose={() => setShowFlashcardModal(false)} />

      {/* Book Picker Modal */}
      <Modal visible={showBookPicker} animationType="fade" transparent onRequestClose={() => setShowBookPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowBookPicker(false)}>
          <View style={[styles.pickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Select Book Context</Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedBook(null);
                setShowBookPicker(false);
              }}
              style={[styles.pickerOption, !selectedBook && { backgroundColor: `${colors.primary}15` }]}
            >
              <Feather name="globe" size={16} color={colors.primary} />
              <Text style={[styles.pickerOptionText, { color: colors.foreground }]}>General Reading Conversation</Text>
            </TouchableOpacity>

            {books.map(b => (
              <TouchableOpacity
                key={b.id}
                onPress={() => {
                  setSelectedBook(b);
                  setShowBookPicker(false);
                }}
                style={[styles.pickerOption, selectedBook?.id === b.id && { backgroundColor: `${colors.primary}15` }]}
              >
                <Feather name="book" size={16} color={b.coverColor || colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerOptionText, { color: colors.foreground }]} numberOfLines={1}>{b.title}</Text>
                  <Text style={[styles.pickerOptionSub, { color: colors.mutedForeground }]}>{b.author || 'Unknown'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Evolution Inspector Modal */}
      <Modal visible={showEvolutionModal} animationType="slide" transparent onRequestClose={() => setShowEvolutionModal(false)}>
        <View style={styles.pickerOverlay}>
          <View style={[styles.evolutionModal, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.avatarCircle, { backgroundColor: `${colors.primary}20` }]}>
                  <Feather name="cpu" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>Coaching Strategy v{strategy?.version || 1}</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>Autonomous Meta-Learning Engine</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowEvolutionModal(false)}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.evolutionBody} showsVerticalScrollIndicator={false}>
              {/* Strategy Parameters */}
              <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Tone</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{strategy?.tone}</Text>
                </View>

                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Difficulty Level</Text>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {((strategy?.difficultyLevel ?? 0.5) * 10).toFixed(1)} / 10
                  </Text>
                </View>
                {/* Progress bar */}
                <View style={[styles.diffTrack, { backgroundColor: colors.muted }]}>
                  <View style={[styles.diffFill, { width: `${(strategy?.difficultyLevel ?? 0.5) * 100}%` as any, backgroundColor: colors.primary }]} />
                </View>

                <View style={[styles.statRow, { marginTop: 12 }]}>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Question Style</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{strategy?.preferredQuestionStyle}</Text>
                </View>
              </View>

              {/* Effective Tactics */}
              <Text style={[styles.subhead, { color: colors.foreground }]}>Effective Tactics</Text>
              <View style={styles.tagsRow}>
                {strategy?.effectiveTactics?.map((t, i) => (
                  <View key={i} style={[styles.tacticTag, { backgroundColor: `${colors.sage}15`, borderColor: `${colors.sageDeep}50` }]}>
                    <Feather name="check" size={12} color={colors.sageDeep} />
                    <Text style={[styles.tacticTagText, { color: colors.sageDeep }]}>{t}</Text>
                  </View>
                ))}
              </View>

              {/* Ineffective Tactics Phased Out */}
              <Text style={[styles.subhead, { color: colors.foreground, marginTop: 14 }]}>Phased Out Tactics</Text>
              <View style={styles.tagsRow}>
                {strategy?.ineffectiveTactics?.map((t, i) => (
                  <View key={i} style={[styles.tacticTag, { backgroundColor: `${colors.destructive}15`, borderColor: `${colors.destructive}50` }]}>
                    <Feather name="slash" size={12} color={colors.destructive} />
                    <Text style={[styles.tacticTagText, { color: colors.destructive }]}>{t}</Text>
                  </View>
                ))}
              </View>

              {/* Evolution History Timeline */}
              <Text style={[styles.subhead, { color: colors.foreground, marginTop: 18 }]}>Evolution Audit Log</Text>
              {strategy?.evolutionHistory && strategy.evolutionHistory.length > 0 ? (
                strategy.evolutionHistory.map((rec, i) => (
                  <View key={i} style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.historyHeader}>
                      <Text style={[styles.historyVer, { color: colors.primary }]}>Iteration v{rec.version}</Text>
                      <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>{rec.timestamp.slice(0, 10)}</Text>
                    </View>
                    <Text style={[styles.historyObs, { color: colors.foreground }]}>
                      <Text style={{ fontWeight: '600' }}>Observation: </Text>{rec.observation}
                    </Text>
                    <Text style={[styles.historyAdj, { color: colors.mutedForeground }]}>
                      <Text style={{ fontWeight: '600', color: colors.primary }}>Adjustment: </Text>{rec.adjustmentMade}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyHist, { color: colors.mutedForeground }]}>
                  The Coach is in baseline mode. As you engage in discussions, the evolution engine automatically updates this log.
                </Text>
              )}

              {/* Manual Trigger Evolution Button */}
              <TouchableOpacity
                onPress={handleManualEvolve}
                disabled={isEvolving}
                style={[styles.evolveBtn, { backgroundColor: colors.primary }]}
              >
                {isEvolving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Feather name="refresh-cw" size={16} color="#FFF" />
                    <Text style={styles.evolveBtnText}>Trigger Self-Evolution Evaluation</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  bookPickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    maxWidth: '85%',
  },
  bookPickerText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    flexShrink: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  strategyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  strategyPillText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  flashcardsPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeCountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  clearBtn: {
    padding: 6,
  },
  chatList: {
    padding: 16,
    paddingBottom: 24,
    gap: 14,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowThem: {
    justifyContent: 'flex-start',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarEmoji: {
    fontSize: 18,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  messageBubbleMe: {
    borderBottomRightRadius: 4,
  },
  messageBubbleThem: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  contextPillText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Newsreader_500Medium',
    lineHeight: 22,
  },
  bubbleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  strategyTag: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
  messageTime: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    alignSelf: 'flex-end',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  typingText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  owlCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: 'Newsreader_700Bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  promptsContainer: {
    width: '100%',
    gap: 8,
  },
  promptsLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  promptText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  pickerTitle: {
    fontSize: 17,
    fontFamily: 'Newsreader_700Bold',
    marginBottom: 6,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  pickerOptionText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  pickerOptionSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  evolutionModal: {
    width: '100%',
    height: '85%',
    borderRadius: 28,
    borderWidth: 1,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Newsreader_700Bold',
  },
  modalSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  evolutionBody: {
    padding: 20,
    paddingBottom: 40,
  },
  statBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  statValue: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  diffTrack: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
    marginTop: 4,
  },
  diffFill: {
    height: '100%',
    borderRadius: 3,
  },
  subhead: {
    fontSize: 15,
    fontFamily: 'Newsreader_700Bold',
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tacticTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  tacticTagText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyVer: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  historyDate: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  historyObs: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  historyAdj: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  emptyHist: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    marginBottom: 16,
  },
  evolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    marginTop: 20,
  },
  evolveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
