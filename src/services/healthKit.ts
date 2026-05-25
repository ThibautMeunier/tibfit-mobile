import {
  isHealthDataAvailable,
  requestAuthorization,
  authorizationStatusFor,
  saveWorkoutSample,
  queryQuantitySamples,
  queryStatisticsForQuantity,
  HKWorkoutActivityType as WorkoutActivityType,
  HKAuthorizationStatus as AuthorizationStatus,
} from '@kingstinct/react-native-healthkit';
import { Linking } from 'react-native';
import type { Seance } from '../types';

const WRITE_TYPES = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierDistanceCycling',
  'HKQuantityTypeIdentifierDistanceSwimming',
] as const;

const READ_TYPES = [
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierVO2Max',
  'HKQuantityTypeIdentifierActiveEnergyBurned',  // nécessaire pour lire les calories
] as const;

// MET values by sport (kcal/kg/h)
const MET_BY_SPORT: Record<string, number> = {
  running: 9.0,
  course: 9.0,
  trail: 10.0,
  vélo: 8.0,
  cyclisme: 8.0,
  natation: 7.0,
  triathlon: 9.5,
  musculation: 5.0,
  'street workout': 6.0,
  yoga: 3.0,
  marche: 3.5,
};

function sportToActivityType(sport: string | null | undefined): WorkoutActivityType {
  const s = (sport ?? '').toLowerCase();
  if (s.includes('running') || s.includes('course') || s.includes('trail')) return WorkoutActivityType.running;
  if (s.includes('vélo') || s.includes('cycl') || s.includes('bike')) return WorkoutActivityType.cycling;
  if (s.includes('natation') || s.includes('swim')) return WorkoutActivityType.swimming;
  if (s.includes('muscu') || s.includes('strength') || s.includes('street') || s.includes('workout')) return WorkoutActivityType.traditionalStrengthTraining;
  if (s.includes('yoga')) return WorkoutActivityType.yoga;
  if (s.includes('marche') || s.includes('walk')) return WorkoutActivityType.walking;
  return WorkoutActivityType.crossTraining;
}

function estimateCalories(sport: string | null | undefined, duree_minutes: number, poids_kg: number): number {
  const s = (sport ?? '').toLowerCase();
  const met = Object.entries(MET_BY_SPORT).find(([key]) => s.includes(key))?.[1] ?? 6.0;
  return Math.round(met * poids_kg * (duree_minutes / 60));
}

export async function isHealthKitAvailable(): Promise<boolean> {
  try {
    return await isHealthDataAvailable();
  } catch {
    return false;
  }
}

// Vérifie l'autorisation d'écriture des workouts
export async function isAuthorized(): Promise<boolean> {
  const available = await isHealthKitAvailable();
  if (!available) return false;
  try {
    // notDetermined = dialog jamais présentée ; tout autre statut = déjà répondu
    const status = authorizationStatusFor('HKWorkoutTypeIdentifier');
    return status !== AuthorizationStatus.notDetermined;
  } catch {
    return false;
  }
}

// Vérifie l'autorisation de lecture de la FC.
// Note : HealthKit ne révèle pas le statut de lecture par souci de confidentialité —
// on tente une lecture légère et on considère que c'est OK si elle ne lève pas d'erreur.
export async function canReadWorkoutMetrics(): Promise<boolean> {
  try {
    const available = await isHealthKitAvailable();
    if (!available) return false;
    const now = new Date();
    const result = await queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierHeartRate',
      ['discreteAverage'],
      { date: { startDate: now, endDate: now }, unit: 'count/min' },
    );
    return result !== null;
  } catch {
    return false;
  }
}

export async function requestPermissions(): Promise<boolean> {
  const available = await isHealthKitAvailable();
  if (!available) return false;

  try {
    await requestAuthorization(WRITE_TYPES, READ_TYPES);
    const status = authorizationStatusFor('HKWorkoutTypeIdentifier');
    return status !== AuthorizationStatus.notDetermined;
  } catch {
    return false;
  }
}

