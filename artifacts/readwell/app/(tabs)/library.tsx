import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/CloudAppContext';
import { BookCard } from '@/components/BookCard';
import { EmptyState } from '@/components/EmptyState';
import { Book } from '@/types';
import { createStarterBook, STARTER_BOOK_ID } from '@/utils/content';
import Animated, { FadeInDown, FadeInUp, Layout, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

type ShelfFilter = 'all' | 'in_progress' | 'finished';

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { books, addBook, deleteBook } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ShelfFilter>('all');

  const normalizedQuery = (query || '').toLowerCase().trim();
  const filtered = (books || []).filter((b) => {
    if (!b) return false;
    if (filter !== 'all' && b.status !== filter) return false;
    const title = (b.title || '').toLowerCase();
    const author = (b.author || '').toLowerCase();
    return title.includes(normalizedQuery) || author.includes(normalizedQuery);
  });

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 34 : 0;

  const handleDelete = (book: Book) => {
    const bookTitle = book?.title || 'Untitled';
    const confirmRemove = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (book?.id) {
        deleteBook(book.id);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Remove "${bookTitle}" from your library?`)) {
        confirmRemove();
      }
      return;
    }

    Alert.alert('Remove Book', `Remove "${bookTitle}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: confirmRemove },
    ]);
  };

  const handleTryStarter = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const existing = books.find((b) => b.id === STARTER_BOOK_ID);
    if (existing) {
      router.push(`/reader/${existing.id}`);
      return;
    }
    const starter = createStarterBook();
    await addBook(starter);
    router.push(`/reader/${starter.id}`);
  };

  const inProgressCount = books.filter((b) => b.status === 'in_progress').length;
  const finishedCount = books.filter((b) => b.status === 'finished').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={{ gap: 2 }}>
          <View style={[styles.eyebrowPill, { backgroundColor: `${colors.sage}22` }]}>
            <Text style={[styles.eyebrowPillText, { color: colors.sageDeep }]}>
              MY LIBRARY
            </Text>
          </View>
          <Animated.Text entering={FadeInDown.springify()} style={[styles.title, { color: colors.foreground }]}>
            Books & Readings
          </Animated.Text>
        </View>
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/import');
            }}
            style={[styles.importPill, { borderColor: `${colors.terracotta}66`, backgroundColor: `${colors.terracotta}10` }]}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={14} color={colors.terracotta} />
            <Text style={[styles.importPillText, { color: colors.terracotta }]}>Import</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {books.length > 0 && (
        <>
          <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.searchRow}>
            <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search by title or author..."
                placeholderTextColor={colors.mutedForeground}
                value={query}
                onChangeText={setQuery}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          <View style={styles.filterRow}>
            {([
              { key: 'all', label: `All (${books.length})` },
              { key: 'in_progress', label: `In Progress (${inProgressCount})` },
              { key: 'finished', label: `Finished (${finishedCount})` },
            ] as const).map((tab) => {
              const active = filter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setFilter(tab.key)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: active ? '#FFFDF8' : colors.mutedForeground },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(b, index) => b?.id || `book-${index}`}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: botPad + 110 },
          filtered.length === 0 && { flex: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!filtered.length}
        ListEmptyComponent={
          <Animated.View entering={FadeIn.delay(200)}>
            <EmptyState
              icon="book-open"
              title={books.length === 0 ? 'Your library is empty' : 'No matching books'}
              subtitle={
                books.length === 0
                  ? 'Import a PDF, paste an article, or try a short starter reading to begin your habit.'
                  : 'Try a different search term or switch filters.'
              }
            >
              {books.length === 0 && (
                <View style={styles.emptyActions}>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push('/import');
                    }}
                    style={[styles.emptyBtn, { backgroundColor: colors.honey }]}
                    activeOpacity={0.85}
                  >
                    <Feather name="plus" size={15} color="#1F1C18" />
                    <Text style={styles.emptyBtnText}>Import a Book</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleTryStarter}
                    style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
                      Try 3-min Starter Read
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </EmptyState>
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInUp.delay(60 + index * 40).springify()}
            layout={Layout.springify()}
          >
            <BookCard
              book={item}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/reader/${item.id}`);
              }}
              onDelete={() => handleDelete(item)}
            />
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 2,
  },
  eyebrowPillText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.9,
  },
  title: { fontSize: 28, fontFamily: 'Newsreader_700Bold', letterSpacing: -0.3 },
  importPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  importPillText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  searchRow: { paddingHorizontal: 20, marginBottom: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12.5,
    fontFamily: 'Inter_600SemiBold',
  },
  list: { paddingHorizontal: 20 },
  emptyActions: {
    marginTop: 12,
    gap: 10,
    alignItems: 'center',
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyBtnText: {
    color: '#1F1C18',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  secondaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  secondaryBtnText: {
    fontSize: 13.5,
    fontFamily: 'Inter_600SemiBold',
  },
});
