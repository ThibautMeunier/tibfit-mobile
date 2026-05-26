import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/colors';
import { RootStackParamList, Seance, SeanceSection, WorkoutStep } from '../types';
import * as Haptics from 'expo-haptics';
import { patchSeance, chatSeance, getMe } from '../services/api';
import { addPendingAction, updateSeanceInCache } from '../services/offlineCache';
import { isAuthorized, canReadWorkoutMetrics, saveWorkout, readWorkoutMetrics } from '../services/healthService';
import { isWorkoutKitAvailable, createWorkoutOnWatch } from '../services/workoutKit';
import { useAuth } from '../context/AuthContext';
import { usePurchase } from '../context/PurchaseContext';
import Icon from '../components/Icon';
import LottieView from 'lottie-react-native';
import DiscoveryResultSheet from '../components/DiscoveryResultSheet';
import ZoneBadge from '../components/ZoneBadge';
import OfflineBanner from '../components/OfflineBanner';
import { useTranslation } from 'react-i18next';
import { SectionLabel, Textarea } from '../components/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  patch?: Record<string, unknown>;
}

function makeFormatDateShort(locale: string) {
  return function formatDateShort(d: string): string {
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };
}

function sectionColor(titre: string): { color: string; icon: string } {
  const tl = titre.toLowerCase();
  if (tl.includes('échauffement') || tl.includes('chauffe') || tl.includes('warm')) return { color: '#94A3B8', icon: '🌡️' };
  if (tl.includes('retour') || tl.includes('calme') || tl.includes('récup') || tl.includes('cool') || tl.includes('recovery')) return { color: C.green, icon: '🧘' };
  return { color: C.blue, icon: '⚡' };
}

