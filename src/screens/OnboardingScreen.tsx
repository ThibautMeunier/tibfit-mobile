import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  ActivityIndicator,
  Animated,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { C } from '../constants/colors';
import Icon from '../components/Icon';
import { RootStackParamList } from '../types';
import { updateAthleteProfile, upsertUserMetric } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const ONBOARDING_KEY = 'hasCompletedOnboarding';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
type Step =
  | 'welcome'
  | 'objectifs_ask' | 'objectifs'
  | 'niveau_ask' | 'niveau'
  | 'metriques_intro' | 'metriques'
  | 'recap' | 'generate';

const WIZARD_STEPS: Step[] = [
  'objectifs_ask', 'objectifs',
  'niveau_ask', 'niveau',
  'metriques_intro', 'metriques',
  'recap', 'generate',
];

const NIVEAU_OPTIONS = [
  { value: 'débutant' },
  { value: 'intermédiaire' },
  { value: 'avancé' },
  { value: 'expert' },
];

// ─── Shared components ────────────────────────────────────────────────────────

function FibiLottie({ size }: { size: number }) {
  const ref = useRef<LottieView>(null);
  const isReverse = useRef(false);
  return (
    <LottieView
      ref={ref}
      source={require('../../assets/Fibi.json')}
      autoPlay
      loop={false}
      onAnimationFinish={(cancelled) => {
        if (cancelled) return;
        isReverse.current = !isReverse.current;
        if (isReverse.current) ref.current?.play(59, 0);
        else ref.current?.play(0, 59);
      }}
      style={{ width: size, height: size }}
    />
  );
}

function SpeechBubble({ text }: { text: string }) {
  return (
    <View style={styles.speechBubble}>
      <Text style={styles.speechBubbleText}>{text}</Text>
    </View>
  );
}

