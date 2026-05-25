import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { C } from '../constants/colors';
import { Button } from '../components/ui';
import { recalibratePlanStream } from '../services/api';
import { parseCompletedSeances, SeancePreview } from './GenerateScreen';
import { usePurchase } from '../context/PurchaseContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Recalibration'>;

type Phase = 'generating' | 'success' | 'error';

export default function RecalibrationScreen({ route, navigation }: Props) {
  const { metricId, planId, streakCount, planCouleur } = route.params;
  const { showPaywall } = usePurchase();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('generating');
  const [seances, setSeances] = useState<SeancePreview[]>([]);
  const [nbSeances, setNbSeances] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const bufferRef = useRef('');

  useEffect(() => {
    if (phase !== 'generating') return;
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      Alert.alert(
        t('recalibration.leaveTitle'),
        t('recalibration.leaveMsg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('recalibration.leaveConfirm'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, phase, t]);

  useEffect(() => {
    recalibratePlanStream(
      metricId,
      (chunk) => {
        bufferRef.current += chunk;
        const parsed = parseCompletedSeances(bufferRef.current);
        if (parsed.length > seances.length) {
          setSeances(parsed);
        }
      },
      (pid, nb) => {
        setNbSeances(nb);
        setPhase('success');
      },
      (msg) => {
        if (msg === 'PREMIUM_REQUIRED') {
          navigation.goBack();
          showPaywall(streakCount ? () =>
            navigation.navigate('StreakCelebration', { streakCount, planCouleur, planId })
          : undefined);
        } else {
          setErrorMsg(msg);
          setPhase('error');
        }
      },
    );
  }, [metricId]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {phase === 'generating' && (
        <ScrollView contentContainerStyle={styles.content}>
          <LottieView
            source={require('../../assets/Fibi.json')}
            autoPlay
            loop
            style={styles.fibi}
          />
          <Text style={styles.title}>{t('recalibration.generating')}</Text>
          {seances.length > 0 && (
            <Text style={styles.subtitle}>
              {t('recalibration.seancesUpdated', { count: seances.length })}
            </Text>
          )}
          {seances.map((s, i) => (
            <View key={i} style={styles.seanceRow}>
              <Text style={styles.seanceEmoji}>{s.emoji ?? '🏃'}</Text>
              <View style={styles.seanceInfo}>
                <Text style={styles.seanceTitle} numberOfLines={1}>{s.titre}</Text>
                <Text style={styles.seanceMeta}>{s.date} · {s.duree_minutes} min</Text>
              </View>
            </View>
          ))}
          <ActivityIndicator color={C.blue} style={{ marginTop: 24 }} />
        </ScrollView>
      )}

      {phase === 'success' && (
        <View style={styles.content}>
          <LottieView
            source={require('../../assets/Fibi.json')}
            autoPlay
            loop={false}
            style={styles.fibi}
          />
          <Text style={styles.title}>{t('recalibration.success')}</Text>
          <Text style={styles.subtitle}>
            {t('recalibration.successDetail', { nb: nbSeances })}
          </Text>
          <Button
            variant="success"
            label={t('recalibration.seePlan')}
            onPress={() => {
              if (streakCount) {
                navigation.replace('StreakCelebration', { streakCount, planCouleur, planId });
              } else {
                navigation.goBack();
              }
            }}
            full
          />
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.content}>
          <Text style={styles.title}>{t('recalibration.error')}</Text>
          <Text style={styles.subtitle}>{errorMsg}</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <View style={[styles.btnGradient, { backgroundColor: C.text2 }]}>
              <Text style={styles.btnLabel}>{t('common.back')}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, alignItems: 'center', padding: 24 },
  fibi: { width: 100, height: 100, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: C.text2, textAlign: 'center', marginBottom: 20 },
  seanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, width: '100%' },
  seanceEmoji: { fontSize: 22 },
  seanceInfo: { flex: 1 },
  seanceTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  seanceMeta: { fontSize: 12, color: C.text3 },
  btn: { marginTop: 24, width: '100%' },
  btnGradient: { borderRadius: 14, padding: 16, alignItems: 'center' },
  btnLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
