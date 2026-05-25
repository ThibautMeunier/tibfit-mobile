import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { C } from '../constants/colors';
import { SectionLabel, Button } from '../components/ui';
import { submitWeeklyCheckin } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'WeeklyCheckin'>;

type Phase = 'form' | 'submitting' | 'success';

const STRESS_EMOJIS = ['😌', '🙂', '😐', '😓', '😰'];
const SLEEP_EMOJIS  = ['😴', '🙂', '😐', '🥱', '😫'];

export default function WeeklyCheckinScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('form');
  const [stress, setStress] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [weightStr, setWeightStr] = useState('');

  async function handleSubmit() {
    setPhase('submitting');
    const weight = weightStr.trim() ? parseFloat(weightStr.replace(',', '.')) : null;
    try {
      await submitWeeklyCheckin({
        stress_level: stress,
        sleep_quality: sleep,
        weight_kg: weight && !isNaN(weight) ? weight : null,
      });
      setPhase('success');
    } catch {
      setPhase('form');
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <LottieView
          source={require('../../assets/Fibi.json')}
          autoPlay
          loop={phase !== 'success'}
          style={styles.fibi}
        />

        {(phase === 'form' || phase === 'submitting') && (
          <>
            <Text style={styles.title}>{t('weeklyCheckin.title')}</Text>
            <Text style={styles.subtitle}>{t('weeklyCheckin.subtitle')}</Text>

            {/* Stress */}
            <View style={{ alignSelf: 'stretch' }}>
              <SectionLabel label={t('weeklyCheckin.stressLabel')} />
            </View>
            <View style={styles.scaleRow}>
              {STRESS_EMOJIS.map((emoji, i) => {
                const val = i + 1;
                return (
                  <TouchableOpacity
                    key={val}
                    style={[styles.scaleBtn, stress === val && styles.scaleBtnSelected]}
                    onPress={() => setStress(val)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.scaleEmoji}>{emoji}</Text>
                    <Text style={[styles.scaleNum, stress === val && styles.scaleNumSelected]}>{val}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.scaleHints}>
              <Text style={styles.scaleHint}>{t('weeklyCheckin.stressLow')}</Text>
              <Text style={styles.scaleHint}>{t('weeklyCheckin.stressHigh')}</Text>
            </View>

            {/* Sommeil */}
            <View style={{ alignSelf: 'stretch' }}>
              <SectionLabel label={t('weeklyCheckin.sleepLabel')} />
            </View>
            <View style={styles.scaleRow}>
              {SLEEP_EMOJIS.map((emoji, i) => {
                const val = i + 1;
                return (
                  <TouchableOpacity
                    key={val}
                    style={[styles.scaleBtn, sleep === val && styles.scaleBtnSelected]}
                    onPress={() => setSleep(val)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.scaleEmoji}>{emoji}</Text>
                    <Text style={[styles.scaleNum, sleep === val && styles.scaleNumSelected]}>{val}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.scaleHints}>
              <Text style={styles.scaleHint}>{t('weeklyCheckin.sleepLow')}</Text>
              <Text style={styles.scaleHint}>{t('weeklyCheckin.sleepHigh')}</Text>
            </View>

            {/* Poids */}
            <View style={{ alignSelf: 'stretch' }}>
              <SectionLabel label={t('weeklyCheckin.weightLabel')} />
            </View>
            <View style={styles.weightRow}>
              <TextInput
                style={styles.weightInput}
                keyboardType="decimal-pad"
                placeholder={t('weeklyCheckin.weightPlaceholder')}
                placeholderTextColor={C.text3}
                value={weightStr}
                onChangeText={setWeightStr}
              />
              <Text style={styles.weightUnit}>kg</Text>
            </View>

            <Button
              variant="primary"
              label={t('weeklyCheckin.submit')}
              onPress={handleSubmit}
              disabled={phase === 'submitting'}
              icon={phase === 'submitting' ? <ActivityIndicator size="small" color="#fff" /> : undefined}
              full
              size="lg"
            />

            <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.skipLabel}>{t('weeklyCheckin.skip')}</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'success' && (
          <>
            <Text style={styles.title}>{t('weeklyCheckin.successTitle')}</Text>
            <Text style={styles.subtitle}>{t('weeklyCheckin.successSubtitle')}</Text>
            <Button
              variant="success"
              label={t('weeklyCheckin.done')}
              onPress={() => navigation.navigate('Main')}
              full
              size="lg"
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 24 },
  fibi: { width: 90, height: 90, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: C.text2, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  sectionLabel: {
    alignSelf: 'flex-start',
    fontSize: 12, fontWeight: '600', color: C.text3,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 10,
  },
  scaleRow: { flexDirection: 'row', gap: 8, marginBottom: 6, alignSelf: 'stretch', justifyContent: 'space-between' },
  scaleBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card,
  },
  scaleBtnSelected: { borderColor: C.blue, backgroundColor: C.blueLight },
  scaleEmoji: { fontSize: 20, marginBottom: 2 },
  scaleNum: { fontSize: 11, fontWeight: '600', color: C.text3 },
  scaleNumSelected: { color: C.blue },
  scaleHints: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginBottom: 24 },
  scaleHint: { fontSize: 11, color: C.text3 },
  weightRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 32, gap: 8 },
  weightInput: {
    flex: 1, backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    color: C.text, fontSize: 16, padding: 12,
  },
  weightUnit: { fontSize: 15, color: C.text2, fontWeight: '600' },
  submitBtn: { width: '100%', marginBottom: 12 },
  submitBtnInner: { borderRadius: 14, padding: 16, alignItems: 'center' },
  submitBtnLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
  skipBtn: { padding: 12 },
  skipLabel: { fontSize: 14, color: C.text3, fontWeight: '600' },
});
