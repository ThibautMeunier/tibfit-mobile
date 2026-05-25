import React, { useCallback, useEffect, useRef, useState } from 'react';
import LottieView from 'lottie-react-native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
  Animated,
  Easing,
} from 'react-native';
import { Sheet } from '../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { C, sessionColor } from '../constants/colors';
import Icon from '../components/Icon';
import {
  getPlans,
  chatPlan,
  getConversation,
  deleteConversation,
  ChatPlanResult,
} from '../services/api';
import { Plan } from '../types';
import { usePurchase } from '../context/PurchaseContext';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  operations?: string[];
  loading?: boolean;
}

const KEYBOARD_ANIM_MS = 200;

function buildMessages(history: { id: number; role: string; content: string }[]): Message[] {
  return history.map((m) => ({
    id: String(m.id),
    role: m.role === 'user' ? 'user' : 'ai',
    text: m.content,
  }));
}

export default function ChatScreen() {
  const { t } = useTranslation();
  const QUICK_ACTIONS = t('chat.quickActions', { returnObjects: true }) as string[];
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { showPaywall } = usePurchase();

  const INITIAL_MESSAGE: Message = {
    id: '0',
    role: 'ai',
    text: t('chat.initialMessage'),
  };

  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopyMessage(id: string, text: string) {
    await Clipboard.setStringAsync(text);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }
  const flatListRef = useRef<FlatList>(null);
  const keyboardOffset = useRef(new Animated.Value(insets.bottom)).current;
  const initialLoadDone = useRef(false);

  const activePlan = plans.find((p) => p.id === activePlanId) ?? null;

  useFocusEffect(
    useCallback(() => {
      async function loadPlans() {
        try {
          const ps = await getPlans();
          setPlans(ps);
          if (ps.length === 0) return;

          if (!initialLoadDone.current) {
            initialLoadDone.current = true;
            const planId = ps[0].id;
            setActivePlanId(planId);
            const history = await getConversation(planId);
            if (history.length > 0) setMessages(buildMessages(history));
          } else {
            // Refresh list; if active plan was deleted, fall back to first
            setPlans(ps);
            const stillExists = ps.some((p) => p.id === activePlanId);
            if (!stillExists) {
              const planId = ps[0].id;
              setActivePlanId(planId);
              const history = await getConversation(planId);
              setMessages(history.length > 0 ? buildMessages(history) : [INITIAL_MESSAGE]);
            }
          }
        } catch {
          // silent
        }
      }
      loadPlans();
    }, [activePlanId]),
  );

  async function handleSelectPlan(planId: number) {
    setSelectorVisible(false);
    if (planId === activePlanId) return;
    setActivePlanId(planId);
    setMessages([INITIAL_MESSAGE]);
    try {
      const history = await getConversation(planId);
      if (history.length > 0) setMessages(buildMessages(history));
    } catch {
      // silent
    }
  }

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: msg };
    const loadingMsg: Message = { id: 'loading', role: 'ai', text: '', loading: true };
    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    try {
      if (activePlanId === null) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === 'loading'
              ? { id: Date.now().toString(), role: 'ai' as const, text: t('chat.noPlanMsg') }
              : m,
          ),
        );
        return;
      }

      const result: ChatPlanResult = await chatPlan(activePlanId, msg);
      const aiMsg: Message = {
        id: Date.now().toString(),
        role: 'ai',
        text: result.message,
        operations: result.operations_appliquees > 0 ? result.detail_operations : undefined,
      };
      setMessages((prev) => prev.map((m) => (m.id === 'loading' ? aiMsg : m)));
    } catch (e: any) {
      if (e?.message === 'PREMIUM_REQUIRED') {
        setMessages((prev) => prev.filter((m) => m.id !== 'loading'));
        showPaywall();
      } else {
        const errorText = e?.message ?? t('chat.alertGenericError');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === 'loading'
              ? { id: Date.now().toString(), role: 'ai' as const, text: errorText }
              : m,
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [input, loading, activePlanId]);

  async function handleResetConversation() {
    if (activePlanId === null) return;
    Alert.alert(
      t('chat.alertResetTitle'),
      t('chat.alertResetMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chat.alertResetConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation(activePlanId);
              setMessages([INITIAL_MESSAGE]);
            } catch {
              Alert.alert(t('common.error'), t('chat.alertResetError'));
            }
          },
        },
      ],
    );
  }

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const animate = (toValue: number) =>
      Animated.timing(keyboardOffset, {
        toValue,
        duration: KEYBOARD_ANIM_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    const show = Keyboard.addListener('keyboardWillShow', (e) =>
      animate(e.endCoordinates.height - tabBarHeight + insets.bottom),
    );
    const hide = Keyboard.addListener('keyboardWillHide', () =>
      animate(insets.bottom),
    );
    return () => { show.remove(); hide.remove(); };
  }, [tabBarHeight, insets.bottom]);

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgWrapper, isUser ? styles.msgWrapperUser : styles.msgWrapperAi]}>
        {!isUser && (
          <LottieView source={require('../../assets/Fibi.json')} autoPlay loop style={{ width: 32, height: 32, flexShrink: 0, alignSelf: 'flex-end' }} />
        )}
        <View style={{ maxWidth: '75%' }}>
          <TouchableOpacity
            onLongPress={() => !item.loading && handleCopyMessage(item.id, item.text)}
            activeOpacity={0.85}
            delayLongPress={400}
          >
            <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
              {item.loading ? (
                <View style={styles.typingDots}>
                  {[0, 1, 2].map((i) => <View key={i} style={styles.dot} />)}
                </View>
              ) : (
                <Text style={styles.bubbleText}>{item.text}</Text>
              )}
            </View>
            {copiedId === item.id && (
              <Text style={[styles.copiedLabel, isUser ? styles.copiedLabelUser : styles.copiedLabelAi]}>
                {t('chat.copied')}
              </Text>
            )}
          </TouchableOpacity>
          {item.operations && item.operations.length > 0 && (
            <View style={styles.operationsCard}>
              <View style={styles.operationsHeader}>
                <Icon name="check" size={12} color={C.green} />
                <Text style={styles.operationsTitle}>
                  {t('chat.operationsApplied', { count: item.operations.length })}
                </Text>
              </View>
              {item.operations.map((op, i) => (
                <Text key={i} style={styles.operationItem}>· {op}</Text>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  }

  const planColor = activePlan ? sessionColor(activePlan.couleur) : C.blue;

  return (
    <Animated.View style={[styles.root, { paddingBottom: keyboardOffset }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.coachInfo}>
          <View style={styles.coachAvatar}>
            <LottieView
              source={require('../../assets/Fibi.json')}
              autoPlay
              loop
              style={{ width: 32, height: 32 }}
            />
          </View>
          <View>
            <Text style={styles.coachName}>{t('dashboard.coachAI')}</Text>
            <Text style={styles.coachStatus}>{t('chat.online')}</Text>
          </View>
        </View>
        {activePlanId !== null && (
          <TouchableOpacity onPress={handleResetConversation} style={styles.resetBtn}>
            <Icon name="refresh" size={14} color={C.text3} />
          </TouchableOpacity>
        )}
      </View>

      {/* Plan selector bar */}
      {plans.length > 0 && (
        <TouchableOpacity
          style={[styles.planBar, { borderLeftColor: planColor }]}
          onPress={() => setSelectorVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.planBarEmoji}>{activePlan?.emoji ?? '📋'}</Text>
          <Text style={styles.planBarTitle} numberOfLines={1}>
            {activePlan?.titre ?? t('chat.selectPlan')}
          </Text>
          <Icon name="chevronRight" size={12} color={C.text3} />
        </TouchableOpacity>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Quick actions */}
      {inputFocused && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickScroll}
          contentContainerStyle={styles.quickContent}
          keyboardShouldPersistTaps="handled"
        >
          {QUICK_ACTIONS.map((q, i) => (
            <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => send(q)}>
              <Text style={styles.quickBtnLabel}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t('chat.inputPlaceholder')}
          placeholderTextColor={C.text3}
          style={styles.input}
          onSubmitEditing={() => send()}
          returnKeyType="send"
          multiline
          autoCorrect
          autoCapitalize="sentences"
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => send()}
          disabled={!input.trim() || loading}
        >
          {loading
            ? <ActivityIndicator size="small" color={C.text3} />
            : <Icon name="send" size={16} color={input.trim() ? '#fff' : C.text3} />
          }
        </TouchableOpacity>
      </View>

      <Sheet
        visible={selectorVisible}
        onClose={() => setSelectorVisible(false)}
        title={t('chat.choosePlan')}
      >
        {plans.map((p) => {
          const color = sessionColor(p.couleur);
          const isActive = p.id === activePlanId;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.planRow, isActive && styles.planRowActive]}
              onPress={() => handleSelectPlan(p.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.planRowAccent, { backgroundColor: color }]} />
              <Text style={styles.planRowEmoji}>{p.emoji ?? '📋'}</Text>
              <Text style={[styles.planRowTitle, isActive && { color: C.text }]} numberOfLines={1}>
                {p.titre}
              </Text>
              {isActive && <Icon name="check" size={14} color={color} />}
            </TouchableOpacity>
          );
        })}
      </Sheet>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  coachInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coachAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.blueLight, borderWidth: 1, borderColor: C.blue + '50',
    alignItems: 'center', justifyContent: 'center',
  },
  coachName: { fontSize: 14, fontWeight: '700', color: C.text },
  coachStatus: { fontSize: 11, color: C.green, fontWeight: '500' },
  resetBtn: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, padding: 8,
  },

  planBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
    borderLeftWidth: 3,
  },
  planBarEmoji: { fontSize: 14 },
  planBarTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: C.text2 },

  messageList: { padding: 16, gap: 12, flexGrow: 1 },

  msgWrapper: { flexDirection: 'row', gap: 8 },
  msgWrapperUser: { justifyContent: 'flex-end' },
  msgWrapperAi: { justifyContent: 'flex-start', alignItems: 'flex-end' },

  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.blueLight, borderWidth: 1, borderColor: C.blue + '30',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-end',
  },
  bubble: { paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: C.blue, borderRadius: 16, borderBottomRightRadius: 4 },
  bubbleAi: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 13, color: C.text, lineHeight: 20 },
  copiedLabel: { fontSize: 11, marginTop: 4 },
  copiedLabelUser: { color: C.text3, textAlign: 'right' },
  copiedLabelAi: { color: C.text3, textAlign: 'left' },

  typingDots: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.blue, opacity: 0.6 },

  operationsCard: {
    marginTop: 6, backgroundColor: C.greenLight,
    borderWidth: 1, borderColor: C.green + '40',
    borderRadius: 10, padding: 10,
  },
  operationsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  operationsTitle: { fontSize: 12, fontWeight: '700', color: C.green },
  operationItem: { fontSize: 11, color: C.green, lineHeight: 18, opacity: 0.85 },

  quickScroll: { flexShrink: 0 },
  quickContent: { paddingHorizontal: 20, paddingVertical: 8, gap: 6 },
  quickBtn: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.blue + '40',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  quickBtnLabel: { fontSize: 11, color: C.blue, fontWeight: '500' },

  inputRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 8 },
  input: {
    flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    color: C.text, fontSize: 13, maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: C.blue, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end',
  },
  sendBtnDisabled: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },

  planRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  planRowActive: { opacity: 1 },
  planRowAccent: { width: 3, height: 32, borderRadius: 2 },
  planRowEmoji: { fontSize: 18 },
  planRowTitle: { flex: 1, fontSize: 14, fontWeight: '500', color: C.text2 },
});
