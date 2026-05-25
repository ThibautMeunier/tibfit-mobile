import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard,
  LayoutAnimation,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/colors';
import { RootStackParamList } from '../types';
import { CatalogMetric, generatePlan, selectDaysForPlan, selectMetricsForPlan, upsertUserMetric, upsertPlanReview } from '../services/api';
import Icon from '../components/Icon';
import DaysSheet from '../components/DaysSheet';
import MetricsSheet from '../components/MetricsSheet';
import WarmupModeSheet from '../components/WarmupModeSheet';
import LottieView from 'lottie-react-native';
import { useAuth } from '../context/AuthContext';
import { usePurchase } from '../context/PurchaseContext';
import { useGeneration } from '../context/GenerationContext';
import { useTranslation } from 'react-i18next';
import { getTipAt, tipsCount } from '../constants/tips';
import { Textarea, Button } from '../components/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Generate'>;

export interface SeancePreview {
  titre: string;
  date: string;
  duree_minutes: number;
  emoji: string | null;
}

export function parseCompletedSeances(buffer: string): SeancePreview[] {
  const seancesIdx = buffer.indexOf('"seances"');
  if (seancesIdx === -1) return [];
  const arrayIdx = buffer.indexOf('[', seancesIdx);
  if (arrayIdx === -1) return [];

  const seances: SeancePreview[] = [];
  let pos = arrayIdx + 1;
  let inString = false;
  let depth = 0;
  let seanceStart = -1;

  while (pos < buffer.length) {
    const char = buffer[pos];
    if (inString) {
      if (char === '\\') { pos += 2; continue; }
      if (char === '"') inString = false;
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        if (depth === 0) seanceStart = pos;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && seanceStart !== -1) {
          try {
            const obj = JSON.parse(buffer.slice(seanceStart, pos + 1));
            if (obj.titre) {
              seances.push({
                titre: obj.titre,
                date: obj.date ?? '',
                duree_minutes: obj.duree_minutes ?? 0,
                emoji: obj.emoji ?? null,
              });
            }
          } catch { /* objet incomplet ou invalide */ }
          seanceStart = -1;
        }
      } else if (char === ']' && depth === 0) {
        break;
      }
    }
    pos++;
  }
  return seances;
}