export default function SessionScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const formatDateShort = makeFormatDateShort(i18n.language);
  const { seance: initialSeance, planCouleur, planSport } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showPaywall } = usePurchase();

  // Local state mirrors the seance and updates when the AI patches it
  const [seance, setSeance] = useState<Seance>(initialSeance);
  const [completed, setCompleted] = useState(initialSeance.completee);
  const [completing, setCompleting] = useState(false);
  const [hkSaved, setHkSaved] = useState(!!initialSeance.hk_workout_id);
  const [hkSaving, setHkSaving] = useState(false);
  const [hkAuthorized, setHkAuthorized] = useState(false);
  const [hkCanRead, setHkCanRead] = useState(false);
  const [watchAvailable, setWatchAvailable] = useState(false);
  const [watchSent, setWatchSent] = useState(false);
  const [watchSending, setWatchSending] = useState(false);
  const [discoveryPopupVisible, setDiscoveryPopupVisible] = useState(false);
  const [pendingStreak, setPendingStreak] = useState<{ count: number; planCouleur?: string; planId?: number } | null>(null);
  const afterDiscoveryCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    isAuthorized().then(setHkAuthorized);
    canReadWorkoutMetrics().then(setHkCanRead);
    isWorkoutKitAvailable().then(setWatchAvailable);
  }, []);
  const [note, setNote] = useState(initialSeance.note ?? '');
  const [pendingSync, setPendingSync] = useState(false);
  const accentColor = planCouleur ?? C.blue;

  // AI chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function handleComplete() {
    const newValue = !completed;
    setCompleting(true);
    let proceed = false;
    let streakIncreased = false;
    let planStreak = 0;
    try {
      const result = await patchSeance(seance.id, { completee: newValue });
      if (newValue && result.streak_increased) {
        streakIncreased = true;
        planStreak = result.plan_streak ?? 0;
      }
      proceed = true;
    } catch (e: any) {
      if (e?.message === 'SESSION_EXPIRED') { setCompleting(false); return; }
      await addPendingAction(seance.id, { completee: newValue });
      await updateSeanceInCache(seance.id, { completee: newValue });
      setPendingSync(true);
      proceed = true;
    } finally {
      setCompleting(false);
    }
    if (!proceed) return;
    setCompleted(newValue);
    await Haptics.notificationAsync(
      newValue ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    );
    // Popup résultat séance test si la séance est une calibration de métrique
    if (newValue && seance.discovery_metric_id) {
      if (streakIncreased) {
        const me = await getMe().catch(() => null);
        const totalStreak = me?.streak ?? (user?.streak ?? 0) + 1;
        setPendingStreak({ count: totalStreak, planCouleur, planId: seance.plan_id });
      }
      setDiscoveryPopupVisible(true);
    } else if (streakIncreased) {
      const me = await getMe().catch(() => null);
      const totalStreak = me?.streak ?? (user?.streak ?? 0) + 1;
      navigation.navigate('StreakCelebration', { streakCount: totalStreak, planCouleur, planId: seance.plan_id });
    }
    // Lecture HealthKit uniquement si la lecture est autorisée
    if (newValue && hkCanRead) {
      readWorkoutMetrics(seance.date).then((m) => {
        // Pré-remplissage de la note (cosmétique, toujours OK si un workout existe)
        if (!note.trim() && hkSaved && (m.hrMean || m.hrMax || m.calories)) {
          const parts: string[] = [];
          if (m.hrMean)   parts.push(t('session.hrMean', { value: m.hrMean }));
          if (m.hrMax)    parts.push(t('session.hrMax', { value: m.hrMax }));
          if (m.calories) parts.push(t('session.calories', { value: m.calories }));
          if (parts.length > 0) setNote(parts.join(' · '));
        }
        // Persistance en base uniquement si un workout HealthKit existe réellement
        // (évite de persister la FC passive si la séance est marquée sans avoir été faite)
        if (hkSaved && (m.hrMean || m.hrMax || m.calories)) {
          patchSeance(seance.id, {
            hr_mean: m.hrMean,
            hr_max: m.hrMax,
            calories_reelles: m.calories,
          }).catch(() => {});
        }
      });
    }
  }

  async function handleSaveToHealth() {
    setHkSaving(true);
    try {
      const uuid = await saveWorkout(seance, planSport, user?.poids_kg_actuel);
      if (uuid) {
        await patchSeance(seance.id, { hk_workout_id: uuid });
        setHkSaved(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Maintenant qu'un workout réel existe, on peut persister les métriques
        if (hkCanRead) {
          readWorkoutMetrics(seance.date).then((m) => {
            if (m.hrMean || m.hrMax || m.calories) {
              patchSeance(seance.id, {
                hr_mean: m.hrMean,
                hr_max: m.hrMax,
                calories_reelles: m.calories,
              }).catch(() => {});
            }
          });
        }
      } else {
        Alert.alert(t('common.error'), t('session.alertHealthError', { context: Platform.OS }));
      }
    } catch {
      Alert.alert(t('common.error'), t('session.alertHealthError', { context: Platform.OS }));
    } finally {
      setHkSaving(false);
    }
  }

  async function handleCreateWorkout() {
    setWatchSending(true);
    try {
      const result = await createWorkoutOnWatch(seance, planSport);
      if (result === 'unsupported_activity') {
        Alert.alert(
          t('session.alertWatchUnsupported'),
          t('session.alertWatchUnsupportedMsg'),
        );
      } else if (result && result !== 'unsupported_activity') {
        setWatchSent(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Apple Watch', t('session.alertWatchCreated'));
        patchSeance(seance.id, { wk_workout_id: result }).catch(() => {});
      } else {
        Alert.alert(t('common.error'), t('session.alertWatchError'));
      }
    } catch {
      Alert.alert(t('common.error'), t('session.alertWatchError'));
    } finally {
      setWatchSending(false);
    }
  }

  async function handleSaveNote() {
    try {
      await patchSeance(seance.id, { note });
    } catch (e: any) {
      if (e?.message === 'SESSION_EXPIRED') return;
      await addPendingAction(seance.id, { note });
      await updateSeanceInCache(seance.id, { note });
      setPendingSync(true);
    }
  }

  async function handleChatSend(text?: string) {
    const msg = (text ?? chatInput).trim();
    if (!msg || chatLoading) return;
    setChatInput('');

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: msg };
    const loadingMsg: ChatMessage = { id: 'loading', role: 'ai', text: '' };
    setChatMessages((prev) => [...prev, userMsg, loadingMsg]);
    setChatLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const result = await chatSeance(seance.id, msg);

      const aiMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'ai',
        text: result.message,
        patch: Object.keys(result.patch).length > 0 ? result.patch : undefined,
      };
      setChatMessages((prev) => prev.map((m) => (m.id === 'loading' ? aiMsg : m)));

      // Apply patch to local state so changes are immediately visible
      if (Object.keys(result.patch).length > 0) {
        setSeance((prev) => {
          const updated = { ...prev };
          if (result.patch.titre) updated.titre = result.patch.titre as string;
          if (result.patch.duree_minutes) updated.duree_minutes = result.patch.duree_minutes as number;
          if (result.patch.sections) updated.sections = result.patch.sections as SeanceSection[];
          if (result.patch.workout_steps) updated.workout_steps = result.patch.workout_steps as WorkoutStep[];
          if (result.patch.date) updated.date = result.patch.date as string;
          return updated;
        });
        if (result.patch.emoji) {
          setSeance((prev) => ({ ...prev, emoji: result.patch.emoji as string }));
        }
      }
    } catch (e: any) {
      if (e?.message === 'PREMIUM_REQUIRED') {
        setChatMessages((prev) => prev.filter((m) => m.id !== 'loading'));
        showPaywall();
      } else {
        const errorText = e?.message ?? t('session.alertGenericError');
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === 'loading'
              ? { id: Date.now().toString(), role: 'ai' as const, text: errorText }
              : m,
          ),
        );
      }
    } finally {
      setChatLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }

  const CHAT_SUGGESTIONS = t('session.quickPrompts', { returnObjects: true }) as string[];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.bottom}
    >
      {/* Header */}
      <View style={[styles.header, { borderLeftWidth: 4, borderLeftColor: accentColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevronLeft" size={18} color={C.blue} />
          <Text style={styles.backLabel}>{t('common.back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <View style={styles.headerLeft}>
            <Text style={styles.dateLabel}>{formatDateShort(seance.date)}</Text>
            <View style={styles.titleRow}>
              {seance.emoji ? <Text style={styles.titleEmoji}>{seance.emoji}</Text> : null}
              <Text style={styles.sessionTitle} numberOfLines={2}>{seance.titre}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <ZoneBadge zone={seance.zone} />
            <View style={styles.durationPill}>
              <Icon name="clock" size={13} color={C.text3} />
              <Text style={styles.durationText}>{seance.duree_minutes}min</Text>
            </View>
          </View>
        </View>
      </View>

      <OfflineBanner visible={pendingSync} message={t('session.pendingSync')} />

      {/* Scrollable content */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Workout sections */}
        {seance.sections.map((section, i) => {
          const { color, icon } = sectionColor(section.titre);
          const lines = section.contenu.split('\n').filter((l) => l.trim().length > 0);
          return (
            <View key={i} style={[styles.block, { borderColor: color + '30' }]}>
              <Text style={[styles.blockLabel, { color }]}>
                {icon} {section.titre.toUpperCase()}
              </Text>
              {lines.length > 1
                ? lines.map((line, j) => (
                    <View key={j} style={styles.bulletRow}>
                      <Text style={[styles.bulletDot, { color }]}>·</Text>
                      <Text style={styles.blockContent}>{line.trim()}</Text>
                    </View>
                  ))
                : <Text style={styles.blockContent}>{section.contenu}</Text>
              }
            </View>
          );
        })}

        {seance.sections.length === 0 && (
          <View style={styles.emptySections}>
            <Text style={styles.emptySectionsText}>{t('session.noDetails')}</Text>
          </View>
        )}

        {/* Complete button — toggleable */}
        <TouchableOpacity
          onPress={handleComplete}
          disabled={completing}
          activeOpacity={0.85}
          style={styles.completeBtnWrapper}
        >
          {completing ? (
            <View style={[styles.completeBtn, styles.completeBtnLoading]}>
              <Text style={[styles.completeBtnLabel, { color: C.blue }]}>{t('session.completing')}</Text>
            </View>
          ) : completed ? (
            <View style={[styles.completeBtn, styles.completeBtnDone]}>
              <Icon name="check" size={18} color={C.green} />
              <Text style={[styles.completeBtnLabel, { color: C.green }]}>{t('session.completedTap')}</Text>
            </View>
          ) : (
            <LinearGradient
              colors={[C.blue, '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.completeBtn}
            >
              <Text style={[styles.completeBtnLabel, { color: '#fff' }]}>
                {t('session.markComplete')}
              </Text>
            </LinearGradient>
          )}
        </TouchableOpacity>

        {/* Enregistrer dans Apple Santé */}
        {completed && hkAuthorized && (
          <TouchableOpacity
            onPress={handleSaveToHealth}
            disabled={hkSaved || hkSaving}
            activeOpacity={0.85}
            style={styles.completeBtnWrapper}
          >
            <View style={[styles.hkBtn, hkSaved && styles.hkBtnDone]}>
              {hkSaving ? (
                <ActivityIndicator color={hkSaved ? C.red : '#fff'} size="small" />
              ) : (
                <>
                  <Icon name="heart" size={16} color={hkSaved ? C.red : '#fff'} />
                  <Text style={[styles.hkBtnLabel, hkSaved && { color: C.red }]}>
                    {hkSaved ? t('session.savedToHealth', { context: Platform.OS }) : t('session.saveToHealth', { context: Platform.OS })}
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Envoyer sur Apple Watch */}
        {watchAvailable && (
          <TouchableOpacity
            onPress={handleCreateWorkout}
            disabled={watchSent || watchSending}
            activeOpacity={0.85}
            style={styles.completeBtnWrapper}
          >
            <View style={[styles.watchBtn, watchSent && styles.watchBtnDone]}>
              {watchSending ? (
                <ActivityIndicator color={watchSent ? C.blue : '#fff'} size="small" />
              ) : (
                <>
                  <Icon name="watch" size={16} color={watchSent ? C.blue : '#fff'} />
                  <Text style={[styles.watchBtnLabel, watchSent && { color: C.blue }]}>
                    {watchSent ? t('session.workoutCreated') : t('session.createWorkout')}
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Notes */}
        <View style={styles.notesSection}>
          <SectionLabel label={t('session.notesLabel')} />
          <Textarea
            value={note}
            onChangeText={setNote}
            onBlur={handleSaveNote}
            placeholder={t('session.notesPlaceholder')}
            numberOfLines={4}
          />
        </View>

        {/* ── AI Assistant ───────────────────────────────────────── */}
        <View style={styles.aiCard}>
          <View style={styles.aiCardHeader}>
            <LottieView source={require('../../assets/Fibi.json')} autoPlay loop style={{ width: 36, height: 36 }} />
            <Text style={styles.aiCardTitle}>{t('session.aiAssistant')}</Text>
          </View>

          {/* Chat history */}
          {chatMessages.length > 0 && (
            <View style={styles.chatHistory}>
              {chatMessages.map((m) => (
                <View key={m.id}>
                  <View style={[
                    styles.chatBubbleRow,
                    m.role === 'user' ? styles.chatBubbleRowUser : styles.chatBubbleRowAi,
                  ]}>
                    <View style={[
                      styles.chatBubble,
                      m.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAi,
                    ]}>
                      {m.id === 'loading' && m.text === '' ? (
                        <ActivityIndicator size="small" color={C.blue} />
                      ) : (
                        <Text style={styles.chatBubbleText}>{m.text}</Text>
                      )}
                    </View>
                  </View>
                  {/* Patch applied badge */}
                  {m.patch && Object.keys(m.patch).length > 0 && (
                    <View style={styles.patchBadge}>
                      <Icon name="check" size={11} color={C.green} />
                      <Text style={styles.patchBadgeText}>
                        {t('session.sessionModified', { keys: Object.keys(m.patch).join(', ') })}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Quick suggestions */}
          {chatMessages.length === 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestions}
            >
              {CHAT_SUGGESTIONS.map((s, i) => (
                <TouchableOpacity key={i} style={styles.suggestionBtn} onPress={() => handleChatSend(s)}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Input row */}
          <View style={styles.chatInputRow}>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder={t('session.chatPlaceholder')}
              placeholderTextColor={C.text3}
              style={styles.chatInput}
              onSubmitEditing={() => handleChatSend()}
              returnKeyType="send"
              autoCorrect
              autoCapitalize="sentences"
            />
            <TouchableOpacity
              onPress={() => handleChatSend()}
              disabled={!chatInput.trim() || chatLoading}
              style={[styles.chatSendBtn, (!chatInput.trim() || chatLoading) && styles.chatSendBtnDisabled]}
            >
              {chatLoading
                ? <ActivityIndicator size="small" color={C.text3} />
                : <Icon name="send" size={14} color={chatInput.trim() ? '#fff' : C.text3} />
              }
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {seance.discovery_metric_id && (
        <DiscoveryResultSheet
          visible={discoveryPopupVisible}
          discoveryMetricId={seance.discovery_metric_id}
          onAfterClose={() => {
            const action = afterDiscoveryCloseRef.current;
            afterDiscoveryCloseRef.current = null;
            action?.();
          }}
          onDone={() => {
            const streak = pendingStreak;
            setPendingStreak(null);
            if (streak) {
              afterDiscoveryCloseRef.current = () =>
                navigation.navigate('StreakCelebration', { streakCount: streak.count, planCouleur: streak.planCouleur, planId: streak.planId });
            }
            setDiscoveryPopupVisible(false);
          }}
          onSkip={() => {
            const streak = pendingStreak;
            setPendingStreak(null);
            if (streak) {
              afterDiscoveryCloseRef.current = () =>
                navigation.navigate('StreakCelebration', { streakCount: streak.count, planCouleur: streak.planCouleur, planId: streak.planId });
            }
            setDiscoveryPopupVisible(false);
          }}
          onRecalibrate={(metricId, planId) => {
            const streak = pendingStreak;
            setPendingStreak(null);
            if (!user?.is_premium) {
              afterDiscoveryCloseRef.current = () =>
                showPaywall(streak ? () =>
                  navigation.navigate('StreakCelebration', { streakCount: streak.count, planCouleur: streak.planCouleur, planId: streak.planId })
                : undefined);
            } else {
              afterDiscoveryCloseRef.current = () =>
                navigation.navigate('Recalibration', { metricId, planId, streakCount: streak?.count, planCouleur: streak?.planCouleur });
            }
            setDiscoveryPopupVisible(false);
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: { paddingHorizontal: 20, paddingLeft: 16, paddingBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleEmoji: { fontSize: 22 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, marginBottom: 8,
  },
  backLabel: { fontSize: 14, fontWeight: '500', color: C.blue },
  headerMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1, marginRight: 12 },
  dateLabel: {
    fontSize: 10, color: C.text3, fontWeight: '600',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4,
  },
  sessionTitle: { fontSize: 20, fontWeight: '700', color: C.text, lineHeight: 26 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  durationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.card, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border,
  },
  durationText: { fontSize: 12, color: C.text2 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  block: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, padding: 14, marginBottom: 10,
  },
  blockLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  blockContent: { fontSize: 13, color: C.text2, lineHeight: 20, flex: 1 },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  bulletDot: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  emptySections: {
    padding: 20, alignItems: 'center',
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  emptySectionsText: { fontSize: 13, color: C.text3 },

  completeBtnWrapper: { marginBottom: 14 },
  completeBtn: {
    width: '100%', padding: 16, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  completeBtnDone: { backgroundColor: C.greenLight, borderWidth: 1, borderColor: C.green + '50' },
  completeBtnLoading: { backgroundColor: C.blueLight, borderWidth: 1, borderColor: C.blue + '50' },
  completeBtnLabel: { fontSize: 15, fontWeight: '700' },

  hkBtn: {
    width: '100%', padding: 14, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.85)',
  },
  hkBtnDone: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  hkBtnLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },

  watchBtn: {
    width: '100%', padding: 14, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1C1C1E',
  },
  watchBtnDone: { backgroundColor: C.blueLight, borderWidth: 1, borderColor: C.blue + '50' },
  watchBtnLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },

  notesSection: { marginBottom: 14 },
  notesLabel: {
    fontSize: 11, color: C.text3, fontWeight: '600',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
  },
  notesInput: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 12, color: C.text,
    fontSize: 13, lineHeight: 20, height: 88, textAlignVertical: 'top',
  },

  // AI card
  aiCard: {
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 8,
  },
  aiCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  aiCardTitle: { fontSize: 13, fontWeight: '600', color: C.text },

  chatHistory: { padding: 12, gap: 8 },
  chatBubbleRow: { flexDirection: 'row' },
  chatBubbleRowUser: { justifyContent: 'flex-end' },
  chatBubbleRowAi: { justifyContent: 'flex-start' },
  chatBubble: { maxWidth: '80%', padding: 10, marginBottom: 2 },
  chatBubbleUser: { backgroundColor: C.blue, borderRadius: 12, borderBottomRightRadius: 3 },
  chatBubbleAi: {
    backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, borderBottomLeftRadius: 3,
  },
  chatBubbleText: { fontSize: 12, color: C.text, lineHeight: 18 },

  patchBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.greenLight, borderWidth: 1, borderColor: C.green + '30',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 6, alignSelf: 'flex-start',
  },
  patchBadgeText: { fontSize: 11, color: C.green, fontWeight: '600' },

  suggestions: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  suggestionBtn: {
    backgroundColor: C.bg2, borderWidth: 1, borderColor: C.blue + '30',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
  },
  suggestionText: { fontSize: 11, color: C.blue },

  chatInputRow: {
    flexDirection: 'row', gap: 8, padding: 10, alignItems: 'flex-end',
  },
  chatInput: {
    flex: 1, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: C.text, fontSize: 12,
  },
  chatSendBtn: {
    backgroundColor: C.blue, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  chatSendBtnDisabled: { backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border },
});
