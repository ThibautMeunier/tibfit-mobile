import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { C, sessionColor } from '../constants/colors';
import { RootStackParamList } from '../types';
import {
  CatalogMetric,
  generatePlan,
  selectDaysForPlan,
  selectMetricsForPlan,
  upsertUserMetric,
  upsertPlanReview,
} from '../services/api';
import Icon from '../components/Icon';
import { JOURS_FR, JOURS_EN, Jour } from '../components/DaysWeeksSelector';
import { useAuth } from '../context/AuthContext';
import { usePurchase } from '../context/PurchaseContext';
import { useGeneration } from '../context/GenerationContext';
import { useTranslation } from 'react-i18next';
import { getTipAt, tipsCount } from '../constants/tips';
import { Textarea, Button, SectionLabel, StatTile } from '../components/ui';
import FibiBubble from '../components/ui/FibiBubble';

type Props = NativeStackScreenProps<RootStackParamList, 'Generate'>;
type Step = 1 | 2 | 3 | 4 | 5 | 6;

const SCREEN_W = Dimensions.get('window').width;
const CONTENT_W = SCREEN_W - 32;
const STREAM_SEG_W = CONTENT_W * 0.4;
const WEEK_ROW1 = [1, 2, 3, 4] as const;
const WEEK_ROW2 = [6, 8, 12, 16] as const;
const TOTAL_STEPS = 4; // nombre de segments dans la progress bar

// ─── Exports utilisés par RecalibrationScreen & PlanEndingScreen ──────────────

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
          } catch { /* objet incomplet */ }
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProgressStep(step: Step): number | null {
  if (step === 1) return 1;
  if (step === 2) return 2;
  if (step === 3) return null; // interstitiel, pas de progress
  if (step === 4) return 3;
  if (step === 5) return 4;
  return null; // step 6 : pipeline terminée
}

function getPillStep(step: Step): number | null {
  if (step === 1) return 1;
  if (step === 2) return 2;
  if (step === 3) return null;
  if (step === 4) return 3;
  if (step === 5) return 4;
  return null;
}

// ─── Sous-composants inline ────────────────────────────────────────────────────

interface MetricRowProps {
  metric: CatalogMetric;
  value: string;
  onChange: (v: string) => void;
  expanded: boolean;
  onToggle: () => void;
}

function MetricRow({ metric, value, onChange, expanded, onToggle }: MetricRowProps) {
  const isKey = metric.blocking_for_sports.length > 0;

  const chipValues: string[] = (() => {
    if (metric.type === 'enum' && metric.enum_values?.length) {
      return metric.enum_values;
    }
    if (metric.type === 'scale' && metric.value_range) {
      const count = metric.value_range.max - metric.value_range.min + 1;
      if (count <= 10) {
        return Array.from({ length: count }, (_, i) => String(metric.value_range!.min + i));
      }
    }
    return [];
  })();

  const useChips = chipValues.length > 0;

  return (
    <View style={mStyles.container}>
      <View style={mStyles.inner}>
        <View style={mStyles.topRow}>
          <Text style={mStyles.name} numberOfLines={2}>{metric.name}</Text>
          {isKey && (
            <View style={mStyles.keyBadge}>
              <Text style={mStyles.keyLabel}>CLÉ</Text>
            </View>
          )}
          <View style={mStyles.topRowSpacer} />
          <TouchableOpacity
            onPress={onToggle}
            style={[mStyles.infoBtn, expanded && mStyles.infoBtnActive]}
            activeOpacity={0.7}
          >
            <Icon name="info" size={14} color={expanded ? C.blue : C.text3} />
          </TouchableOpacity>
        </View>

        {useChips ? (
          <View style={mStyles.chipsRow}>
            {chipValues.map(chip => (
              <TouchableOpacity
                key={chip}
                style={[mStyles.chip, value === chip && mStyles.chipActive]}
                onPress={() => onChange(value === chip ? '' : chip)}
                activeOpacity={0.75}
              >
                <Text style={[mStyles.chipText, value === chip && mStyles.chipTextActive]}>
                  {chip}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={mStyles.inputRow}>
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder={metric.unit ?? '—'}
              placeholderTextColor={C.text3}
              keyboardType={metric.type === 'number' ? 'decimal-pad' : 'default'}
              returnKeyType="done"
              style={mStyles.input}
            />
            {metric.unit && <Text style={mStyles.unit}>{metric.unit}</Text>}
          </View>
        )}
      </View>

      {expanded && metric.description ? (
        <View style={mStyles.descriptionBox}>
          <Text style={mStyles.description}>{metric.description}</Text>
        </View>
      ) : null}
    </View>
  );
}

const mStyles = StyleSheet.create({
  container: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  inner: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topRowSpacer: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: C.text, flexShrink: 1 },
  keyBadge: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  keyLabel: { fontSize: 9, fontWeight: '700', color: C.blue, letterSpacing: 0.6 },
  infoBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoBtnActive: { backgroundColor: 'rgba(59,130,246,0.12)' },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: C.blue,
  },
  chipText: { fontSize: 13, color: C.text2, fontWeight: '500' },
  chipTextActive: { color: C.blue, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    color: C.text,
    fontFamily: 'DM Mono',
    fontSize: 13,
    paddingVertical: 4,
    minWidth: 0,
  },
  unit: { fontSize: 11, color: C.text3, paddingHorizontal: 6 },
  descriptionBox: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  description: { fontSize: 12.5, color: C.text2, lineHeight: 19 },
});

interface StartChoiceProps {
  icon: string;
  iconColor: string;
  title: string;
  badge?: string;
  desc: string;
  active: boolean;
  accent: string;
  onPress: () => void;
}

function StartChoice({ icon, iconColor, title, badge, desc, active, accent, onPress }: StartChoiceProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        scStyles.container,
        active
          ? { backgroundColor: accent + '1A', borderColor: accent }
          : { backgroundColor: C.card, borderColor: C.border },
      ]}
    >
      <View style={scStyles.header}>
        <View style={[scStyles.iconCircle, { backgroundColor: iconColor + '1A' }]}>
          <Icon name={icon as any} size={20} color={iconColor} />
        </View>
        <View style={scStyles.titleRow}>
          <Text style={scStyles.title}>{title}</Text>
          {badge && (
            <View style={[scStyles.badge, { backgroundColor: iconColor + '1A' }]}>
              <Text style={[scStyles.badgeLabel, { color: iconColor }]}>{badge}</Text>
            </View>
          )}
        </View>
        <View style={[
          scStyles.radio,
          active
            ? { backgroundColor: accent, borderColor: accent }
            : { borderColor: C.borderM ?? 'rgba(255,255,255,0.12)' },
        ]}>
          {active && <Icon name="check" size={12} color="#fff" />}
        </View>
      </View>
      <Text style={scStyles.desc}>{desc}</Text>
    </TouchableOpacity>
  );
}

