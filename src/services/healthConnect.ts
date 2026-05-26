import {
  initialize,
  checkAvailability,
  requestPermission,
  readRecords,
  insertRecords,
  openHealthConnectSettings,
  getGrantedPermissions,
} from 'react-native-health-connect';
import type { Seance } from '../types';

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

const PERMISSIONS_READ = [
  { accessType: 'read' as const, recordType: 'HeartRate' },
  { accessType: 'read' as const, recordType: 'RestingHeartRate' },
  { accessType: 'read' as const, recordType: 'Vo2Max' },
  { accessType: 'read' as const, recordType: 'Weight' },
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' },
];

const PERMISSIONS_WRITE = [
  { accessType: 'write' as const, recordType: 'ExerciseSession' },
  { accessType: 'write' as const, recordType: 'ActiveCaloriesBurned' },
];

// Mapping sport → exercise type (Health Connect numeric constants)
const EXERCISE_TYPE_BY_SPORT: [string, number][] = [
  ['running', 56], ['course', 56], ['trail', 56],
  ['vélo', 8],     ['cycl', 8],
  ['natation', 68], ['swim', 68],
  ['muscu', 62],   ['strength', 62], ['street', 62], ['workout', 62],
  ['yoga', 79],
  ['marche', 78],  ['walk', 78],
];

function sportToExerciseType(sport: string | null | undefined): number {
  const s = (sport ?? '').toLowerCase();
  return EXERCISE_TYPE_BY_SPORT.find(([key]) => s.includes(key))?.[1] ?? 3; // 3 = OTHER_WORKOUT
}

async function ensureInitialized(): Promise<boolean> {
  try {
    const availability = await checkAvailability();
    if (availability !== 'Available') return false;
    return await initialize();
  } catch {
    return false;
  }
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  try {
    return (await checkAvailability()) === 'Available';
  } catch {
    return false;
  }
}

export async function isAuthorized(): Promise<boolean> {
  const available = await isHealthConnectAvailable();
  if (!available) return false;
  try {
    await initialize();
    const granted = await getGrantedPermissions();
    return PERMISSIONS_WRITE.every((p) =>
      granted.some((g) => g.accessType === p.accessType && g.recordType === p.recordType),
    );
  } catch {
    return false;
  }
}

export async function canReadWorkoutMetrics(): Promise<boolean> {
  const available = await isHealthConnectAvailable();
  if (!available) return false;
  try {
    await initialize();
    const granted = await getGrantedPermissions();
    return granted.some((g) => g.accessType === 'read' && g.recordType === 'HeartRate');
  } catch {
    return false;
  }
}

export async function requestPermissions(): Promise<boolean> {
  const available = await isHealthConnectAvailable();
  if (!available) return false;
  try {
    await initialize();
    const granted = await requestPermission([...PERMISSIONS_READ, ...PERMISSIONS_WRITE]);
    return PERMISSIONS_WRITE.every((p) =>
      granted.some((g) => g.accessType === p.accessType && g.recordType === p.recordType),
    );
  } catch {
    return false;
  }
}

export function openHealthSettings(): void {
  try {
    openHealthConnectSettings();
  } catch {}
}

export async function readWorkoutMetrics(date: string): Promise<WorkoutMetrics> {
  const empty: WorkoutMetrics = { hrMean: null, hrMax: null, calories: null };
  try {
    const initialized = await ensureInitialized();
    if (!initialized) return empty;

    const startTime = new Date(`${date}T00:00:00`).toISOString();
    const endTime   = new Date(`${date}T23:59:59`).toISOString();
    const filter = { operator: 'between' as const, startTime, endTime };

    const [hrResult, calResult] = await Promise.all([
      readRecords('HeartRate',              { timeRangeFilter: filter }),
      readRecords('ActiveCaloriesBurned',   { timeRangeFilter: filter }),
    ]);

    const hrSamples = (hrResult.records as any[]).flatMap((r) => r.samples ?? []);
    const hrValues  = hrSamples.map((s: any) => s.beatsPerMinute as number).filter(Boolean);
    const hrMean    = hrValues.length > 0 ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length) : null;
    const hrMax     = hrValues.length > 0 ? Math.round(Math.max(...hrValues)) : null;

    const totalCal  = (calResult.records as any[]).reduce((sum, r) => sum + (r.energy?.inKilocalories ?? 0), 0);
    const calories  = totalCal > 0 ? Math.round(totalCal) : null;

    return { hrMean, hrMax, calories };
  } catch {
    return empty;
  }
}

export async function readFitnessMetrics(): Promise<FitnessMetrics> {
  const empty: FitnessMetrics = { restingHR: null, vo2max: null, poids_kg: null };
  try {
    const initialized = await ensureInitialized();
    if (!initialized) return empty;

    const startTime = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const endTime   = new Date().toISOString();
    const filter = { operator: 'between' as const, startTime, endTime };
    const latest = { timeRangeFilter: filter, ascendingOrder: false, pageSize: 1 };

    const [rrResult, vo2Result, weightResult] = await Promise.all([
      readRecords('RestingHeartRate', latest),
      readRecords('Vo2Max',           latest),
      readRecords('Weight',           latest),
    ]);

    const rr     = (rrResult.records as any[])[0];
    const vo2    = (vo2Result.records as any[])[0];
    const weight = (weightResult.records as any[])[0];

    return {
      restingHR: rr     ? Math.round(rr.beatsPerMinute) : null,
      vo2max:    vo2    ? Math.round(vo2.vo2MillilitersPerMinuteKilogram * 10) / 10 : null,
      poids_kg:  weight ? Math.round(weight.weight.inKilograms * 10) / 10 : null,
    };
  } catch {
    return empty;
  }
}

export async function saveWorkout(
  seance: Seance,
  sport: string | null | undefined,
  _poids_kg?: number | null,
): Promise<string | null> {
  try {
    const initialized = await ensureInitialized();
    if (!initialized) return null;

    const startDate = new Date(`${seance.date}T08:00:00`);
    const endDate   = new Date(startDate.getTime() + seance.duree_minutes * 60 * 1000);

    const ids = await insertRecords([{
      recordType:   'ExerciseSession',
      startTime:    startDate.toISOString(),
      endTime:      endDate.toISOString(),
      exerciseType: sportToExerciseType(sport),
      title:        seance.titre,
    }]);

    return ids[0] ?? null;
  } catch {
    return null;
  }
}