// Ouvre les Réglages iOS → Santé → TibFit pour gérer les permissions
export function openHealthSettings(): void {
  Linking.openURL('x-apple-health://').catch(() => {
    Linking.openSettings();
  });
}

export interface WorkoutMetrics {
  hrMean: number | null;
  hrMax: number | null;
  calories: number | null;
}

export interface FitnessMetrics {
  restingHR: number | null;
  vo2max: number | null;
  poids_kg: number | null;
}

// Reads HR (mean + max) and active calories for a given date (YYYY-MM-DD).
// Returns null values if no data is available.
export async function readWorkoutMetrics(date: string): Promise<WorkoutMetrics> {
  const empty: WorkoutMetrics = { hrMean: null, hrMax: null, calories: null };
  try {
    const available = await isHealthKitAvailable();
    if (!available) return empty;

    const start = new Date(`${date}T00:00:00`);
    const end   = new Date(`${date}T23:59:59`);
    const filter = { date: { startDate: start, endDate: end } };

    const [hrStats, calStats] = await Promise.all([
      queryStatisticsForQuantity(
        'HKQuantityTypeIdentifierHeartRate',
        ['discreteAverage', 'discreteMax'],
        { filter, unit: 'count/min' },
      ),
      queryStatisticsForQuantity(
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        ['cumulativeSum'],
        { filter, unit: 'kcal' },
      ),
    ]);

    return {
      hrMean:   hrStats.averageQuantity  ? Math.round(hrStats.averageQuantity.quantity)  : null,
      hrMax:    hrStats.maximumQuantity  ? Math.round(hrStats.maximumQuantity.quantity)  : null,
      calories: calStats.sumQuantity     ? Math.round(calStats.sumQuantity.quantity)     : null,
    };
  } catch {
    return empty;
  }
}

// Reads the most recent RestingHeartRate, VO2Max, and body mass from HealthKit.
export async function readFitnessMetrics(): Promise<FitnessMetrics> {
  const empty: FitnessMetrics = { restingHR: null, vo2max: null, poids_kg: null };
  try {
    const available = await isHealthKitAvailable();
    if (!available) return empty;

    const [hrSamples, vo2Samples, weightSamples] = await Promise.all([
      queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', { limit: 1, ascending: false, unit: 'count/min' }),
      queryQuantitySamples('HKQuantityTypeIdentifierVO2Max',           { limit: 1, ascending: false, unit: 'ml/kg/min' }),
      queryQuantitySamples('HKQuantityTypeIdentifierBodyMass',         { limit: 1, ascending: false, unit: 'kg' }),
    ]);

    return {
      restingHR: hrSamples[0]     ? Math.round(hrSamples[0].quantity)     : null,
      vo2max:    vo2Samples[0]    ? Math.round(vo2Samples[0].quantity * 10) / 10 : null,
      poids_kg:  weightSamples[0] ? Math.round(weightSamples[0].quantity * 10) / 10 : null,
    };
  } catch {
    return empty;
  }
}

export async function saveWorkout(
  seance: Seance,
  sport: string | null | undefined,
  poids_kg?: number | null,
): Promise<string | null> {
  try {
    const activityType = sportToActivityType(sport);
    const calories = poids_kg ? estimateCalories(sport, seance.duree_minutes, poids_kg) : undefined;

    const startDate = new Date(`${seance.date}T08:00:00`);
    const endDate = new Date(startDate.getTime() + seance.duree_minutes * 60 * 1000);

    const totals: { energyBurned?: number; distance?: number } = {};
    if (calories) totals.energyBurned = calories;
    if (seance.distance_km) totals.distance = seance.distance_km * 1000;

    const workout = await saveWorkoutSample(
      activityType,
      [],
      startDate,
      endDate,
      Object.keys(totals).length > 0 ? totals : undefined,
    );

    return workout.uuid ?? null;
  } catch {
    return null;
  }
}
