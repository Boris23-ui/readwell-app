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
import { useApp } from '@/context/AppContext';
import { BookCard } from '@/components/BookCard';
import { EmptyState } from '@/components/EmptyState';
import { Book } from '@/types';

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
      { text: 'Remove', style: 'destructive', onPress: () => deleteBook(book.id) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Library</Text>
        <TouchableOpacity
          onPress={() => router.push('/import')}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchRow, { paddingHorizontal: 20 }]}>
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
      </View>

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
                onPress={() => router.push('/import')}
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.emptyBtnText}>Add Book</Text>
              </TouchableOpacity>
            )}
          </EmptyState>
        }
        renderItem={({ item }) => (
          <BookCard
            book={item}
            onPress={() => router.push(`/reader/${item.id}`)}
          />
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
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: { marginBottom: 16 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  list: { paddingHorizontal: 20 },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
