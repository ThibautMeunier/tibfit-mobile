import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LineChart } from 'react-native-gifted-charts';
import { C } from '../constants/colors';
import { getMetricsHistory, MetricSnapshot } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SkeletonBlock from '../components/SkeletonBlock';
import { useTranslation } from 'react-i18next';
import { NavHeader } from '../components/ui';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 40 - 32; // padding + card padding

interface MetricConfig {
  key: keyof Pick<MetricSnapshot, 'vma' | 'ftp' | 'poids_kg' | 'fc_max'>;
  label: string;
  unit: string;
  color: string;
}

const METRICS: MetricConfig[] = [
  { key: 'vma',     label: 'VMA',     unit: 'km/h',  color: C.blue },
  { key: 'ftp',     label: 'FTP',     unit: 'W',     color: '#8B5CF6' },
  { key: 'poids_kg',label: 'Poids',   unit: 'kg',    color: C.orange },
  { key: 'fc_max',  label: 'FC max',  unit: 'bpm',   color: C.red },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function MetricCard({ config, snapshots }: { config: MetricConfig; snapshots: MetricSnapshot[] }) {
  const { t } = useTranslation();
  const relevant = snapshots.filter((s) => s[config.key] != null);

  if (relevant.length === 0) return null;

  const values = relevant.map((s) => s[config.key] as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const latest = values[values.length - 1];
  const first = values[0];
  const delta = latest - first;

  const data = relevant.map((s, i) => ({
    value: s[config.key] as number,
    label: i === 0 || i === relevant.length - 1 ? formatDate(s.recorded_at) : '',
    dataPointText: i === relevant.length - 1 ? String(latest) : '',
  }));

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{config.label}</Text>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardValue, { color: config.color }]}>
            {latest} <Text style={styles.cardUnit}>{config.unit}</Text>
          </Text>
          {relevant.length > 1 && (
            <Text style={[styles.cardDelta, { color: delta >= 0 ? C.green : C.red }]}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
            </Text>
          )}
        </View>
      </View>

      {relevant.length < 2 ? (
        <Text style={styles.noDataText}>{t('stats.needSecondMeasure')}</Text>
      ) : (
        <LineChart
          data={data}
          width={CHART_WIDTH}
          height={120}
          color={config.color}
          thickness={2}
          curved
          hideDataPoints={false}
          dataPointsColor={config.color}
          dataPointsRadius={3}
          startFillColor={config.color}
          endFillColor={config.color}
          startOpacity={0.15}
          endOpacity={0.01}
          areaChart
          backgroundColor="transparent"
          xAxisColor={C.border}
          yAxisColor="transparent"
          yAxisTextStyle={styles.axisText}
          xAxisLabelTextStyle={styles.axisText}
          hideRules
          initialSpacing={10}
          endSpacing={10}
          maxValue={max + (max - min) * 0.2 || max + 1}
          noOfSections={3}
          showDataPointOnFocus
          focusedDataPointRadius={5}
          textShiftX={-8}
          textShiftY={-10}
          textFontSize={11}
          textColor={C.text}
        />
      )}
    </View>
  );
}

export default function StatsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { handleSessionExpired } = useAuth();

  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getMetricsHistory();
        setSnapshots(data);
      } catch (e: any) {
        if (e?.message === 'SESSION_EXPIRED') { handleSessionExpired(); return; }
        setError(e?.message ?? t('common.error'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasAnyData = METRICS.some((m) => snapshots.some((s) => s[m.key] != null));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NavHeader title={t('stats.title')} onBack={() => navigation.goBack()} />

      {loading ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <SkeletonBlock width={160} height={13} borderRadius={5} style={{ marginBottom: 20 }} />
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} width="100%" height={130} borderRadius={16} style={{ marginBottom: 16 }} />
          ))}
        </ScrollView>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !hasAnyData ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{t('stats.noData')}</Text>
          <Text style={styles.emptySubtitle}>{t('stats.noDataDesc')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>{t('stats.snapshotCount', { count: snapshots.length })}</Text>
          {METRICS.map((m) => (
            <MetricCard key={m.key} config={m} snapshots={snapshots} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { color: C.red, fontSize: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: C.text2, textAlign: 'center', lineHeight: 20 },

  scroll: { paddingHorizontal: 20, paddingTop: 4 },
  subtitle: { fontSize: 12, color: C.text3, marginBottom: 16 },

  card: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 16, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: C.text2, letterSpacing: 0.4 },
  cardMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cardValue: { fontSize: 22, fontWeight: '700' },
  cardUnit: { fontSize: 13, fontWeight: '400', color: C.text3 },
  cardDelta: { fontSize: 13, fontWeight: '600' },

  noDataText: { fontSize: 13, color: C.text3, fontStyle: 'italic' },
  axisText: { fontSize: 10, color: C.text3 },
});
