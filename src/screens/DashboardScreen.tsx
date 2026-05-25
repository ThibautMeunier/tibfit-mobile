import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { C, sessionColor } from '../constants/colors';
import { Seance, Plan, RootStackParamList, MainTabParamList } from '../types';
import { getPlans, getSeances, getForme, getFormeHistory, getCurrentWeekCheckin, FormeScore, FormeHistoryEntry } from '../services/api';
import { saveToCache, getFromCache, syncPendingActions } from '../services/offlineCache';
import { setWidgetSessions } from '../services/widgetData';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import LottieView from 'lottie-react-native';
import { LineChart } from 'react-native-gifted-charts';
import ZoneBadge from '../components/ZoneBadge';
import DriftGauge from '../components/DriftGauge';
import EmptyState from '../components/EmptyState';
import OfflineBanner from '../components/OfflineBanner';
import SkeletonBlock from '../components/SkeletonBlock';
import { getRandomTip } from '../constants/tips';
import { localDateStr } from '../utils/date';
import { SectionLabel } from '../components/ui';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: NavProp;
}

function DashboardSkeleton({ insetTop }: { insetTop: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <View style={{ paddingTop: insetTop + 16, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ gap: 6 }}>
          <SkeletonBlock width={90} height={10} borderRadius={5} />
          <SkeletonBlock width={180} height={24} borderRadius={6} />
        </View>
        <SkeletonBlock width={86} height={34} borderRadius={12} />
      </View>
      <View style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: '#16161F', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <SkeletonBlock width={100} height={70} borderRadius={10} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBlock width={70} height={10} borderRadius={5} />
          <SkeletonBlock width="100%" height={13} borderRadius={5} />
          <SkeletonBlock width="65%" height={13} borderRadius={5} />
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <SkeletonBlock width={100} height={10} borderRadius={5} style={{ marginBottom: 10 }} />
        <SkeletonBlock width="100%" height={155} borderRadius={16} />
      </View>
      <View style={{ paddingHorizontal: 20 }}>
        <SkeletonBlock width={130} height={10} borderRadius={5} style={{ marginBottom: 10 }} />
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} width="100%" height={62} borderRadius={14} style={{ marginBottom: 8 }} />
        ))}
      </View>
    </View>
  );
}

