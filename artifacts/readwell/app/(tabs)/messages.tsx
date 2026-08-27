import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/utils/firebase';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc } from 'firebase/firestore';
import { Message, UserProfile } from '@/types';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, Layout, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_MESSAGES = 'cached_learner_messages';

export default function LearnerMessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sponsorName, setSponsorName] = useState<string>('Sponsor');
  const [loading, setLoading] = useState(true);

  // Load cached messages on mount
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY_MESSAGES).then(cached => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Message[];
          const now = new Date();
          const valid = parsed.filter(m => new Date(m.expiresAt) > now);
          setMessages(valid);
        } catch (e) {
          console.warn('Failed to parse cached messages', e);
        }
      }
    });
  }, []);

  // Fetch Sponsor Name
  useEffect(() => {
    if (!profile?.sponsorId) {
      setLoading(false);
      return;
    }
    const fetchSponsor = async () => {
      try {
        const d = await getDoc(doc(db, 'users', profile.sponsorId));
        if (d.exists()) {
          const sponsorData = d.data() as UserProfile;
          setSponsorName(sponsorData.displayName || sponsorData.name || 'Sponsor');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSponsor();
  }, [profile]);

  // Listen to Messages
  useEffect(() => {
    if (!user || !profile?.sponsorId) return;

    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const allMsgs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Message));
      
      // Filter for the sponsor and 24-hour expiration
      const filtered = allMsgs.filter(m => {
        const isWithSponsor = m.participants.includes(profile.sponsorId!);
        const isNotExpired = new Date(m.expiresAt) > now;
        return isWithSponsor && isNotExpired;
      });

      // Sort by creation time
      filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      setMessages(filtered);
      AsyncStorage.setItem(CACHE_KEY_MESSAGES, JSON.stringify(filtered)).catch(e => {
        console.warn('Failed to cache messages', e);
      });
    }, (error) => {
      console.warn("Messages snapshot error", error);
    });

    return () => unsubscribe();
  }, [user, profile]);

  const sendMessage = async () => {
    if (!inputText.trim() || !user || !profile?.sponsorId) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const textToSend = inputText.trim();
    setInputText('');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        receiverId: profile.sponsorId,
        participants: [user.uid, profile.sponsorId],
        text: textToSend,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        read: false,
      });
    } catch (e) {
      console.error('Failed to send message:', e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!profile?.sponsorId) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 20 }]}>
        <Animated.View entering={ZoomIn.springify()} style={[styles.emptyIconCircle, { backgroundColor: `${colors.border}30` }]}>
          <Feather name="message-circle" size={48} color={colors.textSecondary} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(100).springify()} style={[styles.title, { color: colors.text, textAlign: 'center', marginBottom: 8 }]}>No Sponsor Linked</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(200).springify()} style={[styles.subtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
          You need to be linked to a sponsor to use messaging.
        </Animated.Text>
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
        <Animated.Text entering={FadeInDown.springify()} style={[styles.title, { color: colors.text }]}>Chat with {sponsorName}</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(100).springify()} style={[styles.subtitle, { color: colors.textSecondary }]}>Messages disappear after 24 hours.</Animated.Text>
      </View>

      {/* Chat Area */}
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Area */}
      <Animated.View entering={FadeInDown.delay(200).springify()} style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom + 60, 16 + 60) }]}>
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
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }
});