function StepHeader({ progress, onBack }: { progress: number; onBack: () => void }) {
  return (
    <View style={styles.stepHeader}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
        <Icon name="chevronLeft" size={22} color={C.text2} />
      </TouchableOpacity>
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%` as any }]} />
      </View>
      <View style={{ width: 38 }} />
    </View>
  );
}

function GradientCTA({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.85}>
      <LinearGradient
        colors={disabled ? [C.bg3, C.bg3] : [C.blue, '#6366F1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cta}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.ctaLabel, disabled && styles.ctaLabelDisabled]}>{label}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

function MetricCard({
  icon,
  label,
  description,
  unit,
  value,
  onChangeText,
  placeholder,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  description?: string;
  unit: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricCardLeft}>
        <View style={styles.metricIconWrap}>
          <Icon name={icon} size={17} color={C.blue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.metricLabel}>{label}</Text>
          {description ? <Text style={styles.metricDesc}>{description}</Text> : null}
        </View>
      </View>
      <View style={styles.metricInputRow}>
        <TextInput
          style={styles.metricInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={C.text3}
          textAlign="right"
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>
    </View>
  );
}

function RecapRow({ label, value, unit }: { label: string; value: string | null; unit?: string }) {
  const hasValue = value !== null && value !== '';
  return (
    <View style={styles.recapRow}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={hasValue ? styles.recapValue : styles.recapEmpty}>
        {hasValue ? `${value}${unit ? ` ${unit}` : ''}` : '—'}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('welcome');
  const [saving, setSaving] = useState(false);
  // Overlay opaque qui se superpose pendant la transition — jamais de fond transparent
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const [objectif, setObjectif] = useState('');
  const [niveau, setNiveau] = useState<string | null>(null);
  const [poids, setPoids] = useState('');
  const [fcMax, setFcMax] = useState('');

  function navigateTo(next: Step) {
    Animated.timing(overlayOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    });
  }

  function goBack() {
    const idx = WIZARD_STEPS.indexOf(step as any);
    if (idx <= 0) { navigateTo('welcome'); return; }
    navigateTo(WIZARD_STEPS[idx - 1]);
  }

  function goNext() {
    const idx = WIZARD_STEPS.indexOf(step as any);
    if (idx < WIZARD_STEPS.length - 1) navigateTo(WIZARD_STEPS[idx + 1]);
  }

  const progress = (() => {
    const idx = WIZARD_STEPS.indexOf(step as any);
    return idx < 0 ? 0 : (idx + 1) / WIZARD_STEPS.length;
  })();

  const bottomPad = insets.bottom + 20;

  async function saveData() {
    try {
      await updateAthleteProfile({ objectif: objectif.trim() || null, niveau: niveau ?? null });
      if (poids) await upsertUserMetric('poids_corporel', poids, 'user').catch(() => {});
      if (fcMax) await upsertUserMetric('fc_max', fcMax, 'user').catch(() => {});
      await refreshUser();
    } catch {}
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  }

  async function finishToMain() {
    setSaving(true);
    await saveData();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  async function finishToGenerate() {
    setSaving(true);
    await saveData();
    navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'Generate' }] });
  }

  function renderContent() {
    // ─── Welcome ──────────────────────────────────────────────────────────────
    if (step === 'welcome') return (
      <>
        <LinearGradient
          colors={['rgba(59,130,246,0.12)', 'transparent']}
          style={styles.topGlow}
          pointerEvents="none"
        />
        <View style={[styles.welcomeContent, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.logoSection}>
            <FibiLottie size={180} />
            <Text style={styles.appName}>TibFit</Text>
          </View>
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>{t('onboarding.welcome.title')}</Text>
            <Text style={styles.heroSubtitle}>{t('onboarding.welcome.subtitle')}</Text>
          </View>
          <View style={styles.fibiLines}>
            {(['line1', 'line2', 'line3'] as const).map((key) => (
              <View key={key} style={styles.fibiLine}>
                <Text style={styles.fibiQuote}>"</Text>
                <Text style={styles.fibiLineText}>{t(`onboarding.welcome.${key}`)}</Text>
              </View>
            ))}
          </View>
          <GradientCTA label={t('onboarding.welcome.cta')} onPress={() => navigateTo('objectifs_ask')} />
        </View>
      </>
    );

    // ─── Ask screens ──────────────────────────────────────────────────────────
    if (step === 'objectifs_ask' || step === 'niveau_ask') {
      const key = step;
      return (
        <>
          <StepHeader progress={progress} onBack={goBack} />
          <View style={styles.askContent}>
            <FibiLottie size={160} />
            <SpeechBubble text={t(`onboarding.${key}.bubble`)} />
          </View>
          <View style={[styles.bottomFixed, { paddingBottom: bottomPad }]}>
            <GradientCTA label={t(`onboarding.${key}.cta`)} onPress={goNext} />
          </View>
        </>
      );
    }

    // ─── Objectifs ────────────────────────────────────────────────────────────
    if (step === 'objectifs') return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StepHeader progress={progress} onBack={goBack} />
        <ScrollView contentContainerStyle={styles.inputContent} keyboardShouldPersistTaps="handled">
          <FibiLottie size={100} />
          <SpeechBubble text={t('onboarding.objectifs_ask.bubble')} />
          <TextInput
            style={styles.textArea}
            value={objectif}
            onChangeText={setObjectif}
            placeholder={t('onboarding.objectifs.placeholder')}
            placeholderTextColor={C.text3}
            multiline
            textAlignVertical="top"
            autoCorrect
            autoCapitalize="sentences"
          />
          <TouchableOpacity onPress={goNext} style={styles.skipBtn} activeOpacity={0.6}>
            <Text style={styles.skipLabel}>{t('onboarding.objectifs.skip')}</Text>
          </TouchableOpacity>
        </ScrollView>
        <View style={[styles.bottomFixed, { paddingBottom: bottomPad }]}>
          <GradientCTA
            label={t('onboarding.objectifs.cta')}
            onPress={() => { Keyboard.dismiss(); goNext(); }}
            disabled={objectif.trim().length === 0}
          />
        </View>
      </KeyboardAvoidingView>
    );

    // ─── Niveau ───────────────────────────────────────────────────────────────
    if (step === 'niveau') return (
      <>
        <StepHeader progress={progress} onBack={goBack} />
        <ScrollView contentContainerStyle={styles.inputContent}>
          <FibiLottie size={100} />
          <SpeechBubble text={t('onboarding.niveau_ask.bubble')} />
          <View style={styles.niveauGrid}>
            {NIVEAU_OPTIONS.map(({ value }) => {
              const selected = niveau === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setNiveau(value)}
                  activeOpacity={0.75}
                  style={[styles.niveauTile, selected && styles.niveauTileSelected]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.niveauLabel, selected && styles.niveauLabelSelected]}>
                      {t(`onboarding.niveau.${value}`)}
                    </Text>
                    <Text style={styles.niveauDesc}>{t(`onboarding.niveau.${value}_desc`)}</Text>
                  </View>
                  {selected && <Icon name="check" size={18} color={C.blue} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <View style={[styles.bottomFixed, { paddingBottom: bottomPad }]}>
          <GradientCTA label={t('onboarding.niveau_ask.cta')} onPress={goNext} disabled={niveau === null} />
        </View>
      </>
    );

    // ─── Métriques intro ──────────────────────────────────────────────────────
    if (step === 'metriques_intro') return (
      <>
        <StepHeader progress={progress} onBack={goBack} />
        <View style={styles.introContent}>
          <FibiLottie size={120} />
          <View style={styles.introBubble}>
            <Text style={styles.introBubbleText}>{t('onboarding.metriques_intro.bubble')}</Text>
          </View>
          <View style={styles.introExample}>
            <Text style={styles.introExampleTitle}>{t('onboarding.metriques_intro.example_title')}</Text>
            <View style={styles.introExampleRows}>
              <View style={styles.introExampleRow}>
                <Text style={styles.introExampleLabel}>{t('onboarding.metriques_intro.example_poids')}</Text>
                <Text style={styles.introExampleValue}>72 kg</Text>
              </View>
              <View style={styles.introExampleRow}>
                <Text style={styles.introExampleLabel}>{t('onboarding.metriques_intro.example_fc')}</Text>
                <Text style={styles.introExampleValue}>185 bpm</Text>
              </View>
              <View style={styles.introExampleRow}>
                <Text style={styles.introExampleLabel}>{t('onboarding.metriques_intro.example_vma')}</Text>
                <Text style={styles.introExampleValue}>14 km/h</Text>
              </View>
            </View>
            <Text style={styles.introExampleResult}>{t('onboarding.metriques_intro.example_result')}</Text>
          </View>
        </View>
        <View style={[styles.bottomFixed, { paddingBottom: bottomPad }]}>
          <GradientCTA label={t('onboarding.metriques_intro.cta')} onPress={goNext} />
        </View>
      </>
    );

    // ─── Métriques ────────────────────────────────────────────────────────────
    if (step === 'metriques') return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StepHeader progress={progress} onBack={goBack} />
        <ScrollView contentContainerStyle={styles.inputContent} keyboardShouldPersistTaps="handled">
          <FibiLottie size={100} />
          <SpeechBubble text={t('onboarding.metriques_intro.bubble')} />
          <View style={styles.metriquesStack}>
            <MetricCard icon="person" label={t('onboarding.metriques.poids')} unit="kg" value={poids} onChangeText={setPoids} placeholder="70" />
            <MetricCard icon="activity" label={t('onboarding.metriques.fc_max')} description={t('onboarding.metriques.fc_max_desc')} unit="bpm" value={fcMax} onChangeText={setFcMax} placeholder="185" />
          </View>
          <Text style={styles.metriquesNote}>{t('onboarding.metriques.note')}</Text>
        </ScrollView>
        <View style={[styles.bottomFixed, { paddingBottom: bottomPad }]}>
          <GradientCTA label={t('onboarding.metriques.cta')} onPress={() => { Keyboard.dismiss(); goNext(); }} />
        </View>
      </KeyboardAvoidingView>
    );

    // ─── Recap ────────────────────────────────────────────────────────────────
    if (step === 'recap') {
      const niveauLabel = niveau ? t(`onboarding.niveau.${niveau}`) : null;
      return (
        <>
          <StepHeader progress={progress} onBack={goBack} />
          <ScrollView contentContainerStyle={styles.inputContent}>
            <FibiLottie size={100} />
            <SpeechBubble text={t('onboarding.recap.bubble')} />
            <View style={styles.recapCard}>
              <RecapRow label={t('onboarding.recap.objectif')} value={objectif.trim() || null} />
              <View style={styles.recapDivider} />
              <RecapRow label={t('onboarding.recap.niveau')} value={niveauLabel} />
              <View style={styles.recapDivider} />
              <RecapRow label={t('onboarding.recap.poids')} value={poids || null} unit="kg" />
              <View style={styles.recapDivider} />
              <RecapRow label={t('onboarding.recap.fc_max')} value={fcMax || null} unit="bpm" />
            </View>
          </ScrollView>
          <View style={[styles.bottomFixed, { paddingBottom: bottomPad }]}>
            <GradientCTA label={t('onboarding.recap.cta')} onPress={goNext} />
          </View>
        </>
      );
    }

    // ─── Generate ─────────────────────────────────────────────────────────────
    return (
      <>
        <StepHeader progress={1} onBack={saving ? () => {} : goBack} />
        <View style={styles.askContent}>
          <FibiLottie size={160} />
          <SpeechBubble text={t('onboarding.generate.bubble')} />
        </View>
        <View style={[styles.bottomFixed, { paddingBottom: bottomPad }]}>
          <GradientCTA label={t('onboarding.generate.cta')} onPress={finishToGenerate} loading={saving} />
          <TouchableOpacity onPress={finishToMain} disabled={saving} style={styles.skipBtn} activeOpacity={0.6}>
            <Text style={styles.skipLabel}>{t('onboarding.generate.skip')}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {renderContent()}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: C.bg, opacity: overlayOpacity }]}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },

  // Welcome
  welcomeContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 100,
    justifyContent: 'space-between',
  },
  logoSection: { alignItems: 'center', paddingTop: 16 },
  appName: { fontSize: 28, fontWeight: '700', color: C.text, marginTop: 4 },
  heroSection: { alignItems: 'center', paddingHorizontal: 8 },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: C.text,
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  heroSubtitle: { fontSize: 15, color: C.text2, textAlign: 'center', lineHeight: 22 },
  fibiLines: { gap: 10, paddingHorizontal: 4 },
  fibiLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  fibiQuote: { fontSize: 20, color: C.blue, fontWeight: '700', lineHeight: 22, marginTop: -1 },
  fibiLineText: { fontSize: 14, color: C.text, fontWeight: '500', flex: 1, lineHeight: 20 },

  // Ask screens
  askContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 24,
    paddingBottom: 80,
  },

  // Speech bubble
  speechBubble: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: '100%',
  },
  speechBubbleText: { fontSize: 16, color: C.text, lineHeight: 24, textAlign: 'center' },

  // Input screens
  inputContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 120,
    alignItems: 'center',
    gap: 16,
  },

  // Bottom CTA (fixed above safe area)
  bottomFixed: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: C.bg,
  },

  // CTA button
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
  },
  ctaLabel: { fontSize: 17, fontWeight: '700', color: '#fff' },
  ctaLabelDisabled: { color: C.text3 },
  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipLabel: { fontSize: 14, color: C.text3, fontWeight: '500' },

  // Step header
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  progressBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: C.blue, borderRadius: 2 },

  // Objectifs
  textArea: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 110,
    width: '100%',
  },

  // Niveau
  niveauGrid: { gap: 10, width: '100%' },
  niveauTile: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  niveauTileSelected: { borderColor: C.blue, backgroundColor: C.blueLight },
  niveauIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.bg3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  niveauIconWrapSelected: { backgroundColor: C.blue + '25' },
  niveauLabel: { fontSize: 15, fontWeight: '700', color: C.text, textTransform: 'capitalize' },
  niveauLabelSelected: { color: C.blue },
  niveauDesc: { fontSize: 12, color: C.text3, marginTop: 2 },

  // Métriques
  metriquesStack: { gap: 10, width: '100%' },
  metricCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metricLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  metricDesc: { fontSize: 12, color: C.text3, marginTop: 2 },
  metricInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricInput: {
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: C.text,
    fontSize: 16,
    fontWeight: '600',
    width: 72,
  },
  metricUnit: { fontSize: 13, color: C.text3, fontWeight: '500', width: 32 },
  metriquesNote: { fontSize: 12, color: C.text3, textAlign: 'center', lineHeight: 18 },

  // Métriques intro
  introContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 100,
    alignItems: 'center',
    gap: 20,
  },
  introBubble: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: '100%',
  },
  introBubbleText: { fontSize: 15, color: C.text, lineHeight: 22, textAlign: 'center' },
  introExample: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.blue,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: '100%',
    gap: 12,
  },
  introExampleTitle: { fontSize: 13, color: C.text2, fontWeight: '600', marginBottom: 4 },
  introExampleRows: { gap: 8 },
  introExampleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  introExampleLabel: { fontSize: 14, color: C.text2 },
  introExampleValue: { fontSize: 14, color: C.blue, fontWeight: '700' },
  introExampleResult: { fontSize: 13, color: C.text3, lineHeight: 18, fontStyle: 'italic' },

  // Recap
  recapCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 16,
  },
  recapDivider: { height: 1, backgroundColor: C.border },
  recapLabel: { fontSize: 13, color: C.text2, fontWeight: '500', flexShrink: 0 },
  recapValue: { fontSize: 13, color: C.text, fontWeight: '600', textAlign: 'right', flex: 1 },
  recapEmpty: { fontSize: 13, color: C.text3, textAlign: 'right', flex: 1 },
});
