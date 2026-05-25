import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { SectionLabel, Button } from '../components/ui';
import { checkExtendTest, ExtendTestCheckResult, extendPlanStream } from '../services/api';
import { parseCompletedSeances, SeancePreview } from './GenerateScreen';
import DaysWeeksSelector, { JOURS_FR, Jour } from '../components/DaysWeeksSelector';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanEnding'>;

type Phase = 'select' | 'generating' | 'success' | 'error';

export default function PlanEndingScreen({ route, navigation }: Props) {
  const { planId, suggestedJours } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedWeeks, setSelectedWeeks] = useState(2);
  const [selectedJours, setSelectedJours] = useState<Set<Jour>>(
    new Set((suggestedJours ?? []).filter((j): j is Jour => JOURS_FR.includes(j as Jour)))
  );
  const [seances, setSeances] = useState<SeancePreview[]>([]);
  const [nbSeances, setNbSeances] = useState(0);
  const bufferRef = useRef('');
  const [testCheck, setTestCheck] = useState<ExtendTestCheckResult | null>(null);
  const [includeTest, setIncludeTest] = useState(false);

  useEffect(() => {
    checkExtendTest(planId)
      .then((r) => {
        setTestCheck(r);
        if (r.suggest_test) setIncludeTest(true);
        if (r.jours_semaine && r.jours_semaine.length > 0) {
          setSelectedJours(new Set(r.jours_semaine.filter((j): j is Jour => JOURS_FR.includes(j as Jour))));
        }
      })
      .catch(() => {});
  }, [planId]);

  function toggleJour(jour: Jour) {
    setSelectedJours((prev) => {
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

  const sortedJours = JOURS_FR.filter((j) => selectedJours.has(j));

  function handleExtend() {
    setPhase('generating');
    bufferRef.current = '';
    setSeances([]);
    extendPlanStream(
      planId,
      selectedWeeks,
      (chunk) => {
        bufferRef.current += chunk;
        const parsed = parseCompletedSeances(bufferRef.current);
        if (parsed.length > seances.length) setSeances(parsed);
      },
      (_pid, nb) => {
        setNbSeances(nb);
        setPhase('success');
      },
      () => setPhase('error'),
      sortedJours.length > 0 ? sortedJours : null,
      includeTest,
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      {phase === 'select' && (
        <ScrollView contentContainerStyle={styles.selectContent} showsVerticalScrollIndicator={false}>
          <LottieView
            source={require('../../assets/Fibi.json')}
            autoPlay
            loop
            style={styles.fibi}
          />
          <Text style={styles.title}>{t('planEnding.title')}</Text>
          <Text style={styles.subtitle}>{t('planEnding.subtitle')}</Text>

          <View style={{ alignSelf: 'stretch' }}>
            <SectionLabel label={t('planEnding.daysLabel')} />
          </View>
          <DaysWeeksSelector
            selectedJours={selectedJours}
            onToggleJour={toggleJour}
            selectedWeeks={selectedWeeks}
            onSelectWeeks={setSelectedWeeks}
            weeksLabel={t('planEnding.durationLabel')}
            weekLabel={(count) => t('planEnding.week', { count })}
          />

          {testCheck?.suggest_test && (
            <TouchableOpacity
              style={[styles.testCard, includeTest && styles.testCardActive]}
              onPress={() => setIncludeTest((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={styles.testCardHeader}>
                <Text style={[styles.testCardTitle, includeTest && styles.testCardTitleActive]}>
                  {t('planEnding.testTitle', { metric: testCheck.metric_label })}
                </Text>
                <View style={[styles.testCardCheckbox, includeTest && styles.testCardCheckboxActive]}>
                  {includeTest && <Text style={styles.testCardCheckmark}>✓</Text>}
                </View>
              </View>
              <Text style={styles.testCardSubtitle}>
                {testCheck.weeks_since_update != null
                  ? t('planEnding.testSubtitle', { weeks: testCheck.weeks_since_update })
                  : t('planEnding.testSubtitleNoDate')}
              </Text>
            </TouchableOpacity>
          )}

          <Button variant="primary" label={t('planEnding.confirmBtn')} onPress={handleExtend} full />

          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelBtnLabel}>{t('planEnding.cancelBtn')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {phase === 'generating' && (
        <ScrollView contentContainerStyle={styles.generatingContent}>
          <LottieView
            source={require('../../assets/Fibi.json')}
            autoPlay
            loop
            style={styles.fibi}
          />
          <Text style={styles.title}>{t('planEnding.extending')}</Text>
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
        <View style={styles.centeredContent}>
          <LottieView
            source={require('../../assets/Fibi.json')}
            autoPlay
            loop={false}
            style={styles.fibi}
          />
          <Text style={styles.title}>{t('planEnding.successTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('planEnding.successDetail', { nb: nbSeances })}
          </Text>
          <Button variant="success" label={t('planEnding.seePlan')} onPress={() => navigation.navigate('Main', { screen: 'Plan', params: { planId } })} full />
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.centeredContent}>
          <Text style={styles.title}>{t('planEnding.errorMsg')}</Text>
          <Button
            variant="secondary"
            label={t('common.back')}
            onPress={() => navigation.goBack()}
            full
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24 },
  selectContent: { alignItems: 'center', paddingBottom: 40 },
  fibi: { width: 100, height: 100, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: C.text2, textAlign: 'center', marginBottom: 28, lineHeight: 22 },

  testCard: {
    alignSelf: 'stretch',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.card,
    padding: 14,
    marginBottom: 20,
  },
  testCardActive: { borderColor: C.blue, backgroundColor: C.blueLight },
  testCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  testCardTitle: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  testCardTitleActive: { color: C.blue },
  testCardSubtitle: { fontSize: 12, color: C.text3, lineHeight: 18 },
  testCardCheckbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
  },
  testCardCheckboxActive: { borderColor: C.blue, backgroundColor: C.blue },
  testCardCheckmark: { color: '#fff', fontSize: 13, fontWeight: '700' },

  cancelBtn: { padding: 12 },
  cancelBtnLabel: { fontSize: 14, color: C.text3, fontWeight: '600' },

  generatingContent: { alignItems: 'center', paddingBottom: 40, width: '100%' },
  centeredContent: { flex: 1, alignItems: 'center', width: '100%' },
  seanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, width: '100%' },
  seanceEmoji: { fontSize: 22 },
  seanceInfo: { flex: 1 },
  seanceTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  seanceMeta: { fontSize: 12, color: C.text3 },
});
