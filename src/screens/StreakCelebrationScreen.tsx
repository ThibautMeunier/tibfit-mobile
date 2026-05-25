import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  AccessibilityInfo,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  LinearGradient as SvgGrad,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { C } from '../constants/colors';
import { RootStackParamList, Seance } from '../types';
import {
  getTotalStreakHistory,
  getPlans,
  getSeances,
  PlanStreakEntry,
} from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'StreakCelebration'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const NUM_SPARKS = 10;
const SPARK_COLORS = [C.flameYel, C.flame, C.red] as const;

const SPARK_PARAMS = Array.from({ length: NUM_SPARKS }, (_, i) => ({
  x: (i * 73 + 31) % SCREEN_W,
  dur: (3.2 + (i % 5) * 0.5) * 1000,
  delay: ((i * 0.31) % 3) * 1000,
  size: 2 + (i % 4) * 0.9,
  color: SPARK_COLORS[i % 3],
}));

function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}

function getWeekBounds(date: Date): { start: string; end: string } {
  const dow = date.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

export default function StreakCelebrationScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { streakCount, planId } = route.params;

  const [personalBest, setPersonalBest] = useState(streakCount);
  const [monthTotal, setMonthTotal] = useState<number | null>(null);
  const [weekSeances, setWeekSeances] = useState<Seance[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);

  const today = useMemo(() => new Date(), []);
  const weekNumber = useMemo(() => getISOWeek(today), [today]);
  const dayInitials = useMemo(() => t('streakCelebration.dayInitials').split(','), [t]);
  const weekDoneCount = weekSeances.filter((s) => s.completee).length;

  const tagline = useMemo(() => {
    if (streakCount >= 30) return t('streakCelebration.tagline_30');
    if (streakCount >= 14) return t('streakCelebration.tagline_14');
    if (streakCount >= 7) return t('streakCelebration.tagline_perfect');
    return t('streakCelebration.tagline_other', { count: streakCount });
  }, [streakCount, t]);

  // Entry animation
  const entryScale = useRef(new Animated.Value(0.85)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;
  // Fibi loop animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const auraAnim = useRef(new Animated.Value(0)).current;
  // Sparks (one animated value per particle)
  const sparkAnims = useRef(SPARK_PARAMS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    Animated.parallel([
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.bezier(0.2, 0.7, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.spring(entryScale, {
        toValue: 1,
        friction: 6,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });

    getPlans().catch(() => planId ? [{ id: planId }] : []).then(async (plans) => {
      const planIds = plans.map((p: { id: number }) => p.id);
      if (planIds.length === 0) return;

      const [history, allSeancesByPlan] = await Promise.all([
        getTotalStreakHistory().catch((): PlanStreakEntry[] => []),
        Promise.all(planIds.map((id: number) => getSeances(id).catch((): Seance[] => []))),
      ]);
      const allSeances = allSeancesByPlan.flat();

      if (history.length > 0) {
        const max = Math.max(...history.map((e) => e.streak_length));
        setPersonalBest(Math.max(max, streakCount));
      }
      const thisMonth = today.toISOString().slice(0, 7);
      setMonthTotal(allSeances.filter((s) => s.completee && s.date.startsWith(thisMonth)).length);
      const { start, end } = getWeekBounds(today);
      setWeekSeances(
        allSeances
          .filter((s) => s.date >= start && s.date <= end)
          .sort((a, b) => a.date.localeCompare(b.date)),
      );
    });
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    // Float: period ~4.5s (freq 1.4 rad/s)
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    // Rotation: period ~3s (freq 2.1 rad/s)
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    // Flicker scale: period ~1s (freq 6.2 rad/s)
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1, duration: 505, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0, duration: 505, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    // Aura pulse: period ~3.14s (freq 2 rad/s)
    Animated.loop(
      Animated.sequence([
        Animated.timing(auraAnim, { toValue: 1, duration: 1570, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(auraAnim, { toValue: 0, duration: 1570, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    // Sparks — linear rise from bottom to top, looping with initial delay offset
    sparkAnims.forEach((anim, i) => {
      Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: SPARK_PARAMS[i].dur,
          delay: SPARK_PARAMS[i].delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    });
  }, [reduceMotion]);

  const fibiTranslateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [4, -4] });
  const fibiRotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['-1.2deg', '1.2deg'] });
  const fibiScale = scaleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.982, 1.018] });
  const auraOpacity = auraAnim.interpolate({ inputRange: [0, 1], outputRange: [0.58, 0.82] });

  // Fibi scales with screen height: 25% of screen, capped at 230pt, min 120pt
  const fibiH = Math.max(120, Math.min(Math.round(SCREEN_H * 0.25), 230));
  const fibiW = Math.round(fibiH * 0.8);

  // Counter SVG width adapts to digit count
  const counterW = streakCount >= 100 ? 280 : streakCount >= 10 ? 200 : 130;

  return (
    <Animated.View style={[styles.root, { opacity: entryOpacity }]}>
      {/* Background gradient layers */}
      <LinearGradient
        colors={['#14100F', '#0A0A0F', '#0A0A0F']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(249,115,22,0.18)', 'rgba(249,115,22,0)']}
        locations={[0, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Sparks */}
      {!reduceMotion &&
        SPARK_PARAMS.map((p, i) => {
          const yTranslate = sparkAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [SCREEN_H, -40],
          });
          const sparkOpacity = sparkAnims[i].interpolate({
            inputRange: [0, 0.08, 0.85, 1],
            outputRange: [0, 0.85, 0.85, 0],
          });
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.spark,
                {
                  left: p.x,
                  width: p.size,
                  height: p.size,
                  borderRadius: p.size / 2,
                  backgroundColor: p.color,
                  opacity: sparkOpacity,
                  transform: [{ translateY: yTranslate }],
                },
              ]}
            />
          );
        })}

      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
        {/* Top section — eyebrow + Fibi + counter + tagline */}
        <View style={styles.topSection}>
          <Text style={styles.eyebrow}>
            {t('streakCelebration.eyebrow', { week: weekNumber })}
          </Text>

          <Animated.View style={[styles.fibiWrap, { transform: [{ scale: entryScale }] }]}>
            <Animated.View
              style={{
                transform: [
                  { translateY: fibiTranslateY },
                  { rotate: fibiRotate },
                  { scaleX: fibiScale },
                ],
              }}
            >
              <Animated.View
                style={[
                  styles.aura,
                  { width: fibiW * 1.15, height: fibiH * 1.1, borderRadius: fibiW * 0.6 },
                  { opacity: auraOpacity },
                ]}
              />
              <Image
                source={require('../../assets/fibi-flame.png')}
                style={{ width: fibiW, height: fibiH }}
                resizeMode="contain"
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </Animated.View>
          </Animated.View>

          <View
            style={styles.counterBlock}
            accessible
            accessibilityLabel={t('streakCelebration.a11yAnnounce', { count: streakCount, tagline })}
          >
            <Svg width={counterW} height={100}>
              <Defs>
                <SvgGrad id="flameGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={C.flameYel} />
                  <Stop offset="0.55" stopColor={C.flame} />
                  <Stop offset="1" stopColor={C.red} />
                </SvgGrad>
              </Defs>
              <SvgText
                fill="url(#flameGrad)"
                fontSize={96}
                fontWeight="700"
                fontFamily="DMSans_700Bold"
                x={counterW / 2}
                y={92}
                textAnchor="middle"
              >
                {String(streakCount)}
              </SvgText>
            </Svg>
            <Text style={styles.daysLabel}>{t('streakCelebration.daysLabel')}</Text>
          </View>

          <Text style={styles.tagline}>{tagline}</Text>
        </View>

        {/* Bottom section — cards + CTA, ancré en bas */}
        <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          <View style={styles.weekCard}>
            <View style={styles.weekCardHeader}>
              <Text style={styles.weekCardLabel}>{t('streakCelebration.weekHeader')}</Text>
              {weekSeances.length > 0 && (
                <Text style={styles.weekCardCount}>{weekDoneCount}/{weekSeances.length}</Text>
              )}
            </View>
            {weekSeances.length === 0 ? (
              <Text style={styles.weekEmpty}>{t('streakCelebration.weekEmpty')}</Text>
            ) : (
              <View style={styles.weekGrid}>
                {weekSeances.map((seance) => {
                  const dow = new Date(seance.date + 'T12:00:00').getDay();
                  const letter = dayInitials[dow] ?? '?';
                  const isToday = seance.date === today.toISOString().slice(0, 10);
                  return (
                    <View
                      key={seance.id}
                      style={[
                        styles.dayCell,
                        seance.completee ? styles.dayCellActive : styles.dayCellInactive,
                        seance.completee && isToday && styles.dayCellToday,
                      ]}
                    >
                      <Text style={styles.dayLetter}>{letter}</Text>
                      {seance.completee ? (
                        <Text style={styles.dayEmoji}>🔥</Text>
                      ) : (
                        <View style={styles.dayDot} />
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t('streakCelebration.statRecordLabel')}</Text>
              <View style={styles.statRow}>
                <Text style={styles.statValue}>{personalBest}</Text>
                <Text style={styles.statSuffix}> {t('streakCelebration.statRecordSuffix')}</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t('streakCelebration.statMonthLabel')}</Text>
              <View style={styles.statRow}>
                <Text style={styles.statValue}>{monthTotal ?? '—'}</Text>
                {monthTotal !== null && (
                  <Text style={styles.statSuffix}> {t('streakCelebration.statMonthSuffix')}</Text>
                )}
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.continueBtnText}>{t('streakCelebration.cta')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  spark: {
    position: 'absolute',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  topSection: {
    alignItems: 'center',
  },
  bottomSection: {
    width: '100%',
  },
  eyebrow: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: C.text3,
    marginBottom: 12,
    textAlign: 'center',
  },
  fibiWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    zIndex: 2,
  },
  aura: {
    position: 'absolute',
    backgroundColor: 'rgba(251,191,36,0.25)',
    alignSelf: 'center',
    top: 8,
  },
  counterBlock: {
    alignItems: 'center',
    marginTop: -8,
  },
  daysLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: C.text2,
    marginTop: 4,
  },
  tagline: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    lineHeight: 21,
    color: C.text,
    textAlign: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  weekCard: {
    width: '100%',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 16,
    paddingHorizontal: 14,
  },
  weekCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  weekCardLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.text3,
  },
  weekEmpty: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 11,
    color: C.text3,
    textAlign: 'center',
    paddingVertical: 8,
  },
  weekCardCount: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    fontWeight: '600',
    color: C.flame,
  },
  weekGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  dayCell: {
    flex: 1,
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    borderWidth: 1,
    paddingVertical: 4,
  },
  dayCellActive: {
    backgroundColor: 'rgba(251,146,60,0.22)',
    borderColor: 'rgba(251,146,60,0.45)',
  },
  dayCellInactive: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: C.border,
  },
  dayCellToday: {
    shadowColor: C.flame,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  dayLetter: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: C.text3,
  },
  dayEmoji: {
    fontSize: 14,
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.text3,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
  },
  statLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.text3,
    marginBottom: 6,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.44,
    color: C.text,
  },
  statSuffix: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: C.text2,
    marginLeft: 4,
  },
  continueBtn: {
    marginTop: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.orangeDeep,
    shadowColor: C.orangeDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 11,
    elevation: 6,
  },
  continueBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
  },
});
