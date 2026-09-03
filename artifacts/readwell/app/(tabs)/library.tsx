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
import Animated, { FadeInDown, FadeInUp, Layout, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { books, deleteBook } = useApp();
  const [query, setQuery] = useState('');

  const filtered = books.filter(
    b =>
      b.title.toLowerCase().includes(query.toLowerCase()) ||
      b.author.toLowerCase().includes(query.toLowerCase())
  );

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 34 : 0;

  const handleDelete = (book: Book) => {
    Alert.alert('Remove Book', `Remove "${book.title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        deleteBook(book.id);
      } },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={{ gap: 2 }}>
          <View style={[styles.seasonPill, { backgroundColor: `${colors.sage}22` }]}>
            <Text style={[styles.seasonPillText, { color: colors.sageDeep }]}>
              📚 THE SHELF
            </Text>
          </View>
          <Animated.Text entering={FadeInDown.springify()} style={[styles.title, { color: colors.foreground }]}>
            Library
          </Animated.Text>
        </View>
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/import');
            }}
            style={[styles.importPill, { borderColor: `${colors.terracotta}66` }]}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={14} color={colors.terracotta} />
            <Text style={[styles.importPillText, { color: colors.terracotta }]}>IMPORT</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(150).springify()} style={[styles.searchRow, { paddingHorizontal: 20 }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: `${colors.honey}55` }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search books..."
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

      <FlatList
        data={filtered}
        keyExtractor={b => b.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: botPad + 100 },
          filtered.length === 0 && { flex: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!filtered.length}
        ListEmptyComponent={
          <Animated.View entering={FadeIn.delay(300)}>
            <EmptyState
              icon="book"
              title={books.length === 0 ? 'No books yet' : 'No results'}
              subtitle={
                books.length === 0
                  ? 'Import a PDF or paste text to generate your first Socratic reading stages.'
                  : 'Try a different search term.'
              }
            >
              {books.length === 0 && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/import');
                  }}
                  style={[styles.emptyBtn, { backgroundColor: colors.honey }]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyBtnText}>IMPORT DOCUMENT ▸</Text>
                </TouchableOpacity>
              )}
            </EmptyState>
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <Animated.View 
            entering={FadeInUp.delay(100 + index * 50).springify()} 
            layout={Layout.springify()}
          >
            <BookCard
              book={item}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/reader/${item.id}`);
              }}
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
    paddingBottom: 16,
  },
  seasonPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 2,
  },
  seasonPillText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.9,
  },
  title: { fontSize: 28, fontFamily: 'Newsreader_700Bold', letterSpacing: -0.3 },
  importPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  importPillText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.9,
  },
  searchRow: { marginBottom: 16 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  list: { paddingHorizontal: 20 },
  emptyBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyBtnText: {
    color: '#1F1C18',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
  },
});
