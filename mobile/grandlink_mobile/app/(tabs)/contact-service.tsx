import BottomNavBar from '@/components/BottomNav';
import RichText from '@/components/RichText';
import TopBar from '@/components/TopBar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    LayoutAnimation,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import { supabase } from '../supabaseClient';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ChatThread = {
  id: string;
  status: 'pending' | 'active' | 'resolved' | string;
};

type ChatMessage = {
  id: string;
  created_at: string;
  sender_type: 'visitor' | 'user' | 'admin' | string;
  sender_name?: string | null;
  body?: string | null;
  image_url?: string | null;
};

type FAQCategory = {
  id: number;
  name: string;
  faq_questions: {
    id: number;
    question: string;
    answer: string;
  }[];
};

const POLL_MS = 2500;
const QUICK_FAQ_BATCH_SIZE = 5;

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export default function ContactServiceScreen() {
  const router = useRouter();
  const [supportMode, setSupportMode] = useState<'live' | 'quick'>('quick');

  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const [faqCategories, setFaqCategories] = useState<FAQCategory[]>([]);
  const [faqActiveCategory, setFaqActiveCategory] = useState<number | null>(null);
  const [faqOpenQuestion, setFaqOpenQuestion] = useState<number | null>(null);
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqError, setFaqError] = useState('');
  const [quickFaqPage, setQuickFaqPage] = useState(0);
  const [quickFaqOpenQuestion, setQuickFaqOpenQuestion] = useState<number | null>(null);

  const scrollRef = useRef<ScrollView | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canSend = useMemo(() => !!thread && thread.status !== 'resolved', [thread]);
  const faqQuestionPool = useMemo(
    () =>
      faqCategories.flatMap((category) =>
        (category.faq_questions || []).map((q) => ({
          ...q,
          categoryName: category.name,
        }))
      ),
    [faqCategories]
  );
  const quickFaqPageCount = useMemo(
    () => Math.max(1, Math.ceil(faqQuestionPool.length / QUICK_FAQ_BATCH_SIZE)),
    [faqQuestionPool]
  );
  const quickFaqQuestions = useMemo(() => {
    if (!faqQuestionPool.length) return [];
    const start = (quickFaqPage * QUICK_FAQ_BATCH_SIZE) % faqQuestionPool.length;
    const count = Math.min(QUICK_FAQ_BATCH_SIZE, faqQuestionPool.length);
    return Array.from({ length: count }, (_, idx) => faqQuestionPool[(start + idx) % faqQuestionPool.length]);
  }, [faqQuestionPool, quickFaqPage]);

  const stopPolling = React.useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadMessages = React.useCallback(async (threadId: string) => {
    const { data, error: fetchError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    setMessages((data || []) as ChatMessage[]);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const ensureThread = React.useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      throw new Error('Please sign in to use contact service chat.');
    }

    const currentUser = authData.user;
    setUserEmail(currentUser.email || '');
    setUserName(
      (currentUser.user_metadata?.full_name as string) ||
      (currentUser.user_metadata?.name as string) ||
      currentUser.email ||
      'User'
    );

    const { data: existing, error: existingError } = await supabase
      .from('chat_threads')
      .select('id, status')
      .eq('user_id', currentUser.id)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      setThread(existing as ChatThread);
      return existing.id;
    }

    const { data: created, error: createError } = await supabase
      .from('chat_threads')
      .insert({
        user_id: currentUser.id,
        status: 'pending',
        last_message_at: new Date().toISOString(),
      })
      .select('id, status')
      .single();

    if (createError) {
      throw createError;
    }

    setThread(created as ChatThread);
    return created.id;
  }, []);

  const fetchFaqs = React.useCallback(async () => {
    try {
      setFaqLoading(true);
      setFaqError('');
      const { data, error: fetchError } = await supabase
        .from('faq_categories')
        .select(
          `
          id,
          name,
          faq_questions (
            id,
            question,
            answer
          )
        `
        )
        .order('id', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      const categories = (data || []) as FAQCategory[];
      setFaqCategories(categories);
      if (categories.length > 0) {
        setFaqActiveCategory((prev) => prev ?? categories[0].id);
      }
    } catch (e: any) {
      setFaqError(e?.message || 'Failed to load FAQs.');
    } finally {
      setFaqLoading(false);
    }
  }, []);

  const initializeChat = React.useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const threadId = await ensureThread();
      await loadMessages(threadId);

      stopPolling();
      pollRef.current = setInterval(() => {
        loadMessages(threadId).catch((pollError) => {
          console.error('chat poll error:', pollError);
        });
      }, POLL_MS);
    } catch (initError: any) {
      const msg = initError?.message || 'Failed to initialize chat.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [ensureThread, loadMessages, stopPolling]);

  useEffect(() => {
    void fetchFaqs();
  }, [fetchFaqs]);

  useEffect(() => {
    if (supportMode !== 'live') {
      stopPolling();
      return;
    }

    void initializeChat();

    return () => {
      stopPolling();
    };
  }, [initializeChat, stopPolling, supportMode]);

  const toggleFaqQuestion = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFaqOpenQuestion((prev) => (prev === id ? null : id));
  };

  useFocusEffect(
    React.useCallback(() => {
      if (supportMode !== 'live' || !thread?.id) {
        return;
      }

      loadMessages(thread.id).catch((focusError) => {
        console.error('chat focus refresh error:', focusError);
      });
    }, [loadMessages, supportMode, thread?.id])
  );

  const sendMessage = async () => {
    if (!thread?.id || !canSend || sending) {
      return;
    }

    const body = text.trim();
    if (!body) {
      return;
    }

    try {
      setSending(true);
      setError('');

      const { error: insertError } = await supabase.from('chat_messages').insert({
        thread_id: thread.id,
        sender_type: 'user',
        sender_name: userName || 'User',
        sender_email: userEmail || null,
        body,
        read_by_admin: false,
        read_by_user: true,
      });

      if (insertError) {
        throw insertError;
      }

      await supabase
        .from('chat_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', thread.id);

      setText('');
      await loadMessages(thread.id);
    } catch (sendError: any) {
      console.error('send chat message error:', sendError);
      setError(sendError?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopBar />

      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#222" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Contact Service</Text>
          <Text style={styles.headerSubtitle}>Chat with customer support</Text>
        </View>
      </View>

      <View style={styles.supportModeRow}>
        <TouchableOpacity
          style={[styles.supportModeBtn, supportMode === 'live' && styles.supportModeBtnActive]}
          onPress={() => setSupportMode('live')}
          activeOpacity={0.85}
        >
          <Ionicons name="headset" size={16} color={supportMode === 'live' ? '#fff' : '#374151'} />
          <Text style={[styles.supportModeText, supportMode === 'live' && styles.supportModeTextActive]}>
            Live Chat
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.supportModeBtn, supportMode === 'quick' && styles.supportModeBtnActive]}
          onPress={() => setSupportMode('quick')}
          activeOpacity={0.85}
        >
          <Ionicons name="help-circle-outline" size={16} color={supportMode === 'quick' ? '#fff' : '#374151'} />
          <Text style={[styles.supportModeText, supportMode === 'quick' && styles.supportModeTextActive]}>
            Quick Help
          </Text>
        </TouchableOpacity>
      </View>

      {supportMode === 'live' ? (
        loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color="#a81d1d" />
            <Text style={styles.loadingText}>Initializing chat…</Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            style={styles.chatWrap}
          >
            {!!error && <Text style={styles.errorText}>{error}</Text>}

            {thread?.status === 'pending' && (
              <View style={styles.statusBanner}>
                <Ionicons name="time-outline" size={16} color="#92400e" />
                <Text style={styles.statusText}>Waiting for an agent…</Text>
              </View>
            )}

            {thread?.status === 'resolved' && (
              <View style={styles.statusBannerResolved}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#166534" />
                <Text style={styles.statusTextResolved}>This chat is resolved.</Text>
              </View>
            )}

            <ScrollView
              ref={scrollRef}
              style={styles.messagesScroll}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="chatbubble-ellipses-outline" size={40} color="#bbb" />
                  <Text style={styles.emptyText}>No messages yet. Start the conversation.</Text>
                </View>
              ) : (
                messages.map((message) => {
                  const mine = message.sender_type === 'user' || message.sender_type === 'visitor';
                  return (
                    <View key={message.id} style={[styles.messageRow, mine ? styles.messageMineRow : styles.messageOtherRow]}>
                      <View style={[styles.messageBubble, mine ? styles.messageMine : styles.messageOther]}>
                        {!!message.body && (
                          <Text style={[styles.messageText, mine ? styles.messageTextMine : styles.messageTextOther]}>
                            {message.body}
                          </Text>
                        )}
                        <Text style={[styles.messageTime, mine ? styles.messageTimeMine : styles.messageTimeOther]}>
                          {formatTime(message.created_at)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Type your message…"
                value={text}
                onChangeText={setText}
                editable={canSend && !sending}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!canSend || sending) && styles.sendBtnDisabled]}
                disabled={!canSend || sending}
                onPress={sendMessage}
              >
                {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )
      ) : (
        <View style={styles.faqWrap}>
          {faqLoading ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator size="large" color="#a81d1d" />
              <Text style={styles.loadingText}>Loading FAQs…</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.faqContent}>
              {!!faqError && <Text style={styles.errorText}>{faqError}</Text>}

              {!!quickFaqQuestions.length && (
                <View style={styles.quickFaqCard}>
                  <Text style={styles.quickFaqHeading}>You may want to ask:</Text>
                  {quickFaqQuestions.map((faqItem) => (
                    <View key={faqItem.id} style={styles.quickFaqItem}>
                      <TouchableOpacity
                        onPress={() => setQuickFaqOpenQuestion((prev) => (prev === faqItem.id ? null : faqItem.id))}
                        activeOpacity={0.85}
                        style={styles.quickFaqQuestionBtn}
                      >
                        <Text style={styles.quickFaqQuestionText}>{faqItem.question}</Text>
                      </TouchableOpacity>
                      {quickFaqOpenQuestion === faqItem.id && (
                        <View style={styles.quickFaqAnswerWrap}>
                          <Text style={styles.quickFaqCategoryText}>{faqItem.categoryName}</Text>
                          <RichText html={faqItem.answer} baseStyle={styles.quickFaqAnswerText} />
                        </View>
                      )}
                    </View>
                  ))}

                  {faqQuestionPool.length > QUICK_FAQ_BATCH_SIZE && (
                    <TouchableOpacity
                      style={styles.quickFaqChangeBtn}
                      onPress={() => {
                        setQuickFaqOpenQuestion(null);
                        setQuickFaqPage((prev) => (prev + 1) % quickFaqPageCount);
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="refresh" size={16} color="#6b7280" />
                      <Text style={styles.quickFaqChangeText}>Change Questions</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.faqCategoriesRow}>
                {faqCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.faqCategoryBtn, faqActiveCategory === cat.id && styles.faqCategoryBtnActive]}
                    onPress={() => {
                      setFaqActiveCategory(cat.id);
                      setFaqOpenQuestion(null);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.faqCategoryText, faqActiveCategory === cat.id && styles.faqCategoryTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.faqList}>
                {(faqCategories.find((c) => c.id === faqActiveCategory)?.faq_questions || []).map((q) => (
                  <View key={q.id} style={styles.faqItem}>
                    <TouchableOpacity onPress={() => toggleFaqQuestion(q.id)} style={styles.faqQuestionRow} activeOpacity={0.85}>
                      <Text style={styles.faqQuestionText}>{q.question}</Text>
                      <Text style={styles.faqToggleIcon}>{faqOpenQuestion === q.id ? '−' : '+'}</Text>
                    </TouchableOpacity>
                    {faqOpenQuestion === q.id && (
                      <View style={styles.faqAnswerBox}>
                        <RichText html={q.answer} baseStyle={styles.faqAnswerText} />
                      </View>
                    )}
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.switchToLiveBtn} onPress={() => setSupportMode('live')} activeOpacity={0.85}>
                <Text style={styles.switchToLiveText}>Need an agent? Switch to Live Chat</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      )}

      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    padding: 4,
    marginRight: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  chatWrap: {
    flex: 1,
    paddingBottom: 76,
  },
  faqWrap: {
    flex: 1,
    paddingBottom: 76,
  },
  faqContent: {
    paddingBottom: 14,
  },
  faqCategoriesRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
  },
  faqCategoryBtn: {
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  faqCategoryBtnActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  faqCategoryText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 13,
  },
  faqCategoryTextActive: {
    color: '#fff',
  },
  faqList: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10,
    overflow: 'hidden',
  },
  faqQuestionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  faqQuestionText: {
    flex: 1,
    color: '#111',
    fontWeight: '700',
    fontSize: 14,
  },
  faqToggleIcon: {
    color: '#a81d1d',
    fontWeight: '900',
    fontSize: 18,
    width: 18,
    textAlign: 'center',
  },
  faqAnswerBox: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  faqAnswerText: {
    color: '#444',
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: '#b91c1c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
  },
  statusBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fef3c7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBannerResolved: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#dcfce7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    color: '#92400e',
    fontSize: 12,
    flex: 1,
  },
  statusTextResolved: {
    color: '#166534',
    fontSize: 12,
    flex: 1,
  },
  supportModeRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
  },
  supportModeBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  supportModeBtnActive: {
    borderColor: '#a81d1d',
    backgroundColor: '#a81d1d',
  },
  supportModeText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 13,
  },
  supportModeTextActive: {
    color: '#fff',
  },
  quickModeScroll: {
    flex: 1,
  },
  quickModeContent: {
    paddingBottom: 16,
  },
  quickFaqCard: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    overflow: 'hidden',
  },
  quickFaqHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  quickFaqItem: {
    borderTopWidth: 1,
    borderTopColor: '#eceff3',
  },
  quickFaqQuestionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quickFaqQuestionText: {
    color: '#2563eb',
    fontSize: 15,
    lineHeight: 21,
  },
  quickFaqAnswerWrap: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  quickFaqCategoryText: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  quickFaqAnswerText: {
    color: '#374151',
    fontSize: 13,
    lineHeight: 19,
  },
  quickFaqChangeBtn: {
    borderTopWidth: 1,
    borderTopColor: '#eceff3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  quickFaqChangeText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
  inlineFaqCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    overflow: 'hidden',
  },
  inlineFaqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  inlineFaqTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  inlineFaqViewAll: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
  },
  inlineFaqItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f5f7',
  },
  inlineFaqQuestion: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  inlineFaqAnswer: {
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 18,
  },
  switchToLiveBtn: {
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a81d1d',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff5f5',
  },
  switchToLiveText: {
    color: '#a81d1d',
    fontWeight: '700',
    fontSize: 13,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    marginTop: 10,
    color: '#999',
    fontSize: 13,
  },
  messageRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  messageMineRow: {
    justifyContent: 'flex-end',
  },
  messageOtherRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  messageMine: {
    backgroundColor: '#a81d1d',
    borderBottomRightRadius: 4,
  },
  messageOther: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 19,
  },
  messageTextMine: {
    color: '#fff',
  },
  messageTextOther: {
    color: '#111',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  messageTimeMine: {
    color: '#fdd',
    textAlign: 'right',
  },
  messageTimeOther: {
    color: '#666',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#111',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#a81d1d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#bfbfbf',
  },
});