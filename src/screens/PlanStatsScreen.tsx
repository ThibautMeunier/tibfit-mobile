import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { C, sessionColor } from '../constants/colors';
import { getPlans, getSeances, getPlanScoreHistory, getPlanStats, getPlanStreakHistory, getPlanComparison, ScoreSnapshot, PlanStats, PlanStreakEntry, PlanComparison } from '../services/api';
import { saveToCache, getFromCache } from '../services/offlineCache';
import { Plan, Seance } from '../types';
import { useAuth } from '../context/AuthContext';
import OfflineBanner from '../components/OfflineBanner';
import SkeletonBlock from '../components/SkeletonBlock';
import { localDateStr } from '../utils/date';
import { NavHeader, Chip, ChipGroup } from '../components/ui';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 40 - 32;

function PlanStatsSkeleton() {
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <SkeletonBlock width={110} height={32} borderRadius={20} />
        <SkeletonBlock width={130} height={32} borderRadius={20} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
        {[48, 68, 68, 68, 52, 44].map((w, i) => (
          <SkeletonBlock key={i} width={w} height={28} borderRadius={16} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} style={{ flex: 1 }} height={72} borderRadius={14} />
        ))}
      </View>
      <SkeletonBlock width="100%" height={200} borderRadius={16} style={{ marginBottom: 16 }} />
      <SkeletonBlock width="100%" height={200} borderRadius={16} style={{ marginBottom: 20 }} />
      {[0, 1, 2, 3].map((i) => (
        <SkeletonBlock key={i} width="100%" height={58} borderRadius={14} style={{ marginBottom: 8 }} />
      ))}
    </ScrollView>
  );
}

type Period = '7j' | '1m' | '3m' | '6m' | '1a' | 'tout';
const PERIOD_DAYS: { key: Period; days: number | null }[] = [
  { key: '7j',   days: 7 },
  { key: '1m',   days: 30 },
  { key: '3m',   days: 90 },
  { key: '6m',   days: 180 },
  { key: '1a',   days: 365 },
  { key: 'tout', days: null },
];

