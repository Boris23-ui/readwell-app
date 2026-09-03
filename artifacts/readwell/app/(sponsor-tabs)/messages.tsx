import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { getSponsorLearners } from '@/utils/supabaseDb';
import { UserProfile, Message } from '@/types';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, Layout, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = 'cached_sponsor_messages_';

export default function SponsorMessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [learners, setLearners] = useState<UserProfile[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingLearners, setLoadingLearners] = useState(true);

  // Load cached messages for selected learner
  useEffect(() => {
    if (!selectedLearnerId) return;
    const cacheKey = `${CACHE_KEY_PREFIX}${selectedLearnerId}`;
    AsyncStorage.getItem(cacheKey).then(cached => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Message[];
          const now = new Date();
          const valid = parsed.filter(m => new Date(m.expiresAt) > now);
          setMessages(valid);
        } catch (e) {
          console.warn('Failed to parse cached messages', e);
        }
      } else {
        setMessages([]);
      }
    });
  }, [selectedLearnerId]);

  // Fetch Learners
  useEffect(() => {
    if (!user) return;
    const fetchLearners = async () => {
      try {
        const fetched = await getSponsorLearners(user.uid);
        setLearners(fetched);
        if (fetched.length > 0) setSelectedLearnerId(fetched[0].uid || null);
      } catch (error) {
        console.error('Error fetching learners', error);
      } finally {
        setLoadingLearners(false);
      }
    };
    fetchLearners();
  }, [user]);

  // Fetch & poll messages for the selected learner
  useEffect(() => {
    if (!user || !selectedLearnerId) return;

    const fetchMessages = async () => {
      if (isSupabaseConfigured()) {
        try {
          const nowIso = new Date().toISOString();
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${user.uid},receiver_id.eq.${selectedLearnerId}),and(sender_id.eq.${selectedLearnerId},receiver_id.eq.${user.uid})`)
            .gt('expires_at', nowIso)
            .order('created_at', { ascending: true });

          if (data && !error) {
            const mapped: Message[] = data.map((d: any) => ({
              id: d.id,
              senderId: d.sender_id,
              receiverId: d.receiver_id,
              participants: [d.sender_id, d.receiver_id],
              text: d.text,
              createdAt: d.created_at,
              expiresAt: d.expires_at,
              read: d.read,
            }));
            setMessages(mapped);
            const cacheKey = `${CACHE_KEY_PREFIX}${selectedLearnerId}`;
            await AsyncStorage.setItem(cacheKey, JSON.stringify(mapped));
          }
        } catch (err) {
          console.warn('Supabase sponsor messages query error', err);
        }
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 8000);
    return () => clearInterval(interval);
  }, [user, selectedLearnerId]);

  const sendMessage = async () => {
    if (!inputText.trim() || !user || !selectedLearnerId) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const textToSend = inputText.trim();
    setInputText('');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const newMsg: Message = {
      id: 'msg_' + Date.now(),
      senderId: user.uid,
      receiverId: selectedLearnerId,
      participants: [user.uid, selectedLearnerId],
      text: textToSend,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      read: false,
    };

    const updated = [...messages, newMsg];
    setMessages(updated);
    const cacheKey = `${CACHE_KEY_PREFIX}${selectedLearnerId}`;
    AsyncStorage.setItem(cacheKey, JSON.stringify(updated)).catch(() => {});

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('messages').insert({
          sender_id: user.uid,
          receiver_id: selectedLearnerId,
          text: textToSend,
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          read: false,
        });
      } catch (e) {
        console.error('Failed to send message to Supabase:', e);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const renderMessage = ({ item, index }: { item: Message, index: number }) => {
    const isMe = item.senderId === user?.uid;
    return (
      <Animated.View 
        entering={FadeInUp.delay(50).springify()}
        layout={Layout.springify()}
        style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}
      >
        <View style={[
          styles.messageBubble, 
          isMe ? [styles.messageBubbleMe, { backgroundColor: colors.primary }] : [styles.messageBubbleThem, { backgroundColor: colors.card, borderColor: colors.border }]
        ]}>
          <Text style={[styles.messageText, { color: isMe ? '#FFF' : colors.text }]}>{item.text}</Text>
          <Text style={[styles.messageTime, { color: isMe ? '#FFF9' : colors.textSecondary }]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </Animated.View>
    );
  };

  if (loadingLearners) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (learners.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 20 }]}>
        <Animated.View entering={ZoomIn.springify()} style={[styles.emptyIconCircle, { backgroundColor: `${colors.primary}15` }]}>
           <Feather name="message-circle" size={32} color={colors.primary} />
        </Animated.View>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Link a learner first to start messaging.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <Animated.Text entering={FadeInDown.springify()} style={[styles.title, { color: colors.text }]}>Messages</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(100).springify()} style={[styles.subtitle, { color: colors.textSecondary }]}>Messages disappear after 24 hours.</Animated.Text>
      </View>

      {/* Learner Selector */}
      {learners.length > 1 && (
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.learnerSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {learners.map(l => (
              <TouchableOpacity 
                key={l.uid}
                style={[
                  styles.learnerTab, 
                  { borderColor: colors.border },
                  selectedLearnerId === l.uid && { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedLearnerId(l.uid || null);
                }}
              >
                <Text style={[
                  styles.learnerTabText, 
                  { color: selectedLearnerId === l.uid ? colors.primary : colors.textSecondary }
                ]}>
                  {l.displayName || l.name || 'Unnamed'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Chat Area */}
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Area */}
      <Animated.View entering={FadeInDown.delay(300).springify()} style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          placeholder="Message..."
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity 
          style={[styles.sendBtn, { backgroundColor: inputText.trim() ? colors.primary : colors.muted }]} 
          onPress={sendMessage}
          disabled={!inputText.trim()}
          activeOpacity={0.8}
        >
          <Feather name="send" size={18} color="#FFF" style={{ marginLeft: 2, marginTop: 2 }} />
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingBottom: 10 },
  title: { fontSize: 28, fontFamily: 'Newsreader_700Bold' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 },
  
  learnerSelector: { paddingHorizontal: 20, paddingBottom: 10 },
  learnerTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  learnerTabText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  
  chatList: { padding: 20, gap: 12, paddingBottom: 40 },
  messageRow: { flexDirection: 'row', width: '100%' },
  messageRowMe: { justifyContent: 'flex-end' },
  messageRowThem: { justifyContent: 'flex-start' },
  messageBubble: { maxWidth: '80%', padding: 14, borderRadius: 20 },
  messageBubbleMe: { borderBottomRightRadius: 4 },
  messageBubbleThem: { borderBottomLeftRadius: 4, borderWidth: 1 },
  messageText: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  messageTime: { fontSize: 10, fontFamily: 'Inter_400Regular', alignSelf: 'flex-end', marginTop: 6 },

  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 16, borderTopWidth: 1, gap: 12 },
  input: { flex: 1, borderWidth: 1, borderRadius: 24, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, maxHeight: 120, fontSize: 15, fontFamily: 'Inter_400Regular' },
  sendBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyText: { fontFamily: 'Inter_500Medium', textAlign: 'center', fontSize: 15, lineHeight: 22 }
});
