import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { C, sessionColor } from '../constants/colors';


import { Plan, Seance, RootStackParamList, MainTabParamList } from '../types';
import { getPlans, getSeances, canCreatePlan, getPendingRecalibrations, PendingRecalibrationInfo } from '../services/api';
import { saveToCache, getFromCache, syncPendingActions } from '../services/offlineCache';
import Icon from '../components/Icon';
import ZoneBadge from '../components/ZoneBadge';
import AnimatedCheck from '../components/AnimatedCheck';
import EmptyState from '../components/EmptyState';
import OfflineBanner from '../components/OfflineBanner';
import SkeletonBlock from '../components/SkeletonBlock';
import { useAuth } from '../context/AuthContext';
import { usePurchase } from '../context/PurchaseContext';
import { localDateStr } from '../utils/date';
import { useTranslation } from 'react-i18next';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Plan'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: NavProp;
  route: BottomTabScreenProps<MainTabParamList, 'Plan'>['route'];
}


function PlanSkeleton({ insetTop }: { insetTop: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F', paddingTop: insetTop }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <SkeletonBlock width={170} height={22} borderRadius={6} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SkeletonBlock width={34} height={34} borderRadius={10} />
          <SkeletonBlock width={34} height={34} borderRadius={10} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 4 }}>
        <SkeletonBlock width={48} height={30} borderRadius={20} />
        <SkeletonBlock width={100} height={30} borderRadius={20} />
        <SkeletonBlock width={120} height={30} borderRadius={20} />
      </View>
      <SkeletonBlock width="100%" height={290} borderRadius={0} style={{ marginBottom: 16 }} />
      <View style={{ paddingHorizontal: 20 }}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} width="100%" height={62} borderRadius={14} style={{ marginBottom: 8 }} />
        ))}
      </View>
    </View>
  );
}