const scStyles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    paddingBottom: 14,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: { fontSize: 15, fontWeight: '700', color: C.text },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  desc: { fontSize: 13, color: C.text2, lineHeight: 20 },
});

// ─── Composant principal ───────────────────────────────────────────────────────

export default function GenerateScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showPaywall } = usePurchase();
  const generation = useGeneration();

  // Navigation dans la pipeline
  const [step, setStep] = useState<Step>(1);
  const [hasInterstitial, setHasInterstitial] = useState(false);

  // Étape 1 — Objectif
  const [input, setInput] = useState('');

  // Étape 2 — Métriques
  const [metricsData, setMetricsData] = useState<CatalogMetric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsValues, setMetricsValues] = useState<Record<string, string>>({});
  const [expandedMetricId, setExpandedMetricId] = useState<string | null>(null);
  const [metricsSaving, setMetricsSaving] = useState(false);

  // Étape 3 — Comment démarrer (conditionnel)
  const [startStrategy, setStartStrategy] = useState<'direct_test' | 'base_first' | null>(null);
  const [missingMetricIds, setMissingMetricIds] = useState<string[]>([]);

  // Étape 4 — Jours + durée
  const [selectedJours, setSelectedJours] = useState<Set<Jour>>(new Set());
  const [daysLoading, setDaysLoading] = useState(false);
  const [durationWeeks, setDurationWeeks] = useState(4);

  // Étape 5/6 — Génération + Succès
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(
    () => Math.floor(Math.random() * tipsCount(i18n.language, undefined)),
  );
  const tipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  // Étape 6 — Feedback
  const [ratingValue, setRatingValue] = useState<'up' | 'down' | null>(null);
  const [ratingSent, setRatingSent] = useState(false);
  const [ratingSending, setRatingSending] = useState(false);

  // Streaming étape 5
  const streamBufferRef = useRef('');
  const [streamingSeances, setStreamingSeances] = useState<SeancePreview[]>([]);

  // Animations étape 5
  const bobAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const streamAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => () => { isMounted.current = false; }, []);

  // Restaure depuis le context si re-montage (ex. retour depuis background)
  useEffect(() => {
    if (generation.status === 'done' && step < 6) {
      setStep(6);
    } else if (generation.status === 'generating' && step < 5) {
      setStep(5);
    } else if (generation.status === 'idle' && step > 4) {
      setStep(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation.status]);

  // Bloquer la navigation arrière pendant la génération
  useEffect(() => {
    if (step !== 5) return;
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
  }, [navigation, step, t]);

  // Rotation des tips pendant la génération
  useEffect(() => {
    if (step === 5) {
      tipIntervalRef.current = setInterval(() => setTipIndex(i => i + 1), 10000);
    } else {
      if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
    }
    return () => { if (tipIntervalRef.current) clearInterval(tipIntervalRef.current); };
  }, [step]);

  // Animations (bob, glow, stream) uniquement à l'étape 5
  useEffect(() => {
    if (step === 5) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bobAnim, { toValue: -6, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(bobAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ).start();
      Animated.loop(
        Animated.timing(streamAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ).start();
    } else {
      bobAnim.stopAnimation();
      glowAnim.stopAnimation();
      streamAnim.stopAnimation();
      bobAnim.setValue(0);
      glowAnim.setValue(0);
      streamAnim.setValue(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] });
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const streamTranslateX = streamAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-STREAM_SEG_W, CONTENT_W],
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  function handleBack() {
    if (step === 1) { navigation.goBack(); return; }
    if (step === 2) { setStep(1); return; }
    if (step === 3) { setStep(2); return; }
    if (step === 4) { setStep(hasInterstitial ? 3 : 2); return; }
    if (step === 5) return; // bloqué pendant génération
    // step 6
    generation.resetGeneration();
    navigation.goBack();
  }

  // ── Étape 2 — Métriques ─────────────────────────────────────────────────────

  async function goToStep2() {
    Keyboard.dismiss();
    setMetricsLoading(true);
    setStep(2);
    try {
      const metrics = await selectMetricsForPlan(input.trim());
      setMetricsData(metrics);
      const initial: Record<string, string> = {};
      for (const m of metrics) {
        if (m.user_value) initial[m.id] = m.user_value;
      }
      setMetricsValues(initial);
    } catch {
      setMetricsData([]);
    } finally {
      setMetricsLoading(false);
    }
  }

  async function handleStep2Continue() {
    setMetricsSaving(true);
    try {
      const saves = Object.entries(metricsValues)
        .filter(([, v]) => v.trim())
        .map(([id, value]) => upsertUserMetric(id, value).catch(() => null));
      await Promise.all(saves);
    } finally {
      setMetricsSaving(false);
    }

    const missingIds = metricsData
      .filter(m =>
        m.blocking_for_sports.length > 0 &&
        m.discovery_session &&
        !m.user_value &&
        !metricsValues[m.id]?.trim(),
      )
      .map(m => m.id);

    if (missingIds.length > 0) {
      setMissingMetricIds(missingIds);
      setHasInterstitial(true);
      setStartStrategy(null);
      setStep(3);
    } else {
      await goToStep4();
    }
  }

  // ── Étape 4 — Jours ─────────────────────────────────────────────────────────

  async function goToStep4() {
    setDaysLoading(true);
    setStep(4);
    try {
      const result = await selectDaysForPlan(input.trim());
      const normalized = result.jours.map(j => j.toLowerCase().trim());
      const validJours = normalized.filter((j): j is Jour => JOURS_FR.includes(j as Jour));
      const finalJours = validJours.length ? validJours : (['mardi', 'jeudi', 'samedi'] as Jour[]);
      setSelectedJours(new Set(finalJours));
      setDurationWeeks(result.semaines ?? 4);
    } catch (err) {
      setSelectedJours(new Set<Jour>(['mardi', 'jeudi', 'samedi']));
      setDurationWeeks(4);
    } finally {
      setDaysLoading(false);
    }
  }

  function handleDayToggle(jour: Jour) {
    setSelectedJours(prev => {
      const next = new Set(prev);
      if (next.has(jour)) {
        if (next.size === 1) return prev;
        next.delete(jour);
      } else {
        next.add(jour);
      }
      return next;
    });
  }

  // ── Génération ───────────────────────────────────────────────────────────────

  function handleStep4Continue() {
    const sortedJours = JOURS_FR.filter(j => selectedJours.has(j));
    startGenerate(startStrategy, missingMetricIds, sortedJours, durationWeeks);
  }

  async function startGenerate(
    warmupMode: 'direct_test' | 'base_first' | null,
    missingBlockingMetrics: string[],
    joursSemaine: string[],
    dureeSemaines: number,
  ) {
    setStep(5);
    setGenerateError(null);
    streamBufferRef.current = '';
    setStreamingSeances([]);
    generation.startGeneration();

    await generatePlan(
      input.trim(),
      (chunk: string) => {
        streamBufferRef.current += chunk;
        setStreamingSeances(parseCompletedSeances(streamBufferRef.current));
      },
      (planId) => {
        generation.completeGeneration(planId);
        if (!isMounted.current) return;
        setTimeout(() => { if (isMounted.current) setStep(6); }, 400);
      },
      (errMsg) => {
        if (!isMounted.current) {
          if (errMsg !== 'PREMIUM_REQUIRED') generation.failGeneration();
          return;
        }
        if (errMsg === 'PREMIUM_REQUIRED') {
          generation.resetGeneration();
          setStep(1);
          showPaywall();
          return;
        }
        generation.failGeneration();
        setGenerateError(errMsg);
        setStep(6);
      },
      warmupMode,
      missingBlockingMetrics,
      joursSemaine,
      dureeSemaines,
    );
  }

  // ── Étape 6 — Feedback ───────────────────────────────────────────────────────

  async function handleRating(value: 'up' | 'down') {
    setRatingValue(value);
    if (!generation.planId) { setRatingSent(true); return; }
    setRatingSending(true);
    try {
      await upsertPlanReview(generation.planId, value, undefined, undefined);
    } catch { /* best-effort */ }
    setRatingSent(true);
    setRatingSending(false);
  }

  function handleConfirm() {
    generation.resetGeneration();
    navigation.goBack();
  }

  function handleRetry() {
    const sortedJours = JOURS_FR.filter(j => selectedJours.has(j));
    startGenerate(startStrategy, missingMetricIds, sortedJours, durationWeeks);
  }

  // ── Données dérivées pour l'étape 6 ──────────────────────────────────────────

  const totalSeances = generation.seances.length;
  const totalVolume = Math.round(
    generation.seances.reduce((sum, s) => sum + s.duree_minutes, 0) / 60,
  );
  const allSeancesSorted = [...generation.seances].sort((a, b) => a.date.localeCompare(b.date));

  const inspirationCards = t('generate.inspirationCards', { returnObjects: true }) as Array<{
    emoji: string; title: string; subtitle: string; text: string;
  }>;

  const missingMetricName = missingMetricIds.length
    ? (metricsData.find(m => m.id === missingMetricIds[0])?.name ?? missingMetricIds[0])
    : '';

  const progressStep = getProgressStep(step);
  const pillStep = getPillStep(step);
  const ctaDisabled =
    (step === 1 && input.trim().length === 0) ||
    (step === 2 && (metricsLoading || metricsSaving)) ||
    (step === 3 && startStrategy === null) ||
    (step === 4 && (selectedJours.size === 0 || daysLoading));

  // ── Formatage date ────────────────────────────────────────────────────────────

  function formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* ── Pipeline Header ── */}
      <View style={styles.header}>
        {step > 1 ? (
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.backBtn, step === 5 && styles.backBtnDisabled]}
            disabled={step === 5}
            activeOpacity={0.75}
          >
            <Icon name="chevronLeft" size={18} color={C.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}

        <LottieView
          source={require('../../assets/Fibi.json')}
          autoPlay
          loop
          style={styles.headerAvatar}
        />

        <Text style={styles.headerTitle} numberOfLines={1}>{t('generate.title')}</Text>

        {pillStep !== null ? (
          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>
              {pillStep}<Text style={styles.stepPillSep}>/</Text>{TOTAL_STEPS}
            </Text>
          </View>
        ) : (
          <View style={styles.stepPillPlaceholder} />
        )}

        {progressStep !== null ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeBtn}
            activeOpacity={0.75}
          >
            <Icon name="x" size={18} color={C.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.closeBtnPlaceholder} />
        )}
      </View>

      {/* ── Progress bar (4 segments) ── */}
      {progressStep !== null && (
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSeg,
                i < progressStep
                  ? styles.progressSegActive
                  : styles.progressSegInactive,
              ]}
            />
          ))}
        </View>
      )}

      {/* ── Contenu par étape ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >

        {/* ═══ ÉTAPE 1 — OBJECTIF ═══ */}
        {step === 1 && (
          <>
            <FibiBubble>
              <Text style={styles.bubbleText}>{t('generate.description')}</Text>
            </FibiBubble>

            <View style={styles.gap16} />

            <Textarea
              value={input}
              onChangeText={setInput}
              placeholder={t('generate.textAreaPlaceholder')}
              numberOfLines={6}
            />

            <View style={styles.gap20} />

            <SectionLabel label={t('generate.examplesLabel')} />
            <View style={styles.inspirationList}>
              {inspirationCards.map((card, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.inspirationCard}
                  onPress={() => setInput(card.text)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.inspirationEmoji}>{card.emoji}</Text>
                  <View style={styles.inspirationInfo}>
                    <Text style={styles.inspirationTitle}>{card.title}</Text>
                    <Text style={styles.inspirationSubtitle}>{card.subtitle}</Text>
                  </View>
                  <Icon name="plus" size={16} color={C.text3} />
                </TouchableOpacity>
              ))}
            </View>

            {!user?.objectif && (
              <TouchableOpacity
                style={styles.profileBanner}
                onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
                activeOpacity={0.8}
              >
                <View style={styles.profileBannerBadge}>
                  <Text style={styles.profileBannerBadgeLabel}>!</Text>
                </View>
                <Text style={styles.profileBannerText}>
                  <Text style={styles.profileBannerBold}>{t('generate.incompleteProfile').split('.')[0]}.</Text>
                  {' '}{t('generate.incompleteProfile').split('.').slice(1).join('.').trim()}
                </Text>
                <Icon name="chevronRight" size={14} color={C.orange} />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ═══ ÉTAPE 2 — MÉTRIQUES ═══ */}
        {step === 2 && (
          <>
            <View style={styles.stepTitleBlock}>
              <Text style={styles.h2}>{t('metricsPopup.title')}</Text>
              <Text style={styles.subtitle}>
                {t('metricsPopup.subtitle')}{' '}
                <Text style={styles.subtitleFaint}>{t('metricsPopup.hint')}</Text>
              </Text>
            </View>

            {metricsLoading ? (
              <View style={styles.loaderRow}>
                <ActivityIndicator color={C.blue} />
                <Text style={styles.loaderText}>{t('metricsPopup.loading')}</Text>
              </View>
            ) : (
              <View style={styles.metricsList}>
                {metricsData.map((m) => (
                  <MetricRow
                    key={m.id}
                    metric={m}
                    value={metricsValues[m.id] ?? ''}
                    onChange={(v) => setMetricsValues(prev => ({ ...prev, [m.id]: v }))}
                    expanded={expandedMetricId === m.id}
                    onToggle={() => setExpandedMetricId(expandedMetricId === m.id ? null : m.id)}
                  />
                ))}
              </View>
            )}

            <View style={styles.gap16} />

            <FibiBubble tone="tip" avatarSize={30}>
              <Text style={styles.tipText}>{t('generate.metricsTip')}</Text>
            </FibiBubble>
          </>
        )}

        {/* ═══ ÉTAPE 3 — COMMENT DÉMARRER (interstitiel) ═══ */}
        {step === 3 && (
          <>
            <View style={styles.stepTitleBlock}>
              <Text style={styles.h2}>{t('warmupPopup.title')}</Text>
              <Text style={styles.subtitle}>{t('warmupPopup.subtitle')}</Text>
            </View>

            {missingMetricName ? (
              <FibiBubble tone="tip" avatarSize={30}>
                <Text style={styles.tipText}>
                  {t('generate.startMissingBubble', { name: missingMetricName })}
                </Text>
              </FibiBubble>
            ) : null}

            <View style={styles.gap16} />

            <View style={styles.choiceList}>
              <StartChoice
                icon="bolt"
                iconColor={C.yellow}
                title={t('warmupPopup.directTest.title')}
                badge={t('warmupPopup.directTest.badge')}
                desc={t('warmupPopup.directTest.description')}
                active={startStrategy === 'direct_test'}
                accent={C.blue}
                onPress={() => setStartStrategy('direct_test')}
              />
              <StartChoice
                icon="sprout"
                iconColor={C.green}
                title={t('warmupPopup.baseFirst.title')}
                desc={t('warmupPopup.baseFirst.description')}
                active={startStrategy === 'base_first'}
                accent={C.green}
                onPress={() => setStartStrategy('base_first')}
              />
            </View>
          </>
        )}

        {/* ═══ ÉTAPE 4 — JOURS + DURÉE ═══ */}
        {step === 4 && (
          <>
            <View style={styles.stepTitleBlock}>
              <Text style={styles.h2}>{t('daysPopup.title')}</Text>
            </View>

            <FibiBubble avatarSize={30}>
              <Text style={styles.bubbleText}>
                {t('generate.daysFibiBubble', { count: selectedJours.size })}
              </Text>
            </FibiBubble>

            <View style={styles.gap18} />

            {/* Grille 7 jours */}
            <SectionLabel
              label={t('daysPopup.selectedHint', { count: selectedJours.size })}
            />

            {daysLoading ? (
              <View style={styles.loaderRow}>
                <ActivityIndicator color={C.blue} />
              </View>
            ) : (
              <View style={styles.daysGrid}>
                {JOURS_FR.map((jour, i) => {
                  const isFr = i18n.language.startsWith('fr');
                  const fullName = isFr ? jour : JOURS_EN[i];
                  const letter = fullName.charAt(0).toUpperCase();
                  const abbr = fullName.slice(0, 3);
                  const isOn = selectedJours.has(jour);
                  return (
                    <TouchableOpacity
                      key={jour}
                      style={[styles.dayBtn, isOn && styles.dayBtnActive]}
                      onPress={() => handleDayToggle(jour)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.dayLetter, isOn && styles.dayLetterActive]}>{letter}</Text>
                      <Text style={[styles.dayAbbr, isOn && styles.dayAbbrActive]}>{abbr}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.gap24} />

            {/* Chips durée */}
            <SectionLabel label={t('daysPopup.weeksLabel')} />
            <View style={styles.weeksRow}>
              {WEEK_ROW1.map(w => {
                const isOn = w === durationWeeks;
                return (
                  <TouchableOpacity
                    key={w}
                    style={[styles.weekChip, isOn && styles.weekChipActive]}
                    onPress={() => setDurationWeeks(w)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.weekChipText, isOn && styles.weekChipTextActive]}>
                      {t('daysPopup.week', { count: w })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[styles.weeksRow, styles.gap6]}>
              {WEEK_ROW2.map(w => {
                const isOn = w === durationWeeks;
                return (
                  <TouchableOpacity
                    key={w}
                    style={[styles.weekChip, isOn && styles.weekChipActive]}
                    onPress={() => setDurationWeeks(w)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.weekChipText, isOn && styles.weekChipTextActive]}>
                      {t('daysPopup.week', { count: w })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.gap20} />

            {/* Card récap */}
            <View style={styles.recapCard}>
              <View style={styles.recapBadge}>
                <Text style={styles.recapBadgeNum}>{selectedJours.size * durationWeeks}</Text>
              </View>
              <Text style={styles.recapText}>
                {t('generate.sessionCount', {
                  count: selectedJours.size * durationWeeks,
                  weeks: durationWeeks,
                })}
              </Text>
            </View>
          </>
        )}

        {/* ═══ ÉTAPE 5 — GÉNÉRATION ═══ */}
        {step === 5 && (
          <View style={styles.generatingWrapper}>
            {/* Hero Fibi avec bob + glow */}
            <View style={styles.fibiHeroContainer}>
              <Animated.View style={[
                styles.fibiGlow,
                { opacity: glowOpacity, transform: [{ scale: glowScale }] },
              ]} />
              <Animated.View style={{ transform: [{ translateY: bobAnim }] }}>
                <LottieView
                  source={require('../../assets/Fibi.json')}
                  autoPlay
                  loop
                  style={styles.fibiHero}
                />
              </Animated.View>
            </View>

            <Text style={styles.generatingTitle}>{t('generate.generatingTitle')}</Text>
            <Text style={styles.generatingSubtitle}>{t('generate.generatingSubtitle')}</Text>

            {/* Barre indéterminée */}
            <View style={styles.streamTrack}>
              <Animated.View style={[
                styles.streamSegment,
                { width: STREAM_SEG_W, transform: [{ translateX: streamTranslateX }] },
              ]} />
            </View>

            <View style={styles.gap32} />

            {/* Tip Fibi */}
            <FibiBubble tone="tip" avatarSize={30}>
              <Text style={styles.tipLabel}>{t('generate.tipLabel').toUpperCase()}</Text>
              <Text style={styles.tipText}>
                {getTipAt(i18n.language, user?.niveau, tipIndex)}
              </Text>
            </FibiBubble>

            {/* Séances en cours de création */}
            {streamingSeances.length > 0 && (
              <View style={[styles.gap20, styles.streamSeancesBlock]}>
                <SectionLabel label={t('generate.generatingSeances')} />
                <View style={styles.seancesList}>
                  {streamingSeances.map((s, i) => (
                    <View key={i} style={styles.streamSeanceRow}>
                      <Text style={styles.streamSeanceEmoji}>{s.emoji ?? '🏃'}</Text>
                      <View style={styles.seanceInfo}>
                        <Text style={styles.seanceTitle} numberOfLines={1}>{s.titre}</Text>
                        <Text style={styles.seanceMeta}>{formatDate(s.date)} · {s.duree_minutes} min</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ═══ ÉTAPE 6 — SUCCÈS / ERREUR ═══ */}
        {step === 6 && (
          <>
            {generateError ? (
              /* Erreur */
              <View style={styles.errorCard}>
                <View style={styles.errorHeader}>
                  <Icon name="x" size={16} color={C.red} />
                  <Text style={styles.errorTitle}>{t('generate.errorTitle')}</Text>
                </View>
                <Text style={styles.errorText}>{generateError}</Text>
              </View>
            ) : (
              /* Succès */
              <>
                {/* Hero succès */}
                <View style={styles.successHero}>
                  <View style={styles.successAvatarWrapper}>
                    <LottieView
                      source={require('../../assets/Fibi.json')}
                      autoPlay
                      loop
                      style={styles.successAvatar}
                    />
                    <View style={styles.successCheckBadge}>
                      <Icon name="check" size={12} color="#fff" />
                    </View>
                  </View>
                  <View style={styles.successTextBlock}>
                    <Text style={styles.successTitle}>{t('generate.successTitle')}</Text>
                    <Text style={styles.successSubtitle}>
                      {t('generate.successSubtitle', {
                        weeks: durationWeeks,
                        freq: selectedJours.size,
                      })}
                    </Text>
                  </View>
                </View>

                {/* Stat tiles */}
                {totalSeances > 0 && (
                  <View style={styles.statRow}>
                    <StatTile value={totalSeances} label={t('generate.statSessions')} />
                    <StatTile value={`${totalVolume}h`} label={t('generate.statVolume')} />
                    <StatTile value={durationWeeks} label={t('generate.statWeeks')} />
                  </View>
                )}

                {/* Toutes les séances */}
                {allSeancesSorted.length > 0 && (
                  <View style={styles.gap16}>
                    <SectionLabel label={t('generate.allSeances')} />
                    <View style={styles.seancesList}>
                      {allSeancesSorted.map((s) => {
                        const accent = sessionColor(s.couleur);
                        return (
                          <View key={s.id} style={styles.seanceRow}>
                            <View style={[styles.seanceTile, { backgroundColor: accent + '1A', borderLeftColor: accent }]}>
                              <Text style={styles.seanceEmoji}>{s.emoji ?? '🏃'}</Text>
                            </View>
                            <View style={styles.seanceInfo}>
                              <Text style={styles.seanceTitle} numberOfLines={1}>{s.titre}</Text>
                              <Text style={styles.seanceMeta}>{formatDate(s.date)} · {s.duree_minutes} min</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Feedback */}
                <View style={styles.feedbackCard}>
                  {ratingSent ? (
                    <Text style={styles.ratingThanks}>{t('generate.ratingThanks')}</Text>
                  ) : (
                    <>
                      <Text style={styles.feedbackTitle}>{t('generate.ratingTitle')}</Text>
                      <Text style={styles.feedbackSubtitle}>{t('generate.ratingSubtitle')}</Text>
                      <View style={styles.feedbackBtns}>
                        <TouchableOpacity
                          style={[styles.feedbackBtn, styles.feedbackBtnGreen]}
                          onPress={() => handleRating('up')}
                          disabled={ratingSending}
                          activeOpacity={0.8}
                        >
                          <Icon name="thumbUp" size={14} color={C.green} />
                          <Text style={[styles.feedbackBtnLabel, { color: C.green }]}>
                            {t('generate.feedbackPerfect')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.feedbackBtn, styles.feedbackBtnNeutral]}
                          onPress={() => handleRating('down')}
                          disabled={ratingSending}
                          activeOpacity={0.8}
                        >
                          <Icon name="edit" size={14} color={C.text2} />
                          <Text style={[styles.feedbackBtnLabel, { color: C.text2 }]}>
                            {t('generate.feedbackAdjust')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </>
            )}
          </>
        )}

        {/* Espace pour la bottom bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── Bottom bar ── */}

      {/* Étapes 1–4 : "Continuer" */}
      {(step === 1 || step === 2 || step === 3 || step === 4) && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.ctaBtn, ctaDisabled && styles.ctaBtnDisabled]}
            onPress={
              step === 1 ? goToStep2 :
              step === 2 ? handleStep2Continue :
              step === 3 ? () => goToStep4() :
              handleStep4Continue
            }
            disabled={ctaDisabled}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[C.blue, '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.ctaGradient, ctaDisabled && { opacity: 0 }]}
            />
            <View style={styles.ctaInner}>
              {(step === 2 && metricsSaving) ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.ctaLabel}>{t('generate.continue')}</Text>
                  <Icon name="chevronRight" size={18} color="#fff" />
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Étape 6 succès : "Voir mon plan" (vert) */}
      {step === 6 && !generateError && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.ctaBtnGreen} onPress={handleConfirm} activeOpacity={0.85}>
            <LinearGradient
              colors={[C.green, '#16A34A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.ctaInner}>
              <Text style={styles.ctaLabel}>{t('generate.confirmBtn')}</Text>
              <Icon name="chevronRight" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Étape 6 erreur : "Réessayer" + "Recommencer" */}
      {step === 6 && generateError && (
        <View style={[styles.bottomBar, styles.errorActions, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.85}>
            <LinearGradient
              colors={[C.blue, '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.ctaInner}>
              <Text style={styles.ctaLabel}>{t('generate.retryBtn')}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.restartBtn}
            onPress={() => {
              generation.resetGeneration();
              setStep(1);
              setInput('');
              setGenerateError(null);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.restartLabel}>{t('generate.restartBtn')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header pipeline
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  backBtnDisabled: { opacity: 0.4 },
  backBtnPlaceholder: { width: 36, height: 36, flexShrink: 0 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  closeBtnPlaceholder: { width: 36, height: 36, flexShrink: 0 },
  headerAvatar: { width: 28, height: 28, flexShrink: 0 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: C.text },
  stepPill: {
    height: 26, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.20)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepPillText: {
    fontSize: 11, fontWeight: '700', color: C.blue,
    fontVariant: ['tabular-nums'], letterSpacing: 0.4,
  },
  stepPillSep: { opacity: 0.5 },
  stepPillPlaceholder: { width: 44 },

  // Progress bar
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressSeg: { flex: 1, height: 3, borderRadius: 2 },
  progressSegActive: { backgroundColor: C.blue },
  progressSegInactive: { backgroundColor: C.bg3 },

  // Steps 1-6 — scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },

  // Gaps
  gap6: { marginTop: 6 },
  gap16: { marginTop: 16 },
  gap18: { marginTop: 18 },
  gap20: { marginTop: 20 },
  gap24: { marginTop: 24 },
  gap32: { marginTop: 32 },
  bottomSpacer: { height: 100 },

  // Bubbles
  bubbleText: { fontSize: 14, color: C.text, lineHeight: 22 },
  tipLabel: {
    fontSize: 11, fontWeight: '700', color: C.yellow,
    letterSpacing: 0.8, marginBottom: 4,
  },
  tipText: { fontSize: 12.5, color: C.text2, lineHeight: 19 },

  // Étape 1 — Inspirations
  inspirationList: { gap: 8 },
  inspirationCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  inspirationEmoji: { fontSize: 22, lineHeight: 26, width: 36, textAlign: 'center' },
  inspirationInfo: { flex: 1, minWidth: 0 },
  inspirationTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  inspirationSubtitle: { fontSize: 12, color: C.text3, marginTop: 2 },

  // Profil incomplet
  profileBanner: {
    marginTop: 20,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderStyle: 'dashed', borderColor: C.orange + '50',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  profileBannerBadge: {
    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
    backgroundColor: C.orangeLight,
    alignItems: 'center', justifyContent: 'center',
  },
  profileBannerBadgeLabel: { fontSize: 14, fontWeight: '700', color: C.orange },
  profileBannerText: { flex: 1, fontSize: 12.5, color: C.text2, lineHeight: 18 },
  profileBannerBold: { color: C.orange, fontWeight: '600' },

  // Étapes 2/3/4 — Titre + sous-titre
  stepTitleBlock: { marginBottom: 16 },
  h2: { fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: -0.3, marginBottom: 4 },
  subtitle: { fontSize: 13.5, color: C.text2, lineHeight: 21 },
  subtitleFaint: { color: C.text3 },

  // Loader
  loaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 32,
  },
  loaderText: { fontSize: 13, color: C.text3 },

  // Étape 2 — Liste métriques
  metricsList: { gap: 8 },

  // Étape 3 — Choix radio
  choiceList: { gap: 10 },

  // Étape 4 — Jours
  daysGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  dayBtn: {
    flex: 1,
    height: 56, borderRadius: 12,
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  dayBtnActive: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: C.blue,
    shadowColor: C.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  dayLetter: { fontSize: 16, fontWeight: '700', color: C.text2 },
  dayLetterActive: { color: C.blue },
  dayAbbr: { fontSize: 9, fontWeight: '500', color: C.text3, textTransform: 'capitalize' },
  dayAbbrActive: { color: C.blue },

  // Étape 4 — Chips semaines
  weeksRow: {
    flexDirection: 'row',
    gap: 8,
  },
  weekChip: {
    flex: 1, height: 44, borderRadius: 12,
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  weekChipActive: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: C.blue,
  },
  weekChipText: { fontSize: 13, fontWeight: '500', color: C.text2 },
  weekChipTextActive: { color: C.blue, fontWeight: '700' },

  // Étape 4 — Card récap
  recapCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  recapBadge: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  recapBadgeNum: {
    fontSize: 14, fontWeight: '700', color: C.blue, fontVariant: ['tabular-nums'],
  },
  recapText: { fontSize: 13, color: C.text2, lineHeight: 20 },

  // Étape 5 — Génération
  generatingWrapper: { alignItems: 'center', paddingTop: 24 },
  fibiHeroContainer: {
    position: 'relative',
    alignItems: 'center', justifyContent: 'center',
    width: 160, height: 160,
  },
  fibiGlow: {
    position: 'absolute',
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: C.blue,
  },
  fibiHero: { width: 96, height: 96 },
  generatingTitle: {
    fontSize: 22, fontWeight: '700', color: C.text,
    letterSpacing: -0.3, marginTop: 22, textAlign: 'center',
  },
  generatingSubtitle: {
    fontSize: 13.5, color: C.text2, marginTop: 6,
    textAlign: 'center', lineHeight: 20,
  },
  streamTrack: {
    alignSelf: 'stretch',
    height: 4, borderRadius: 2,
    backgroundColor: C.bg3,
    overflow: 'hidden',
    marginTop: 24,
  },
  streamSegment: {
    position: 'absolute',
    top: 0, bottom: 0,
    borderRadius: 2,
    backgroundColor: C.blue,
  },

  // Étape 6 — Erreur
  errorCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.red + '40',
    borderRadius: 14, padding: 16,
  },
  errorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  errorTitle: { fontSize: 13, fontWeight: '700', color: C.red },
  errorText: { fontSize: 13, color: C.text2, lineHeight: 20 },

  // Étape 6 — Succès
  successHero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(22,163,74,0.10)',
    borderWidth: 1, borderColor: 'rgba(22,163,74,0.20)',
    borderRadius: 18, padding: 18, paddingHorizontal: 16,
    marginBottom: 12,
  },
  successAvatarWrapper: { position: 'relative', flexShrink: 0 },
  successAvatar: { width: 48, height: 48 },
  successCheckBadge: {
    position: 'absolute', bottom: -2, right: -4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.green, borderWidth: 2, borderColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  successTextBlock: { flex: 1, minWidth: 0 },
  successTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  successSubtitle: { fontSize: 12.5, color: C.text2, marginTop: 2 },

  statRow: {
    flexDirection: 'row', gap: 8,
    marginBottom: 16,
  },

  // Étape 5 — séances en streaming
  streamSeancesBlock: { alignSelf: 'stretch' },
  streamSeanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  streamSeanceEmoji: { fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 },

  // Séances
  seancesList: { gap: 8 },
  seanceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  seanceTile: {
    width: 42, height: 42, borderRadius: 11, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
    borderLeftWidth: 3,
  },
  seanceEmoji: { fontSize: 20 },
  seanceInfo: { flex: 1, minWidth: 0 },
  seanceTitle: { fontSize: 13.5, fontWeight: '600', color: C.text },
  seanceMeta: { fontSize: 11.5, color: C.text3, marginTop: 2 },

  // Feedback
  feedbackCard: {
    marginTop: 16,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    alignItems: 'center',
  },
  feedbackTitle: { fontSize: 13, fontWeight: '600', color: C.text, textAlign: 'center' },
  feedbackSubtitle: { fontSize: 11.5, color: C.text3, marginTop: 2, textAlign: 'center', marginBottom: 12 },
  feedbackBtns: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  feedbackBtn: {
    flex: 1, height: 40, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1,
  },
  feedbackBtnGreen: { borderColor: C.green + '55', backgroundColor: 'transparent' },
  feedbackBtnNeutral: { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'transparent' },
  feedbackBtnLabel: { fontSize: 13, fontWeight: '600' },
  ratingThanks: { fontSize: 14, fontWeight: '600', color: C.green, textAlign: 'center', paddingVertical: 4 },

  // Bottom bars
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
  ctaBtn: {
    height: 54, borderRadius: 16, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaBtnDisabled: { opacity: 0.4 },
  ctaBtnGreen: {
    height: 54, borderRadius: 16, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaGradient: { ...StyleSheet.absoluteFillObject },
  ctaInner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    position: 'absolute',
  },
  ctaLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
  errorActions: { gap: 10 },
  retryBtn: {
    height: 54, borderRadius: 16, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', flex: 1,
  },
  restartBtn: {
    height: 48, borderRadius: 14,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', flex: 1,
  },
  restartLabel: { fontSize: 14, fontWeight: '600', color: C.text2 },
});
