import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Book, Segment } from '@/types';
import { splitIntoParagraphs, groupIntoSegments, countWords, randomCoverColor } from '@/utils/content';

export default function ImportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addBook } = useApp();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const canProcess = title.trim().length > 0 && content.trim().length > 50;

  const handleProcess = async () => {
    if (!canProcess) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessing(true);
    setError('');

    try {
      const paragraphs = splitIntoParagraphs(content.trim());
      if (paragraphs.length < 2) {
        setError('Not enough content. Please paste at least a few paragraphs.');
        setProcessing(false);
        return;
      }

      const rawSegments = groupIntoSegments(paragraphs, 5);
      const segments: Segment[] = rawSegments.map((paragraphGroup, i) => ({
        index: i,
        paragraphs: paragraphGroup,
      }));

      const book: Book = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        title: title.trim(),
        author: author.trim(),
        content: content.trim(),
        segments,
        status: 'in_progress',
        createdAt: new Date().toISOString(),
        wordCount: countWords(content),
        currentSegmentIndex: 0,
        coverColor: randomCoverColor(),
      };

      await addBook(book);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/reader/${book.id}`);
    } catch (e) {
      setError('Something went wrong. Please try again.');
      setProcessing(false);
    }
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Add Book</Text>
          <TouchableOpacity
            onPress={handleProcess}
            disabled={!canProcess || processing}
            style={[
              styles.addBtn,
              { backgroundColor: canProcess ? colors.primary : colors.muted },
            ]}
          >
            {processing ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={[styles.addBtnText, { color: canProcess ? '#FFF' : colors.mutedForeground }]}>
                Add
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info banner */}
          <View style={[styles.infoBanner, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
            <Feather name="info" size={15} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primary }]}>
              Paste any text — a book chapter, article, essay, or anything you want to read and understand deeply.
            </Text>
          </View>

          {/* Title field */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. The Great Gatsby — Chapter 1"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
            />
          </View>

          {/* Author field */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Author (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. F. Scott Fitzgerald"
              placeholderTextColor={colors.mutedForeground}
              value={author}
              onChangeText={setAuthor}
              returnKeyType="next"
            />
          </View>

          {/* Content field */}
          <View style={styles.field}>
            <View style={styles.contentHeader}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Content *</Text>
              {content.length > 0 && (
                <Text style={[styles.wordCount, { color: colors.mutedForeground }]}>
                  ~{countWords(content)} words
                </Text>
              )}
            </View>
            <TextInput
              style={[
                styles.contentInput,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder="Paste your text here. The app will automatically split it into reading segments with AI comprehension quizzes..."
              placeholderTextColor={colors.mutedForeground}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
            />
          </View>

          {error.length > 0 && (
            <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}12`, borderColor: `${colors.destructive}30` }]}>
              <Feather name="alert-circle" size={15} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          {content.trim().length > 50 && (
            <View style={[styles.previewBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="layers" size={14} color={colors.mutedForeground} />
              <Text style={[styles.previewText, { color: colors.mutedForeground }]}>
                ~{Math.max(1, Math.ceil(splitIntoParagraphs(content).length / 5))} reading segments
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  addBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10, minWidth: 60, alignItems: 'center' },
  addBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  contentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordCount: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  contentInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 220,
    lineHeight: 22,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  previewText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