export default function GenerateScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const EXAMPLES = t('generate.suggestions', { returnObjects: true }) as string[];
  const generation = useGeneration();
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<'input' | 'generating' | 'preview'>('input');
  const [progress, setProgress] = useState(0);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsData, setMetricsData] = useState<CatalogMetric[]>([]);
  const [warmupVisible, setWarmupVisible] = useState(false);
  const [missingMetrics, setMissingMetrics] = useState<string[]>([]);
  const [daysVisible, setDaysVisible] = useState(false);
  const [daysLoading, setDaysLoading] = useState(false);
  const [suggestedDays, setSuggestedDays] = useState<string[]>([]);
  const [suggestedWeeks, setSuggestedWeeks] = useState<number | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[] | null>(null);
  const [selectedWeeks, setSelectedWeeks] = useState<number>(4);
  const pendingMissingMetricsRef = React.useRef<string[]>([]);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * tipsCount(i18n.language, undefined)));
  const [streamingSeances, setStreamingSeances] = useState<SeancePreview[]>([]);
  const [ratingValue, setRatingValue] = useState<'up' | 'down' | null>(null);
  const [ratingReasons, setRatingReasons] = useState<string[]>([]);
  const [ratingFreetext, setRatingFreetext] = useState('');
  const [ratingSent, setRatingSent] = useState(false);
  const [ratingSending, setRatingSending] = useState(false);
  const tipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);
  const streamBufferRef = useRef('');
  const prevSeancesCountRef = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  useEffect(() => () => { isMounted.current = false; }, []);

  // Restaure l'état depuis le context global (retour depuis background ou autre écran)
  useEffect(() => {
    if (generation.status === 'done' && phase !== 'preview') {
      setPhase('preview');
      setGenerateError(null);
    } else if (generation.status === 'generating' && phase === 'input') {
      setPhase('generating');
    } else if (generation.status === 'idle' && phase !== 'input') {
      setPhase('input');
    }
  // Intentionnellement limité au montage + changements du context
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation.status]);

  useEffect(() => {
    if (phase !== 'generating') return;
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      Alert.alert(
        t('generate.leaveTitle'),
        t('generate.leaveMsg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('generate.leaveConfirm'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, phase, t]);

  useEffect(() => {
    if (phase === 'generating') {
      tipIntervalRef.current = setInterval(() => {
        setTipIndex(i => i + 1);
      }, 10000);
    } else {
      if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
    }
    return () => { if (tipIntervalRef.current) clearInterval(tipIntervalRef.current); };
  }, [phase]);

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showPaywall } = usePurchase();

  async function handleGenerateBtnPress() {
    if (!input.trim()) return;
    Keyboard.dismiss();
    setMetricsLoading(true);
    try {
      const metrics = await selectMetricsForPlan(input.trim());
      setMetricsData(metrics);
    } catch {
      // En cas d'erreur réseau, on génère directement sans popup
      setMetricsData([]);
    } finally {
      setMetricsLoading(false);
      setMetricsVisible(true);
    }
  }

  async function handleMetricsConfirm(values: Record<string, string>, missingBlockingIds: string[]) {
    setMetricsVisible(false);
    const saves = Object.entries(values).map(([metric_id, value]) =>
      upsertUserMetric(metric_id, value).catch(() => null)
    );
    await Promise.all(saves);
    pendingMissingMetricsRef.current = missingBlockingIds;
    openDaysPopup();
  }

  function handleMetricsSkip() {
    setMetricsVisible(false);
    pendingMissingMetricsRef.current = [];
    openDaysPopup();
  }

  async function openDaysPopup() {
    setDaysLoading(true);
    setDaysVisible(true);
    try {
      const result = await selectDaysForPlan(input.trim());
      setSuggestedDays(result.jours);
      setSuggestedWeeks(result.semaines);
    } catch {
      setSuggestedDays(['mardi', 'jeudi', 'samedi']);
      setSuggestedWeeks(null);
    } finally {
      setDaysLoading(false);
    }
  }

  function handleDaysConfirm(jours: string[], semaines: number) {
    setDaysVisible(false);
    setSelectedDays(jours);
    setSelectedWeeks(semaines);
    const missing = pendingMissingMetricsRef.current;
    if (missing.length > 0) {
      setMissingMetrics(missing);
      setWarmupVisible(true);
    } else {
      handleGenerate(null, [], jours, semaines);
    }
  }

  function handleDaysSkip() {
    setDaysVisible(false);
    setSelectedDays(null);
    const missing = pendingMissingMetricsRef.current;
    if (missing.length > 0) {
      setMissingMetrics(missing);
      setWarmupVisible(true);
    } else {
      handleGenerate(null, [], null, selectedWeeks);
    }
  }

  function handleWarmupSelect(mode: 'direct_test' | 'base_first') {
    setWarmupVisible(false);
    handleGenerate(mode, missingMetrics, selectedDays, selectedWeeks);
  }

  async function handleGenerate(
    warmupMode: 'direct_test' | 'base_first' | null = null,
    missingBlockingMetrics: string[] = [],
    joursSemaine: string[] | null = null,
    dureeSemaines: number = selectedWeeks,
  ) {
    setPhase('generating');
    setProgress(0);
    setStreamingSeances([]);
    streamBufferRef.current = '';
    prevSeancesCountRef.current = 0;
    setGenerateError(null);
    generation.startGeneration();

    await generatePlan(
      input.trim(),
      (chunk: string) => {
        if (!isMounted.current) return;
        streamBufferRef.current += chunk;
        // Progress estimée sur ~5000 chars (taille typique d'un plan JSON)
        setProgress(Math.min((streamBufferRef.current.length / 5000) * 90, 90));
        const newSeances = parseCompletedSeances(streamBufferRef.current);
        if (newSeances.length > prevSeancesCountRef.current) {
          prevSeancesCountRef.current = newSeances.length;
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setStreamingSeances(newSeances);
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
        }
      },
      (planId) => {
        generation.completeGeneration(planId);
        if (!isMounted.current) return;
        setProgress(100);
        setTimeout(() => { if (isMounted.current) setPhase('preview'); }, 400);
      },
      (errMsg) => {
        if (!isMounted.current) {
          if (errMsg !== 'PREMIUM_REQUIRED') generation.failGeneration();
          return;
        }
        if (errMsg === 'PREMIUM_REQUIRED') {
          generation.resetGeneration();
          setPhase('input');
          showPaywall();
          return;
        }
        generation.failGeneration();
        setGenerateError(errMsg);
        setPhase('preview');
      },
      warmupMode,
      missingBlockingMetrics,
      joursSemaine,
      dureeSemaines,
    );
  }

  function handleConfirm() {
    generation.resetGeneration();
    navigation.goBack();
  }

  function handleRestart() {
    generation.resetGeneration();
    setPhase('input');
    setInput('');
    setGenerateError(null);
    setRatingValue(null);
    setRatingReasons([]);
    setRatingFreetext('');
    setRatingSent(false);
  }

  async function handleRatingSubmit() {
    if (!generation.planId) return;
    setRatingSending(true);
    try {
      await upsertPlanReview(
        generation.planId,
        ratingValue,
        ratingValue === 'down' && ratingReasons.length > 0 ? ratingReasons : undefined,
        ratingValue === 'down' && ratingFreetext.trim() ? ratingFreetext.trim() : undefined,
      );
    } catch { /* silencieux — le feedback est best-effort */ }
    setRatingSent(true);
    setRatingSending(false);
  }

  function formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerFibi}>
          <View style={styles.headerAvatar}>
            <LottieView source={require('../../assets/Fibi.json')} autoPlay loop style={{ width: 28, height: 28 }} />
          </View>
          <Text style={styles.title}>{t('generate.title')}</Text>
        </View>
        {phase === 'input' && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Icon name="x" size={18} color={C.text2} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {phase === 'input' && (
          <>
            <View style={styles.fibiIntroRow}>
              <View style={styles.fibiIntroBubble}>
                <Text style={styles.fibiIntroText}>{t('generate.description')}</Text>
              </View>
            </View>

            {!user?.objectif && (
              <View style={styles.profileWarning}>
                <Icon name="person" size={13} color={C.orange} />
                <Text style={styles.profileWarningText}>
                  {t('generate.incompleteProfile')}
                </Text>
              </View>
            )}

            <Textarea
              value={input}
              onChangeText={setInput}
              placeholder={t('generate.textAreaPlaceholder')}
              numberOfLines={6}
            />

            <View style={styles.examplesSection}>
              <Text style={styles.examplesLabel}>{t('generate.examplesLabel')}</Text>
              {EXAMPLES.map((ex, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.exampleBtn}
                  onPress={() => setInput(ex)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.exampleText}>{ex}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              variant="primary"
              label={t('generate.generateBtn')}
              onPress={handleGenerateBtnPress}
              icon={<Icon name="bolt" size={16} color="#fff" />}
              full
              disabled={!input.trim() || metricsLoading}
            />
          </>
        )}

        {phase === 'generating' && (
          <View style={styles.generatingWrapper}>
            <LottieView source={require('../../assets/Fibi.json')} autoPlay loop style={{ width: 80, height: 80 }} />
            <Text style={styles.generatingTitle}>{t('generate.generatingTitle')}</Text>
            <Text style={styles.generatingSubtitle}>
              {streamingSeances.length > 0
                ? t('generate.seancesBuilding', { count: streamingSeances.length })
                : t('generate.generatingSubtitle')}
            </Text>

            {streamingSeances.length > 0 && (
              <View style={styles.streamingSeancesList}>
                {streamingSeances.map((s, i) => (
                  <View key={i} style={styles.seanceRow}>
                    <View style={styles.seanceIcon}>
                      <Text style={styles.seanceEmoji}>{s.emoji ?? '🏃'}</Text>
                    </View>
                    <View style={styles.seanceInfo}>
                      <Text style={styles.seanceTitle} numberOfLines={1}>{s.titre}</Text>
                      <Text style={styles.seanceMeta}>{formatDate(s.date)} · {s.duree_minutes} min</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.tipCard}>
              <View style={styles.tipHeader}>
                <LottieView source={require('../../assets/Fibi.json')} autoPlay loop style={{ width: 24, height: 24 }} />
                <Text style={styles.tipLabel}>{t('generate.tipLabel')}</Text>
              </View>
              <Text style={styles.tipText}>{getTipAt(i18n.language, user?.niveau, tipIndex)}</Text>
            </View>

            <View style={styles.progressTrack}>
              <LinearGradient
                colors={[C.blue, '#6366F1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progress}%` }]}
              />
            </View>

          </View>
        )}

        {phase === 'preview' && (
          <>
            {generateError ? (
              <View style={[styles.previewCard, styles.previewCardError]}>
                <View style={styles.previewHeader}>
                  <Icon name="x" size={16} color={C.red} />
                  <Text style={styles.previewErrorTitle}>{t('generate.errorTitle')}</Text>
                </View>
                <Text style={styles.previewText}>{generateError}</Text>
              </View>
            ) : (
              <>
                <View style={styles.previewCard}>
                  <View style={styles.previewHeader}>
                    <Icon name="check" size={16} color={C.green} />
                    <Text style={styles.previewSuccess}>{t('generate.successText')}</Text>
                  </View>
                </View>
                {generation.seances.length > 0 && (
                  <View style={styles.seancesList}>
                    {generation.seances.map((s) => (
                      <View key={s.id} style={styles.seanceRow}>
                        <View style={styles.seanceIcon}>
                          <Text style={styles.seanceEmoji}>{s.emoji ?? '🏃'}</Text>
                        </View>
                        <View style={styles.seanceInfo}>
                          <Text style={styles.seanceTitle} numberOfLines={1}>{s.titre}</Text>
                          <Text style={styles.seanceMeta}>{formatDate(s.date)} · {s.duree_minutes} min</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Rating */}
                <View style={styles.ratingCard}>
                  {ratingSent ? (
                    <Text style={styles.ratingThanks}>{t('generate.ratingThanks')}</Text>
                  ) : (
                    <>
                      <Text style={styles.ratingTitle}>{t('generate.ratingTitle')}</Text>
                      <Text style={styles.ratingSubtitle}>{t('generate.ratingSubtitle')}</Text>
                      <View style={styles.ratingBtns}>
                        <TouchableOpacity
                          style={[styles.ratingBtn, ratingValue === 'up' && styles.ratingBtnActive]}
                          onPress={() => setRatingValue(ratingValue === 'up' ? null : 'up')}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.ratingBtnEmoji}>{t('generate.ratingUp')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.ratingBtn, ratingValue === 'down' && styles.ratingBtnActive]}
                          onPress={() => setRatingValue(ratingValue === 'down' ? null : 'down')}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.ratingBtnEmoji}>{t('generate.ratingDown')}</Text>
                        </TouchableOpacity>
                      </View>

                      {ratingValue === 'down' && (
                        <>
                          <Text style={styles.ratingReasonsTitle}>{t('generate.ratingReasonsTitle')}</Text>
                          <View style={styles.ratingReasonsList}>
                            {(t('generate.ratingReasons', { returnObjects: true }) as string[]).map((reason) => {
                              const selected = ratingReasons.includes(reason);
                              return (
                                <TouchableOpacity
                                  key={reason}
                                  style={[styles.ratingReasonChip, selected && styles.ratingReasonChipSelected]}
                                  onPress={() => setRatingReasons(
                                    selected
                                      ? ratingReasons.filter(r => r !== reason)
                                      : [...ratingReasons, reason]
                                  )}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[styles.ratingReasonText, selected && styles.ratingReasonTextSelected]}>
                                    {reason}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          <TextInput
                            value={ratingFreetext}
                            onChangeText={setRatingFreetext}
                            placeholder={t('generate.ratingFreetextPlaceholder')}
                            placeholderTextColor={C.text3}
                            multiline
                            style={styles.ratingFreetext}
                          />
                        </>
                      )}

                      {ratingValue !== null && (
                        <View style={styles.ratingActions}>
                          <TouchableOpacity
                            style={styles.ratingSkipBtn}
                            onPress={() => setRatingSent(true)}
                          >
                            <Text style={styles.ratingSkipLabel}>{t('generate.ratingSkip')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.ratingSendBtn, ratingSending && { opacity: 0.6 }]}
                            onPress={handleRatingSubmit}
                            disabled={ratingSending}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.ratingSendLabel}>{t('generate.ratingSend')}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </View>
              </>
            )}

            <View style={styles.previewActions}>
              {generateError ? (
                <TouchableOpacity
                  style={styles.restartBtn}
                  onPress={handleRestart}
                >
                  <Text style={styles.restartBtnLabel}>{t('generate.restartBtn')}</Text>
                </TouchableOpacity>
              ) : (
                <Button
                  variant="success"
                  label={t('generate.confirmBtn')}
                  onPress={handleConfirm}
                  icon={<Icon name="check" size={16} color="#fff" />}
                  full
                />
              )}
            </View>
          </>
        )}
      </ScrollView>

      <MetricsSheet
        visible={metricsVisible}
        metrics={metricsData}
        loading={metricsLoading}
        onSkip={handleMetricsSkip}
        onConfirm={handleMetricsConfirm}
      />

      <DaysSheet
        visible={daysVisible}
        suggested={suggestedDays}
        loading={daysLoading}
        suggestedWeeks={suggestedWeeks}
        onConfirm={handleDaysConfirm}
        onSkip={handleDaysSkip}
      />

      <WarmupModeSheet
        visible={warmupVisible}
        missingMetricNames={missingMetrics.map(id => metricsData.find(m => m.id === id)?.name ?? id)}
        onSelect={handleWarmupSelect}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerFibi: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.blueLight, borderWidth: 1, borderColor: C.blue + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: C.text },

  fibiIntroRow: {
    marginBottom: 16,
  },
  fibiIntroBubble: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fibiIntroText: { fontSize: 13, color: C.text2, lineHeight: 20 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 8 },

  description: { fontSize: 13, color: C.text2, marginBottom: 12, lineHeight: 20 },

  profileWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.orangeLight,
    borderWidth: 1,
    borderColor: C.orange + '40',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  profileWarningText: {
    fontSize: 12,
    color: C.orange,
    lineHeight: 18,
    flex: 1,
  },

  textArea: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 16,
    color: C.text,
    fontSize: 14,
    lineHeight: 22,
    height: 140,
    textAlignVertical: 'top',
    marginBottom: 16,
  },

  examplesSection: { marginBottom: 20 },
  examplesLabel: {
    fontSize: 11,
    color: C.text3,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  exampleBtn: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
  },
  exampleText: { fontSize: 13, color: C.text2 },

  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 14,
  },
  generateBtnDisabled: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  generateBtnLabel: { fontSize: 15, fontWeight: '700' },

  generatingWrapper: { alignItems: 'center', paddingTop: 40 },
  generatingTitle: { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 8 },
  generatingSubtitle: { fontSize: 13, color: C.text3, marginBottom: 20 },
  streamingSeancesList: { width: '100%', gap: 8, marginBottom: 20 },
  tipCard: {
    width: '100%',
    backgroundColor: 'rgba(234,179,8,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.25)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  tipLabel: { fontSize: 12, fontWeight: '700', color: C.text },
  tipText: { fontSize: 13, color: C.text2, lineHeight: 19 },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: C.card,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressFill: { height: '100%', borderRadius: 999 },
  previewCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.green + '40',
    padding: 16,
    marginBottom: 20,
  },
  previewCardError: { borderColor: C.red + '40' },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  previewSuccess: { fontSize: 13, fontWeight: '700', color: C.green },
  previewErrorTitle: { fontSize: 13, fontWeight: '700', color: C.red },
  previewText: { fontSize: 13, color: C.text2, lineHeight: 21 },

  seancesList: { gap: 8, marginBottom: 20 },
  seanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  seanceIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.blueLight,
    alignItems: 'center', justifyContent: 'center',
  },
  seanceEmoji: { fontSize: 18 },
  seanceInfo: { flex: 1 },
  seanceTitle: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  seanceMeta: { fontSize: 12, color: C.text2 },

  ratingCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  ratingTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 4, textAlign: 'center' },
  ratingSubtitle: { fontSize: 12, color: C.text3, marginBottom: 14, textAlign: 'center' },
  ratingThanks: { fontSize: 14, fontWeight: '600', color: C.green, textAlign: 'center', paddingVertical: 4 },
  ratingBtns: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  ratingBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  ratingBtnActive: { borderColor: C.blue, backgroundColor: C.blueLight },
  ratingBtnEmoji: { fontSize: 24 },
  ratingReasonsTitle: {
    fontSize: 12, fontWeight: '600', color: C.text2,
    marginTop: 12, marginBottom: 8, alignSelf: 'flex-start',
  },
  ratingReasonsList: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    alignSelf: 'stretch', marginBottom: 12,
  },
  ratingReasonChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    borderColor: C.border, backgroundColor: C.bg,
  },
  ratingReasonChipSelected: { borderColor: C.blue, backgroundColor: C.blueLight },
  ratingReasonText: { fontSize: 12, color: C.text2 },
  ratingReasonTextSelected: { color: C.blue, fontWeight: '600' },
  ratingFreetext: {
    alignSelf: 'stretch',
    backgroundColor: C.bg,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 10, padding: 12,
    color: C.text, fontSize: 13, lineHeight: 20,
    height: 72, textAlignVertical: 'top',
    marginBottom: 12,
  },
  ratingActions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  ratingSkipBtn: {
    flex: 1, padding: 12, borderRadius: 10,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  ratingSkipLabel: { fontSize: 13, fontWeight: '600', color: C.text3 },
  ratingSendBtn: {
    flex: 2, padding: 12, borderRadius: 10,
    backgroundColor: C.blue, alignItems: 'center',
  },
  ratingSendLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },

  previewActions: { marginTop: 4 },
  restartBtn: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  restartBtnLabel: { fontSize: 14, fontWeight: '600', color: C.text2 },
});
