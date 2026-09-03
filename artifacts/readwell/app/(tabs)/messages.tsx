import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/CloudAppContext';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { Message, UserProfile } from '@/types';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoachChatView } from '@/components/CoachChatView';

const CACHE_KEY_MESSAGES = 'cached_learner_messages';

export default function LearnerMessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useApp();

  const [activeTab, setActiveTab] = useState<'coach' | 'sponsor'>('coach');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sponsorName, setSponsorName] = useState<string>('Sponsor');
  const [loadingSponsor, setLoadingSponsor] = useState(false);

  // Load cached sponsor messages on mount if sponsor exists
  useEffect(() => {
    if (!profile?.sponsorId) return;
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
  }, [profile?.sponsorId]);

  // Fetch Sponsor Name
  useEffect(() => {
    if (!profile?.sponsorId) return;
    setLoadingSponsor(true);
    const fetchSponsor = async () => {
      if (isSupabaseConfigured()) {
        try {
          const { data } = await supabase
            .from('users')
            .select('display_name')
            .eq('id', profile.sponsorId!)
            .single();
          if (data?.display_name) {
            setSponsorName(data.display_name);
          }
        } catch (e) {
          console.warn('Failed to fetch sponsor name from Supabase', e);
        } finally {
          setLoadingSponsor(false);
        }
      } else {
        setSponsorName('Parent / Sponsor');
        setLoadingSponsor(false);
      }
    };
    fetchSponsor();
  }, [profile?.sponsorId]);

  // Fetch & poll Sponsor Messages
  useEffect(() => {
    if (!user || !profile?.sponsorId) return;

    const fetchMessages = async () => {
      if (isSupabaseConfigured()) {
        try {
          const nowIso = new Date().toISOString();
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${user.uid},receiver_id.eq.${profile.sponsorId}),and(sender_id.eq.${profile.sponsorId},receiver_id.eq.${user.uid})`)
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
            await AsyncStorage.setItem(CACHE_KEY_MESSAGES, JSON.stringify(mapped));
          }
        } catch (err) {
          console.warn('Supabase messages query error', err);
        }
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 8000);
    return () => clearInterval(interval);
  }, [user, profile?.sponsorId]);

  const sendSponsorMessage = async () => {
    if (!inputText.trim() || !user || !profile?.sponsorId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const textToSend = inputText.trim();
    setInputText('');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const newMsg: Message = {
      id: 'msg_' + Date.now(),
      senderId: user.uid,
      receiverId: profile.sponsorId,
      participants: [user.uid, profile.sponsorId],
      text: textToSend,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      read: false,
    };

    const updated = [...messages, newMsg];
    setMessages(updated);
    AsyncStorage.setItem(CACHE_KEY_MESSAGES, JSON.stringify(updated)).catch(() => {});

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('messages').insert({
          sender_id: user.uid,
          receiver_id: profile.sponsorId,
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

  const renderSponsorMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.uid;
    return (
      <Animated.View
        entering={FadeInUp.delay(50).springify()}
        layout={Layout.springify()}
        style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}
      >
        <View
          style={[
            styles.messageBubble,
            isMe
              ? [styles.messageBubbleMe, { backgroundColor: colors.primary }]
              : [styles.messageBubbleThem, { backgroundColor: colors.card, borderColor: colors.border }],
          ]}
        >
          <Text style={[styles.messageText, { color: isMe ? '#FFF' : colors.foreground }]}>{item.text}</Text>
          <Text style={[styles.messageTime, { color: isMe ? '#FFF9' : colors.mutedForeground }]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Top Selector if User Has a Linked Sponsor */}
      {profile?.sponsorId ? (
        <View style={[styles.segmentedControl, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('coach');
            }}
            style={[
              styles.segmentBtn,
              activeTab === 'coach' && [styles.segmentBtnActive, { backgroundColor: colors.primary }],
            ]}
          >
            <Text style={{ marginRight: 6 }}>🦉</Text>
            <Text
              style={[
                styles.segmentBtnText,
                { color: activeTab === 'coach' ? '#FFF' : colors.mutedForeground },
              ]}
            >
              AI Reading Coach
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('sponsor');
            }}
            style={[
              styles.segmentBtn,
              activeTab === 'sponsor' && [styles.segmentBtnActive, { backgroundColor: colors.primary }],
            ]}
          >
            <Feather
              name="message-circle"
              size={15}
              color={activeTab === 'sponsor' ? '#FFF' : colors.mutedForeground}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.segmentBtnText,
                { color: activeTab === 'sponsor' ? '#FFF' : colors.mutedForeground },
              ]}
            >
              Sponsor ({sponsorName})
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Primary Coach View */}
      {activeTab === 'coach' || !profile?.sponsorId ? (
        <View style={{ flex: 1 }}>
          <CoachChatView />
        </View>
      ) : (
        /* Sponsor Chat View */
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <View style={styles.sponsorHeader}>
            <Text style={[styles.sponsorTitle, { color: colors.foreground }]}>Chat with {sponsorName}</Text>
            <Text style={[styles.sponsorSubtitle, { color: colors.mutedForeground }]}>
              Messages disappear after 24 hours.
            </Text>
          </View>

          {loadingSponsor ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={messages}
              keyExtractor={item => item.id}
              renderItem={renderSponsorMessage}
              contentContainerStyle={styles.chatList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Feather name="message-square" size={36} color={colors.mutedForeground} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    No messages yet today. Send a quick update to {sponsorName}!
                  </Text>
                </View>
              }
            />
          )}

          <View
            style={[
              styles.inputContainer,
              { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom + 10, 20) },
            ]}
          >
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder={`Message ${sponsorName}...`}
              placeholderTextColor={colors.mutedForeground}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: inputText.trim() ? colors.primary : colors.muted }]}
              onPress={sendSponsorMessage}
              disabled={!inputText.trim()}
              activeOpacity={0.8}
            >
              <Feather name="send" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 16,
  },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  sponsorHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sponsorTitle: {
    fontSize: 22,
    fontFamily: 'Newsreader_700Bold',
  },
  sponsorSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  chatList: {
    padding: 20,
    gap: 12,
    paddingBottom: 30,
  },
  messageRow: {
    flexDirection: 'row',
    width: '100%',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowThem: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 20,
  },
  messageBubbleMe: {
    borderBottomRightRadius: 4,
  },
  messageBubbleThem: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 14,
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
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});