function makeFormatDate(locale: string) {
  return function formatDate(d: string): string {
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  };
}

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const offset = (firstDay + 6) % 7; // Monday-first
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function PlanScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const MONTH_NAMES = t('plan.monthNames', { returnObjects: true }) as string[];
  const DAY_NAMES = t('plan.monthDays', { returnObjects: true }) as string[];
  const formatDate = makeFormatDate(i18n.language);
  const { user } = useAuth();
  const { showPaywall } = usePurchase();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<number>>(new Set()); // empty = tous
  const [allSeances, setAllSeances] = useState<Seance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingRecalibrations, setPendingRecalibrations] = useState<PendingRecalibrationInfo[]>([]);
  const insets = useSafeAreaInsets();

  const { year, month } = selectedMonth;
  const todayStr = localDateStr(now);

  const load = useCallback(async (isRefresh = false) => {
    try {
      await syncPendingActions();
      const ps = await getPlans();
      await saveToCache('plans', ps);
      setPlans(ps);
      // Purge any selected plan IDs that no longer exist after a deletion.
      const validIds = new Set(ps.map((p) => p.id));
      setSelectedPlanIds((prev) => {
        if (prev.size === 0) return prev;
        const cleaned = new Set([...prev].filter((id) => validIds.has(id)));
        return cleaned.size === prev.size ? prev : cleaned;
      });
      if (ps.length > 0) {
        const all = await Promise.all(ps.map(async (p) => {
          const s = await getSeances(p.id);
          await saveToCache(`seances_${p.id}`, s);
          return s;
        }));
        setAllSeances(all.flat());
      } else {
        setAllSeances([]);
      }
      setIsOffline(false);
      getPendingRecalibrations().then(setPendingRecalibrations).catch(() => {});
      if (isRefresh) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: any) {
      if (e?.message === 'SESSION_EXPIRED') return;
      const cachedPlans = await getFromCache<Plan[]>('plans');
      if (cachedPlans) {
        const seanceArrays = await Promise.all(
          cachedPlans.map((p) => getFromCache<Seance[]>(`seances_${p.id}`)),
        );
        setPlans(cachedPlans);
        setAllSeances(seanceArrays.flatMap((s) => s ?? []));
        setIsOffline(e instanceof TypeError);
      } else if (isRefresh) {
        Alert.alert(t('common.error'), t('plan.alertError'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const planId = route.params?.planId;
    if (planId != null) {
      setSelectedPlanIds(new Set([planId]));
      navigation.setParams({ planId: undefined });
    }
  }, [route.params?.planId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load(true);
  }

  const planColorMap: Record<number, string> = Object.fromEntries(
    plans.map((p) => [p.id, sessionColor(p.couleur)]),
  );

  // empty selectedPlanIds = tous les plans
  const activePlanIds = selectedPlanIds.size === 0
    ? new Set(plans.map((p) => p.id))
    : selectedPlanIds;

  const seances = allSeances.filter((s) => activePlanIds.has(s.plan_id));

  // Edit button: only when a single plan is active
  const editablePlan = activePlanIds.size === 1
    ? plans.find((p) => activePlanIds.has(p.id)) ?? null
    : null;

  // Plans dont la dernière séance tombe dans les 7 prochains jours
  const plansEndingSoon = plans.filter((p) => {
    const planSeances = allSeances.filter((s) => s.plan_id === p.id);
    if (planSeances.length === 0) return false;
    const lastDate = planSeances.reduce((max, s) => s.date > max ? s.date : max, planSeances[0].date);
    const daysUntilEnd = Math.ceil((new Date(lastDate + 'T12:00:00').getTime() - Date.now()) / 86_400_000);
    return daysUntilEnd >= 0 && daysUntilEnd <= 7;
  });

  function handleTogglePlan(planId: number) {
    Haptics.selectionAsync();
    setSelectedDate(null);
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  }

  function calDotColor(completee: boolean, date: string): string {
    if (completee) return C.green;
    if (date < todayStr) return C.red;
    return C.yellow;
  }

  const monthPad = String(month).padStart(2, '0');
  const sessionDates: Record<number, string[]> = {};
  seances.forEach((s) => {
    if (s.date.startsWith(`${year}-${monthPad}`)) {
      const day = parseInt(s.date.split('-')[2]);
      if (!sessionDates[day]) sessionDates[day] = [];
      sessionDates[day].push(calDotColor(s.completee, s.date));
    }
  });

  const monthSeances = seances
    .filter((s) => s.date.startsWith(`${year}-${monthPad}`))
    .sort((a, b) => a.date.localeCompare(b.date));

  const displayedSeances = selectedDate
    ? monthSeances.filter((s) => s.date === selectedDate)
    : monthSeances;

  const listLabel = selectedDate
    ? formatDate(selectedDate)
    : t('plan.sessionsOfMonth');

  const weeks = buildCalendar(year, month);

  function prevMonth() {
    setSelectedDate(null);
    setSelectedMonth((m) => ({
      year: m.month === 1 ? m.year - 1 : m.year,
      month: m.month === 1 ? 12 : m.month - 1,
    }));
  }
  function nextMonth() {
    setSelectedDate(null);
    setSelectedMonth((m) => ({
      year: m.month === 12 ? m.year + 1 : m.year,
      month: m.month === 12 ? 1 : m.month + 1,
    }));
  }

  function handleDayPress(dateStr: string) {
    Haptics.selectionAsync();
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
  }

  if (loading) return <PlanSkeleton insetTop={insets.top} />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.blue} />
      }
    >
      <OfflineBanner visible={isOffline} />
      {pendingRecalibrations
        .filter((r) => activePlanIds.has(r.plan_id))
        .map((r) => (
          <TouchableOpacity
            key={r.plan_id}
            style={styles.recalibrationBanner}
            onPress={() => { if (!user?.is_premium) { showPaywall(); return; } navigation.navigate('Recalibration', { metricId: r.metric_id, planId: r.plan_id }); }}
            activeOpacity={0.8}
          >
            <Icon name="refresh" size={14} color="#fff" />
            <Text style={styles.recalibrationBannerText}>
              {t('plan.recalibrationBanner', { nb: r.nb_seances_a_recalibrer, planName: r.plan_titre })}
            </Text>
            <Icon name="chevronRight" size={14} color="#fff" />
          </TouchableOpacity>
        ))
      }
      {plansEndingSoon.map((p) => (
        <TouchableOpacity
          key={`ending_${p.id}`}
          style={styles.planEndingBanner}
          onPress={() => { if (!user?.is_premium) { showPaywall(); return; } navigation.navigate('PlanEnding', { planId: p.id }); }}
          activeOpacity={0.8}
        >
          <Icon name="calendar" size={14} color="#fff" />
          <Text style={styles.planEndingBannerText}>{t('planEnding.bannerText', { planName: `${p.emoji ?? ''}${p.titre}` })}</Text>
          <Icon name="chevronRight" size={14} color="#fff" />
        </TouchableOpacity>
      ))}
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('plan.screenTitle')}</Text>
        <View style={styles.headerActions}>
          {editablePlan && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => navigation.navigate('PlanManage', { plan: editablePlan })}
            >
              <Icon name="edit" size={14} color={C.text2} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('PlanStats', { planId: editablePlan?.id })}
          >
            <Icon name="activity" size={14} color={C.text2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={async () => {
              try {
                await canCreatePlan();
              } catch (e: any) {
                if (e?.message === 'PREMIUM_REQUIRED') { showPaywall(); return; }
              }
              navigation.navigate('Generate');
            }}
          >
            <Icon name="plus" size={14} color={C.text2} />
          </TouchableOpacity>
        </View>
      </View>

      {plans.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={t('plan.emptyPlanTitle')}
          body={t('plan.emptyPlanBody')}
          actionLabel={t('plan.emptyPlanAction')}
          onAction={() => navigation.navigate('Generate')}
        />
      ) : (
        <>
          {/* Plan selector */}
          {plans.length === 1 ? (
            <Text style={styles.planName}>
              {plans[0].emoji ? `${plans[0].emoji} ` : ''}{plans[0].titre}
            </Text>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.planSelectorContent}
                style={styles.planSelector}
              >
                {/* Tous */}
                <TouchableOpacity
                  style={[styles.planPill, selectedPlanIds.size === 0 && styles.planPillActive]}
                  onPress={() => { setSelectedDate(null); setSelectedPlanIds(new Set()); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.planPillLabel, selectedPlanIds.size === 0 && styles.planPillLabelActive]}>
                    {t('plan.filterAll')}
                  </Text>
                  {selectedPlanIds.size > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{selectedPlanIds.size}/{plans.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {/* Individual plans */}
                {plans.map((p) => {
                  const isActive = selectedPlanIds.has(p.id);
                  const color = planColorMap[p.id];
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.planPill,
                        isActive && {
                          backgroundColor: color + '22',
                          borderColor: color,
                          shadowColor: color,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.5,
                          shadowRadius: 8,
                          elevation: 4,
                        },
                      ]}
                      onPress={() => handleTogglePlan(p.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[
                        styles.checkCircle,
                        isActive
                          ? { backgroundColor: color, borderColor: color }
                          : { backgroundColor: 'transparent', borderColor: C.border },
                      ]}>
                        {isActive && <Text style={styles.checkMark}>✓</Text>}
                      </View>
                      {p.emoji ? <Text style={styles.planPillEmoji}>{p.emoji}</Text> : null}
                      <Text
                        style={[styles.planPillLabel, styles.planPillLabelFlex, isActive && { color, fontWeight: '600' }]}
                        numberOfLines={1}
                      >
                        {p.titre}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Selection summary bar */}
              {selectedPlanIds.size > 0 && (
                <View style={styles.summaryBar}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryScroll}>
                    {plans.filter((p) => selectedPlanIds.has(p.id)).map((p) => {
                      const color = planColorMap[p.id];
                      return (
                        <View key={p.id} style={styles.summaryChip}>
                          <View style={[styles.summaryDot, { backgroundColor: color }]} />
                          <Text style={styles.summaryChipText} numberOfLines={1}>
                            {p.emoji ? `${p.emoji} ` : ''}{p.titre}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity
                    onPress={() => { setSelectedDate(null); setSelectedPlanIds(new Set()); }}
                    style={styles.showAllBtn}
                  >
                    <Text style={styles.showAllText}>{t('plan.showAll')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* Calendar */}
          <View style={styles.calCard}>
            <View style={styles.calNav}>
              <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                <Icon name="chevronLeft" size={18} color={C.text2} />
              </TouchableOpacity>
              <Text style={styles.calTitle}>{MONTH_NAMES[month - 1]} {year}</Text>
              <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
                <Icon name="chevronRight" size={18} color={C.text2} />
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={styles.calRow}>
              {DAY_NAMES.map((d, i) => (
                <View key={i} style={styles.calCell}>
                  <Text style={styles.dayName}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Days */}
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.calRow}>
                {week.map((day, di) => {
                  const dateStr = day
                    ? `${year}-${monthPad}-${String(day).padStart(2, '0')}`
                    : '';
                  const isToday = dateStr === todayStr;
                  const isSelected = !!day && dateStr === selectedDate;
                  const dotColors = day ? sessionDates[day] : null;
                  return (
                    <TouchableOpacity
                      key={di}
                      style={[
                        styles.calCell,
                        styles.dayCell,
                        isToday && styles.todayCell,
                        isSelected && styles.selectedCell,
                      ]}
                      onPress={() => day && handleDayPress(dateStr)}
                      activeOpacity={day ? 0.7 : 1}
                      disabled={!day}
                    >
                      {day && (
                        <>
                          <Text style={[
                            styles.dayNum,
                            isToday && styles.todayNum,
                            isSelected && styles.selectedNum,
                          ]}>
                            {day}
                          </Text>
                          {dotColors && (
                            <View style={styles.dots}>
                              {dotColors.slice(0, 3).map((color, i) => (
                                <View key={i} style={[styles.dot, { backgroundColor: color }]} />
                              ))}
                            </View>
                          )}
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Session list */}
          <View style={styles.listSection}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionLabel}>{listLabel}</Text>
              {selectedDate && (
                <TouchableOpacity onPress={() => setSelectedDate(null)} style={styles.clearBtn}>
                  <Icon name="x" size={12} color={C.text3} />
                </TouchableOpacity>
              )}
            </View>
            {displayedSeances.map((s) => {
              const planColor = planColorMap[s.plan_id] ?? C.blue;
              const seancePlan = plans.find((p) => p.id === s.plan_id);
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.seanceRow, s.completee && styles.seanceCompleted, { borderLeftColor: planColor }]}
                  onPress={() => navigation.navigate('Session', { seance: s, planCouleur: planColor, planSport: seancePlan?.sport })}
                  activeOpacity={0.8}
                >
                  {s.emoji ? (
                    <Text style={styles.seanceEmoji}>{s.emoji}</Text>
                  ) : (
                    <AnimatedCheck visible={s.completee} />
                  )}
                  <View style={styles.seanceInfo}>
                    <Text style={[styles.seanceName, { color: s.completee ? C.text2 : C.text }]}>{s.titre}</Text>
                    <Text style={styles.seanceMeta}>
                      {formatDate(s.date)} · {s.duree_minutes} min
                      {seancePlan && plans.length > 1 ? ` · ${seancePlan.emoji ?? ''}${seancePlan.titre}` : ''}
                    </Text>
                  </View>
                  <ZoneBadge zone={s.zone} />
                </TouchableOpacity>
              );
            })}
            {displayedSeances.length === 0 && monthSeances.length === 0 && (
              <EmptyState
                icon="calendar"
                title={t('plan.emptyMonthTitle')}
                body={t('plan.emptyMonthBody')}
              />
            )}
            {displayedSeances.length === 0 && monthSeances.length > 0 && selectedDate && (
              <Text style={styles.noSeancesDay}>{t('plan.noSessionsDay')}</Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 24 },
  recalibrationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: C.blue,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recalibrationBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#fff' },
  planEndingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: C.orange,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  planEndingBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#fff' },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: C.text },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, padding: 8,
  },
  planName: {
    fontSize: 14,
    color: C.text2,
    paddingHorizontal: 20,
    marginBottom: 12,
  },

  planSelector: { marginBottom: 8 },
  planSelectorContent: { paddingHorizontal: 20, gap: 8, flexDirection: 'row', alignItems: 'center' },
  planPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    maxWidth: 220,
  },
  planPillActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  planPillEmoji: { fontSize: 13 },
  planPillLabel: { fontSize: 13, fontWeight: '500', color: C.text2 },
  planPillLabelFlex: { flexShrink: 1 },
  planPillLabelActive: { color: C.blue, fontWeight: '600' },
  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 9, color: '#fff', fontWeight: '700', lineHeight: 12 },
  countBadge: {
    backgroundColor: C.blueLight,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 2,
  },
  countBadgeText: { fontSize: 10, fontWeight: '700', color: C.blue },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  summaryScroll: { flex: 1 },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
  },
  summaryDot: { width: 7, height: 7, borderRadius: 4 },
  summaryChipText: { fontSize: 11, color: C.text2, fontWeight: '500', maxWidth: 100 },
  showAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  showAllText: { fontSize: 11, color: C.text2, fontWeight: '600' },

  calCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  calNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  navBtn: { padding: 4 },
  calTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  calRow: { flexDirection: 'row' },
  calCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayName: { fontSize: 10, color: C.text3, fontWeight: '600' },
  dayCell: { justifyContent: 'center', aspectRatio: 1 },
  todayCell: {
    backgroundColor: C.blueLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.blue + '50',
  },
  selectedCell: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: C.blue,
    backgroundColor: C.blueLight,
  },
  dayNum: { fontSize: 12, color: C.text2 },
  todayNum: { fontWeight: '700', color: C.blue },
  selectedNum: { fontWeight: '700', color: C.blue },
  dots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },

  listSection: { paddingHorizontal: 20 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    color: C.text3,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  clearBtn: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 5,
  },
  noSeancesDay: { fontSize: 13, color: C.text3, textAlign: 'center', marginTop: 8 },
  seanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  seanceCompleted: { opacity: 0.55 },
  seanceEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  seanceInfo: { flex: 1, minWidth: 0 },
  seanceName: { fontSize: 14, fontWeight: '600' },
  seanceMeta: { fontSize: 12, color: C.text2, marginTop: 2 },

});