function formatDate(d: string, locale: string): string {
  const date = new Date(d + 'T12:00:00');
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const FORME_CHART_WIDTH = SCREEN_WIDTH - 40 - 32;

export default function DashboardScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { user, handleSessionExpired, refreshUser } = useAuth();
  const tip = useMemo(() => getRandomTip(i18n.language, user?.niveau), [i18n.language, user?.niveau]);
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [seances, setSeances] = useState<Seance[]>([]);
  const [forme, setForme] = useState<FormeScore | null>(null);
  const [formeHistory, setFormeHistory] = useState<FormeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showCheckinBanner, setShowCheckinBanner] = useState(false);

  const today = localDateStr();
  const todayLabel = new Date().toLocaleDateString(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const load = useCallback(async (isRefresh = false) => {
    try {
      await syncPendingActions();
      refreshUser().catch(() => {});
      if (new Date().getDay() === 1) {
        getCurrentWeekCheckin().then((c) => setShowCheckinBanner(!c)).catch(() => {});
      } else {
        setShowCheckinBanner(false);
      }
      const ps = await getPlans();
      await saveToCache('plans', ps);
      setPlans(ps);
      if (ps.length > 0) {
        const [allSeances, formeScore, formeHist] = await Promise.all([
          Promise.all(ps.map(async (p) => {
            const s = await getSeances(p.id);
            await saveToCache(`seances_${p.id}`, s);
            return s;
          })).then((r) => r.flat()),
          getForme(),
          getFormeHistory(),
        ]);
        setSeances(allSeances);
        await saveToCache('forme', formeScore);
        await saveToCache('forme_history', formeHist);
        setForme(formeScore);
        setFormeHistory(formeHist);
        const today = localDateStr();
        setWidgetSessions(
          allSeances
            .filter((s) => s.date === today && !s.completee)
            .map((s) => ({
              id: s.id,
              titre: s.titre,
              duree_minutes: s.duree_minutes,
              sport: s.sport ?? null,
              emoji: s.emoji ?? null,
              zone: s.zone ?? null,
            })),
        );
      } else {
        setSeances([]);
        setForme(null);
        setWidgetSessions([]);
      }
      setIsOffline(false);
      if (isRefresh) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: any) {
      if (e?.message === 'SESSION_EXPIRED') { handleSessionExpired(); return; }
      const [cachedPlans, cachedForme, cachedFormeHist] = await Promise.all([
        getFromCache<Plan[]>('plans'),
        getFromCache<FormeScore>('forme'),
        getFromCache<FormeHistoryEntry[]>('forme_history'),
      ]);
      if (cachedPlans) {
        const seanceArrays = await Promise.all(
          cachedPlans.map((p) => getFromCache<Seance[]>(`seances_${p.id}`)),
        );
        setPlans(cachedPlans);
        setSeances(seanceArrays.flatMap((s) => s ?? []));
        setForme(cachedForme);
        setFormeHistory(cachedFormeHist ?? []);
        setIsOffline(e instanceof TypeError);
      } else {
        setPlans([]);
        setSeances([]);
        setForme(null);
        setFormeHistory([]);
        if (isRefresh) Alert.alert(t('common.error'), t('dashboard.alertError'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [handleSessionExpired, refreshUser]);

  useFocusEffect(
    useCallback(() => { load(); }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load(true);
  }


  const planColorMap: Record<number, string> = Object.fromEntries(
    plans.map((p) => [p.id, sessionColor(p.couleur)]),
  );

  const todaySessions = seances.filter((s) => s.date === today && !s.completee);
  const upcoming = seances
    .filter((s) => !s.completee && s.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  if (loading) return <DashboardSkeleton insetTop={insets.top} />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.blue} />
      }
    >
      <OfflineBanner visible={isOffline} />
      {showCheckinBanner && (
        <TouchableOpacity
          style={styles.checkinBanner}
          onPress={() => navigation.navigate('WeeklyCheckin')}
          activeOpacity={0.85}
        >
          <Text style={styles.checkinBannerText}>👋 {t('weeklyCheckin.mondayBanner')}</Text>
        </TouchableOpacity>
      )}
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateLabel}>{todayLabel}</Text>
          <Text style={styles.greeting}>{t('dashboard.greeting', { name: user?.name ?? 'Tib' })}</Text>
          {(user?.streak ?? 0) > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakIcon}>🔥</Text>
              <Text style={styles.streakText}>{t('dashboard.streak', { count: user!.streak })}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.statsBtn}
          onPress={() => navigation.navigate('Stats')}
        >
          <Icon name="activity" size={16} color={C.blue} />
          <Text style={styles.statsBtnLabel}>{t('dashboard.progression')}</Text>
        </TouchableOpacity>
      </View>

{/* Forme */}
      {forme !== null && (
        <View style={styles.driftCard}>
          <DriftGauge fraicheur={forme.fraicheur} niveau={forme.niveau} />
          <View style={styles.driftText}>
            <Text style={styles.driftTitle}>{t('dashboard.formeTitle')}</Text>
            <Text style={styles.driftBody}>
              {forme.jours_consecutifs >= 5
                ? t('dashboard.forme_consecutive', { days: forme.jours_consecutifs })
                : forme.niveau === 'fraîche' ? t('dashboard.forme_excellente')
                : forme.niveau === 'légère' ? t('dashboard.forme_legere')
                : forme.niveau === 'modérée' ? t('dashboard.forme_moderee')
                : forme.niveau === 'élevée' ? t('dashboard.forme_elevee')
                : t('dashboard.forme_critique')}
            </Text>
          </View>
        </View>
      )}

      {/* Historique de forme 8 semaines */}
      {formeHistory.length >= 2 && (
        <View style={styles.formeHistoryCard}>
          <Text style={styles.formeHistoryTitle}>{t('dashboard.formeHistoryTitle')}</Text>
          <LineChart
            data={formeHistory.map((e) => ({
              value: e.fraicheur,
              label: new Date(e.week_start + 'T12:00:00').toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
            }))}
            width={FORME_CHART_WIDTH}
            height={90}
            color={C.blue}
            thickness={2}
            curved
            dataPointsColor={C.blue}
            dataPointsRadius={3}
            startFillColor={C.blue}
            endFillColor={C.blue}
            startOpacity={0.15}
            endOpacity={0.01}
            areaChart
            backgroundColor="transparent"
            xAxisColor={C.border}
            yAxisColor="transparent"
            yAxisTextStyle={{ fontSize: 9, color: C.text3 }}
            xAxisLabelTextStyle={{ fontSize: 9, color: C.text3 }}
            hideRules
            initialSpacing={8}
            endSpacing={8}
            maxValue={100}
            noOfSections={2}
            isAnimated
          />
        </View>
      )}


      {/* Today's sessions */}
      {todaySessions.length > 0 && (
        <View style={styles.section}>
          <SectionLabel label={t('dashboard.seancesDuJour', { count: todaySessions.length })} />
          {todaySessions.map((todaySession) => {
            const planColor = planColorMap[todaySession.plan_id];
            return (
            <TouchableOpacity
              key={todaySession.id}
              onPress={() => navigation.navigate('Session', { seance: todaySession, planCouleur: planColor, planSport: plans.find((p) => p.id === todaySession.plan_id)?.sport })}
              activeOpacity={0.85}
              style={todaySessions.length > 1 ? { marginBottom: 8 } : undefined}
            >
              <LinearGradient
                colors={[planColor + '22', C.bg3]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.todayCard, { borderColor: planColor + '50' }]}
              >
                <View style={styles.todayTop}>
                  <View style={styles.todayLeft}>
                    <Text style={styles.todaySport}>{todaySession.emoji ?? todaySession.sport}</Text>
                    <View>
                      <Text style={styles.todayTitle}>{todaySession.titre}</Text>
                      <Text style={styles.todayMeta}>
                        {t('dashboard.today', { duration: todaySession.duree_minutes })}
                      </Text>
                    </View>
                  </View>
                  <ZoneBadge zone={todaySession.zone} />
                </View>
                {todaySession.sections.length > 0 && (
                  <View style={styles.todayBlocks}>
                    {todaySession.sections.slice(0, 2).map((s, i) => (
                      <View key={i} style={i === 0 ? styles.warmupBlock : styles.mainBlock}>
                        <Text style={[styles.blockLabel, i > 0 && { color: C.blue }]}>
                          {s.titre.toUpperCase()}
                        </Text>
                        <Text style={styles.blockText} numberOfLines={2}>{s.contenu}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.todayFooter}>
                  <Text style={[styles.todayLink, { color: planColor }]}>{t('dashboard.seeFullSession')}</Text>
                  <Icon name="chevronRight" size={16} color={planColor} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Upcoming sessions */}
      {upcoming.length > 0 && (
        <View style={styles.section}>
          <SectionLabel label={t('dashboard.prochaines')} />
          {upcoming.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.upcomingCard, { borderLeftColor: planColorMap[s.plan_id] }]}
              onPress={() => navigation.navigate('Session', { seance: s, planCouleur: planColorMap[s.plan_id], planSport: plans.find((p) => p.id === s.plan_id)?.sport })}
              activeOpacity={0.8}
            >
              <Text style={styles.upcomingSport}>{s.emoji ?? s.sport}</Text>
              <View style={styles.upcomingInfo}>
                <Text style={styles.upcomingTitle} numberOfLines={1}>
                  {s.titre}
                </Text>
                <Text style={styles.upcomingMeta}>
                  {formatDate(s.date, i18n.language)} · {s.duree_minutes} min
                </Text>
              </View>
              <ZoneBadge zone={s.zone} />
              <Icon name="chevronRight" size={16} color={C.text3} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Empty state */}
      {plans.length === 0 && (
        <EmptyState
          icon="calendar"
          title={t('dashboard.emptyTitle')}
          body={t('dashboard.emptyBody')}
          actionLabel={t('dashboard.emptyAction')}
          onAction={() => navigation.navigate('Generate')}
        />
      )}

      {/* Daily tip */}
      <View style={styles.tipCard}>
        <View style={styles.tipHeader}>
          <LottieView source={require('../../assets/Fibi.json')} autoPlay loop style={{ width: 32, height: 32 }} />
          <Text style={styles.tipLabel}>{t('dashboard.tipLabel')}</Text>
        </View>
        <Text style={styles.tipText}>{tip}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 24 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  dateLabel: { fontSize: 12, color: C.text3, fontWeight: '500', letterSpacing: 0.6, textTransform: 'uppercase' },
  greeting: { fontSize: 22, fontWeight: '700', color: C.text, lineHeight: 28 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  streakIcon: { fontSize: 13 },
  streakText: { fontSize: 13, fontWeight: '600', color: C.text2 },
  statsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.blueLight,
    borderWidth: 1,
    borderColor: C.blue + '40',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statsBtnLabel: { fontSize: 12, fontWeight: '600', color: C.blue },

  driftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  driftText: { flex: 1 },
  driftTitle: { fontSize: 12, color: C.text3, fontWeight: '500', marginBottom: 4 },
  driftBody: { fontSize: 13, color: C.text2, lineHeight: 19 },

  formeHistoryCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    overflow: 'hidden',
  },
  formeHistoryTitle: { fontSize: 12, color: C.text3, fontWeight: '500', marginBottom: 10 },

  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    color: C.text3,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  todayCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.blue + '50',
    padding: 18,
  },
  todayTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  todayLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todaySport: { fontSize: 28 },
  todayTitle: { fontSize: 16, fontWeight: '700', color: C.text, lineHeight: 20 },
  todayMeta: { fontSize: 12, color: C.text2, marginTop: 2 },
  todayBlocks: { flexDirection: 'row', gap: 8, marginTop: 4 },
  warmupBlock: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 10,
  },
  mainBlock: {
    flex: 1,
    backgroundColor: C.blueLight,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: C.blue + '30',
  },
  blockLabel: { fontSize: 10, color: C.text3, fontWeight: '600', marginBottom: 4 },
  blockText: { fontSize: 12, color: C.text2, lineHeight: 17 },
  todayFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  todayLink: { fontSize: 12, color: C.blue, fontWeight: '600' },

  upcomingCard: {
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
  upcomingSport: { fontSize: 22, width: 36, textAlign: 'center' },
  upcomingInfo: { flex: 1, minWidth: 0 },
  upcomingTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  upcomingMeta: { fontSize: 12, color: C.text2, marginTop: 2 },

  checkinBanner: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: C.blueLight,
    borderWidth: 1,
    borderColor: C.blue + '40',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  checkinBannerText: { fontSize: 14, fontWeight: '600', color: C.blue },

  tipCard: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(234,179,8,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.25)',
    borderRadius: 14,
    padding: 16,
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  tipLabel: { fontSize: 12, fontWeight: '700', color: C.text },
  tipText: { fontSize: 13, color: C.text2, lineHeight: 19 },

});
