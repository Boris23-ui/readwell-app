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
        <Animated.Text entering={FadeInDown.springify()} style={[styles.title, { color: colors.foreground }]}>Library</Animated.Text>
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/import');
            }}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={20} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(150).springify()} style={[styles.searchRow, { paddingHorizontal: 20 }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                  ? 'Add a book to start reading and building your habit.'
                  : 'Try a different search term.'
              }
            >
              {books.length === 0 && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/import');
                  }}
                  style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyBtnText}>Add Book</Text>
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
  title: { fontSize: 28, fontFamily: 'Newsreader_700Bold' },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchRow: { marginBottom: 16 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  searchInput: { flex: 1, fontSize: 16, fontFamily: 'Inter_400Regular' },
  list: { paddingHorizontal: 20 },
  emptyBtn: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