function cutoff(days: number | null): Date | null {
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function weekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

function fmt(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

interface WeekBar {
  value: number;
  topLabelComponent?: () => JSX.Element;
  label: string;
  frontColor: string;
  total: number;
}

function buildWeekBars(seances: Seance[], since: Date | null): WeekBar[] {
  const filtered = since
    ? seances.filter((s) => new Date(s.date) >= since)
    : seances;

  const map = new Map<string, { completed: number; total: number }>();
  for (const s of filtered) {
    const w = weekStart(s.date);
    const prev = map.get(w) ?? { completed: 0, total: 0 };
    map.set(w, {
      completed: prev.completed + (s.completee ? 1 : 0),
      total: prev.total + 1,
    });
  }

  const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([week, { completed, total }]) => ({
    value: completed,
    label: fmt(week),
    frontColor: completed === total ? C.green : completed > 0 ? C.blue : C.border,
    total,
  }));
}

function buildScoreLine(history: ScoreSnapshot[], since: Date | null) {
  const filtered = since
    ? history.filter((s) => new Date(s.calcule_le) >= since)
    : history;
  return filtered.map((s, i) => ({
    value: s.score,
    label: i === 0 || i === filtered.length - 1 ? fmt(s.calcule_le) : '',
  }));
}

export default function PlanStatsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'PlanStats'>>();
  const { handleSessionExpired } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [period, setPeriod] = useState<Period>('3m');
  const [seances, setSeances] = useState<Seance[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScoreSnapshot[]>([]);
  const [planStats, setPlanStats] = useState<PlanStats | null>(null);
  const [streakHistory, setStreakHistory] = useState<PlanStreakEntry[]>([]);
  const [comparison, setComparison] = useState<PlanComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const loadedPlanId = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getPlans();
        await saveToCache('plans', data);
        setPlans(data);
        const preselect = route.params?.planId;
        const initial = preselect && data.some((p) => p.id === preselect)
          ? preselect
          : data.length > 0 ? data[0].id : null;
        if (initial !== null) setSelectedPlanId(initial);
      } catch (e: any) {
        if (e?.message === 'SESSION_EXPIRED') { handleSessionExpired(); return; }
        const cached = await getFromCache<Plan[]>('plans');
        if (cached) {
          setPlans(cached);
          const preselect = route.params?.planId;
          const initial = preselect && cached.some((p) => p.id === preselect)
            ? preselect
            : cached.length > 0 ? cached[0].id : null;
          if (initial !== null) setSelectedPlanId(initial);
          setIsOffline(e instanceof TypeError);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadPlanData = useCallback(async (planId: number) => {
    if (loadedPlanId.current === planId) return;
    setLoadingPlan(true);
    try {
      const [s, h, st, sh, cmp] = await Promise.all([
        getSeances(planId),
        getPlanScoreHistory(planId),
        getPlanStats(planId),
        getPlanStreakHistory(planId),
        getPlanComparison(planId),
      ]);
      await Promise.all([
        saveToCache(`seances_${planId}`, s),
        saveToCache(`score_history_${planId}`, h),
        saveToCache(`plan_stats_${planId}`, st),
        saveToCache(`streak_history_${planId}`, sh),
        saveToCache(`comparison_${planId}`, cmp),
      ]);
      setSeances(s);
      setScoreHistory(h);
      setPlanStats(st);
      setStreakHistory(sh);
      setComparison(cmp);
      setIsOffline(false);
      loadedPlanId.current = planId;
    } catch (e: any) {
      if (e?.message === 'SESSION_EXPIRED') { handleSessionExpired(); return; }
      const [cs, ch, cst, csh, ccmp] = await Promise.all([
        getFromCache<Seance[]>(`seances_${planId}`),
        getFromCache<ScoreSnapshot[]>(`score_history_${planId}`),
        getFromCache<PlanStats>(`plan_stats_${planId}`),
        getFromCache<PlanStreakEntry[]>(`streak_history_${planId}`),
        getFromCache<PlanComparison>(`comparison_${planId}`),
      ]);
      if (cs || ch || cst) {
        setSeances(cs ?? []);
        setScoreHistory(ch ?? []);
        setPlanStats(cst ?? null);
        setStreakHistory(csh ?? []);
        setComparison(ccmp ?? null);
        setIsOffline(e instanceof TypeError);
        loadedPlanId.current = planId;
      }
    } finally {
      setLoadingPlan(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPlanId !== null) {
      loadedPlanId.current = null;
      loadPlanData(selectedPlanId);
    }
  }, [selectedPlanId]);

  const since = cutoff(PERIOD_DAYS.find((p) => p.key === period)?.days ?? null);
  const weekBars = buildWeekBars(seances, since);
  const scoreLine = buildScoreLine(scoreHistory, since);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const accent = sessionColor(selectedPlan?.couleur);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NavHeader title={t('planStats.title')} onBack={() => navigation.goBack()} />

      <OfflineBanner visible={isOffline} />

      {loading ? (
        <PlanStatsSkeleton />
      ) : plans.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{t('plan.emptyStatsTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('planStats.emptyDesc')}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        >
          {/* Plan selector */}
          <ChipGroup>
            {plans.map((plan) => {
              const color = sessionColor(plan.couleur);
              return (
                <Chip
                  key={plan.id}
                  label={`${plan.emoji ? plan.emoji + ' ' : ''}${plan.titre}`}
                  active={plan.id === selectedPlanId}
                  color={color}
                  onPress={() => setSelectedPlanId(plan.id)}
                />
              );
            })}
          </ChipGroup>

          {/* Period filter */}
          <View style={styles.periodRow}>
            <ChipGroup>
              {PERIOD_DAYS.map((p) => (
                <Chip
                  key={p.key}
                  label={t(`planStats.periods.${p.key}`)}
                  size="sm"
                  active={period === p.key}
                  onPress={() => setPeriod(p.key)}
                />
              ))}
            </ChipGroup>
          </View>

          {loadingPlan ? (
            <View style={styles.center}><ActivityIndicator color={C.blue} /></View>
          ) : (
            <>
              {/* Summary row */}
              {planStats && (
                <>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryValue}>
                        {Math.round(planStats.taux_completion * 100)}%
                      </Text>
                      <Text style={styles.summaryLabel}>{t('planStats.completion')}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryValue}>
                        {fmtDuration(planStats.duree_completee_minutes)}
                      </Text>
                      <Text style={styles.summaryLabel}>{t('planStats.durationCompleted')}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={[styles.summaryValue, { color: planStats.charge_semaine_courante >= planStats.charge_semaine_precedente ? C.green : C.orange }]}>
                        {fmtDuration(planStats.charge_semaine_courante)}
                      </Text>
                      <Text style={styles.summaryLabel}>{t('planStats.thisWeek')}</Text>
                    </View>
                  </View>
                  {planStats.streak > 0 && (
                    <View style={styles.streakRow}>
                      <Text style={styles.streakFlame}>🔥</Text>
                      <Text style={styles.streakCount}>{t('planStats.streak', { count: planStats.streak })}</Text>
                    </View>
                  )}
                </>
              )}

              {/* Historique de streak */}
              {streakHistory.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{t('planStats.streakHistory')}</Text>
                  {streakHistory.slice(0, 5).map((entry, i) => (
                    <View key={i} style={styles.streakHistoryRow}>
                      <View style={styles.streakHistoryLeft}>
                        <Text style={styles.streakHistoryLength}>
                          {t('planStats.streakDays', { count: entry.streak_length })}
                        </Text>
                        <Text style={styles.streakHistoryDates}>
                          {new Date(entry.started_on + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          {' → '}
                          {new Date(entry.ended_on + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                      {i === 0 && <Text style={styles.streakBestBadge}>{t('planStats.streakBest')}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {/* Comparaison mois courant vs mois précédent */}
              {comparison && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{t('planStats.comparisonTitle')}</Text>
                  {[
                    {
                      label: t('planStats.comparisonSessions'),
                      current: comparison.current.nb_seances,
                      previous: comparison.previous.nb_seances,
                      fmt: (v: number) => String(v),
                    },
                    {
                      label: t('planStats.comparisonVolume'),
                      current: comparison.current.volume_minutes,
                      previous: comparison.previous.volume_minutes,
                      fmt: (v: number) => fmtDuration(v),
                    },
                    {
                      label: t('planStats.comparisonDistance'),
                      current: comparison.current.distance_km,
                      previous: comparison.previous.distance_km,
                      fmt: (v: number) => `${v.toFixed(1)} km`,
                    },
                    ...(comparison.current.rpe_moyen !== null || comparison.previous.rpe_moyen !== null ? [{
                      label: t('planStats.comparisonRpe'),
                      current: comparison.current.rpe_moyen ?? 0,
                      previous: comparison.previous.rpe_moyen ?? 0,
                      fmt: (v: number) => v > 0 ? v.toFixed(1) : '—',
                    }] : []),
                  ].map((row) => {
                    const diff = row.current - row.previous;
                    const up = diff > 0;
                    const neutral = diff === 0 || row.previous === 0;
                    const deltaColor = neutral ? C.text3 : up ? C.green : C.orange;
                    return (
                      <View key={row.label} style={styles.compRow}>
                        <Text style={styles.compLabel}>{row.label}</Text>
                        <View style={styles.compValues}>
                          <Text style={styles.compPrev}>{row.fmt(row.previous)}</Text>
                          <Text style={styles.compArrow}>→</Text>
                          <Text style={[styles.compCurrent, { color: accent }]}>{row.fmt(row.current)}</Text>
                          {!neutral && (
                            <Text style={[styles.compDelta, { color: deltaColor }]}>
                              {up ? '↑' : '↓'}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                  <View style={styles.compLegend}>
                    <Text style={styles.compLegendText}>{t('planStats.comparisonLegend')}</Text>
                  </View>
                </View>
              )}

              {/* Séances par semaine */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('planStats.sessionsPerWeek')}</Text>
                {weekBars.length === 0 ? (
                  <Text style={styles.noData}>{t('plan.emptyStatsPeriod')}</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <BarChart
                      data={weekBars}
                      width={Math.max(CHART_WIDTH, weekBars.length * 36)}
                      height={140}
                      barWidth={24}
                      barBorderRadius={4}
                      spacing={12}
                      xAxisColor={C.border}
                      yAxisColor="transparent"
                      yAxisTextStyle={styles.axisText}
                      xAxisLabelTextStyle={styles.axisText}
                      hideRules
                      noOfSections={4}
                      isAnimated
                      maxValue={Math.max(...weekBars.map((b) => b.total), 1)}
                      stepValue={1}
                      labelWidth={32}
                      initialSpacing={8}
                      endSpacing={8}
                    />
                  </ScrollView>
                )}
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: C.green }]} />
                    <Text style={styles.legendLabel}>{t('planStats.allCompleted')}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: C.blue }]} />
                    <Text style={styles.legendLabel}>{t('planStats.partial')}</Text>
                  </View>
                </View>
              </View>

              {/* Adhérence au plan */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('planStats.adherence')}</Text>
                {scoreLine.length < 2 ? (
                  <Text style={styles.noData}>
                    {scoreLine.length === 0
                      ? t('planStats.noDataPeriod')
                      : t('planStats.needSecondScore')}
                  </Text>
                ) : (
                  <LineChart
                    data={scoreLine}
                    width={CHART_WIDTH}
                    height={120}
                    color={accent}
                    thickness={2}
                    curved
                    dataPointsColor={accent}
                    dataPointsRadius={3}
                    startFillColor={accent}
                    endFillColor={accent}
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
                    maxValue={100}
                    noOfSections={4}
                    isAnimated
                  />
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: C.text2, textAlign: 'center', lineHeight: 20 },

  scroll: { paddingHorizontal: 20, paddingTop: 12 },
  periodRow: { marginTop: 8, marginBottom: 16 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  streakRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 16, paddingHorizontal: 2,
  },
  streakFlame: { fontSize: 16 },
  streakCount: { fontSize: 14, fontWeight: '600', color: C.text2 },

  streakHistoryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  streakHistoryLeft: { gap: 2 },
  streakHistoryLength: { fontSize: 14, fontWeight: '600', color: C.text },
  streakHistoryDates: { fontSize: 12, color: C.text3 },
  streakBestBadge: {
    fontSize: 11, fontWeight: '600', color: C.blue,
    backgroundColor: C.blueLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },

  compRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  compLabel: { fontSize: 13, color: C.text2, flex: 1 },
  compValues: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compPrev: { fontSize: 13, color: C.text3 },
  compArrow: { fontSize: 12, color: C.text3 },
  compCurrent: { fontSize: 14, fontWeight: '700' },
  compDelta: { fontSize: 14, fontWeight: '700', width: 14, textAlign: 'center' },
  compLegend: { marginTop: 8 },
  compLegendText: { fontSize: 11, color: C.text3, fontStyle: 'italic' },
  summaryCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 12, alignItems: 'center',
  },
  summaryValue: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 4 },
  summaryLabel: { fontSize: 11, color: C.text3, textAlign: 'center' },

  card: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 16, overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 13, fontWeight: '600', color: C.text2, letterSpacing: 0.4, marginBottom: 14,
  },
  noData: { fontSize: 13, color: C.text3, fontStyle: 'italic' },
  axisText: { fontSize: 10, color: C.text3 },

  legend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: C.text3 },
});
