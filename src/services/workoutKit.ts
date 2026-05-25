import { NativeModules, Platform } from 'react-native';
import type { Seance, SeanceSection, WorkoutStep } from '../types/index';

export interface ScheduledWorkout {
  id: string;
  displayName: string;
  date: string; // YYYY-MM-DD
}

const { TibFitWorkoutKit } = NativeModules as {
  TibFitWorkoutKit?: {
    getAuthorizationState(): Promise<'unavailable' | 'notDetermined' | 'authorized' | 'denied' | 'unknown'>;
    scheduleWorkout(config: WorkoutConfig): Promise<{ id: string; success: boolean }>;
    listWorkouts(): Promise<ScheduledWorkout[]>;
    removeWorkout(workoutId: string): Promise<{ success: boolean; reason?: string }>;
  };
};

interface WorkoutSectionConfig {
  titre: string;
  step_type: 'warmup' | 'cooldown' | 'interval';
  duree_seconds: number;
  iterations: number;
  work_seconds: number | null;
  recovery_seconds: number | null;
}

interface WorkoutConfig {
  displayName: string;
  activityType: string;
  dateISO?: string;
  sections: WorkoutSectionConfig[];
}

// ── Duration parsing ─────────────────────────────────────────────────────────

function parseDurationSeconds(text: string): number | null {
  const hourMin = text.match(/(\d+)\s*h\s*(\d+)\s*min/i);
  if (hourMin) return parseInt(hourMin[1]) * 3600 + parseInt(hourMin[2]) * 60;

  const hours = text.match(/(\d+)\s*h(?:eure)?s?/i);
  if (hours) return parseInt(hours[1]) * 3600;

  const mins = text.match(/(\d+)\s*min(?:utes?)?/i);
  if (mins) return parseInt(mins[1]) * 60;

  return null;
}

// ── Work/Recovery detection ──────────────────────────────────────────────────

function parseSeconds(value: string, unit: string): number {
  const n = parseInt(value);
  if (unit.includes('h')) return n * 3600;
  if (unit === "'" || unit.toLowerCase().startsWith('min')) return n * 60;
  return n;
}

function parseWorkRecovery(contenu: string): { workSeconds: number | null; recoverySeconds: number | null } {
  // Patterns: "5×4min + 2min récup", "8x(3' zone 3 / 1'30 récup)", "10x45s sprint / 15s récup"
  // "Nx WORK / RECOVERY [récup keyword]" — the recovery part follows / or + and is near a récup keyword

  let workSeconds: number | null = null;
  let recoverySeconds: number | null = null;

  // Work duration: after Nx or "séries de"
  const workMinMatch = contenu.match(/(?:\d+\s*[×x]\s*|séries?\s+(?:de\s+)?)(\d+)\s*(min|')/i);
  const workSecMatch = contenu.match(/(?:\d+\s*[×x]\s*)(\d+)\s*(s)\b/i);
  if (workMinMatch) {
    workSeconds = parseSeconds(workMinMatch[1], workMinMatch[2]);
  } else if (workSecMatch) {
    workSeconds = parseSeconds(workSecMatch[1], workSecMatch[2]);
  }

  // Recovery duration: after separator [/+] and near récup keyword
  // OR before récup keyword: "/ 2min récup", "/ 30s récup", "+ 1min récupération"
  const recovSepMinMatch = contenu.match(/[+/]\s*(\d+)\s*(min|')\s*(?:\w+\s*)?(?:récup|récupération|repos|rest|trot)/i);
  const recovSepSecMatch = contenu.match(/[+/]\s*(\d+)\s*(s)\b\s*(?:\w+\s*)?(?:récup|récupération|repos|rest|trot)/i);
  // "récup X min" or "récup Xs"
  const recovAfterMin = contenu.match(/(?:récup|récupération|repos|rest|trot)\s*(?:de\s+)?(\d+)\s*(min|')/i);
  const recovAfterSec = contenu.match(/(?:récup|récupération|repos|rest|trot)\s*(?:de\s+)?(\d+)\s*(s)\b/i);

  if (recovSepMinMatch) {
    recoverySeconds = parseSeconds(recovSepMinMatch[1], recovSepMinMatch[2]);
  } else if (recovSepSecMatch) {
    recoverySeconds = parseSeconds(recovSepSecMatch[1], recovSepSecMatch[2]);
  } else if (recovAfterMin) {
    recoverySeconds = parseSeconds(recovAfterMin[1], recovAfterMin[2]);
  } else if (recovAfterSec) {
    recoverySeconds = parseSeconds(recovAfterSec[1], recovAfterSec[2]);
  }

  return { workSeconds, recoverySeconds };
}

// ── Interval detection ───────────────────────────────────────────────────────

function detectIterations(contenu: string): number {
  const roundMatch = contenu.match(/(\d+)\s*(?:rounds?|tours?|séries?|répétitions?)/i);
  if (roundMatch) return Math.min(parseInt(roundMatch[1]), 30);

  const crossMatch = contenu.match(/(\d+)\s*[×x]\s*\d/i);
  if (crossMatch) return Math.min(parseInt(crossMatch[1]), 30);

  return 1;
}

// ── Section classification ───────────────────────────────────────────────────

type SectionKind = 'warmup' | 'main' | 'cooldown';

function classifySection(titre: string): SectionKind {
  const t = titre.toLowerCase();
  if (t.includes('échauffement') || t.includes('chauffe') || t.includes('warm')) return 'warmup';
  if (t.includes('retour') || t.includes('calme') || t.includes('cool') || t.includes('récup')) return 'cooldown';
  return 'main';
}

// ── Duration estimation ──────────────────────────────────────────────────────

function estimateSectionDurations(sections: SeanceSection[], totalMinutes: number): number[] {
  const totalSeconds = totalMinutes * 60;

  const parsed = sections.map((s) => parseDurationSeconds(s.contenu));
  const knownTotal = parsed.reduce<number>((sum, d) => sum + (d ?? 0), 0);

  if (knownTotal > 0 && knownTotal <= totalSeconds * 1.1) {
    const remainder = Math.max(0, totalSeconds - knownTotal);
    const unknownCount = parsed.filter((d) => d === null).length;
    const perUnknown = unknownCount > 0 ? Math.round(remainder / unknownCount) : 0;
    return parsed.map((d) => d ?? perUnknown);
  }

  const kinds = sections.map((s) => classifySection(s.titre));
  const warmupWeight = 0.20;
  const cooldownWeight = 0.15;

  const warmupCount   = kinds.filter((k) => k === 'warmup').length;
  const cooldownCount = kinds.filter((k) => k === 'cooldown').length;
  const mainCount     = kinds.filter((k) => k === 'main').length || 1;

  const warmupSeconds   = warmupCount   > 0 ? Math.round((warmupWeight * totalSeconds) / warmupCount)   : 0;
  const cooldownSeconds = cooldownCount > 0 ? Math.round((cooldownWeight * totalSeconds) / cooldownCount) : 0;
  const usedSeconds     = warmupSeconds * warmupCount + cooldownSeconds * cooldownCount;
  const mainSeconds     = Math.round((totalSeconds - usedSeconds) / mainCount);

  return kinds.map((k) => {
    if (k === 'warmup')   return warmupSeconds;
    if (k === 'cooldown') return cooldownSeconds;
    return mainSeconds;
  });
}

// ── Build sections config ────────────────────────────────────────────────────

function sectionsFromWorkoutSteps(steps: WorkoutStep[]): WorkoutSectionConfig[] {
  return steps.map((step) => {
    if (step.type === 'warmup') {
      return {
        titre:            step.label ?? 'Échauffement',
        step_type:        'warmup',
        duree_seconds:    step.duree_seconds ?? 0,
        iterations:       1,
        work_seconds:     null,
        recovery_seconds: null,
      };
    }
    if (step.type === 'cooldown') {
      return {
        titre:            step.label ?? 'Retour au calme',
        step_type:        'cooldown',
        duree_seconds:    step.duree_seconds ?? 0,
        iterations:       1,
        work_seconds:     null,
        recovery_seconds: null,
      };
    }
    // interval
    const iters = step.iterations ?? 1;
    const workSecs = step.work_seconds ?? 0;
    const recSecs = step.recovery_seconds ?? 0;
    return {
      titre:            step.work_label ?? 'Corps de séance',
      step_type:        'interval',
      duree_seconds:    (workSecs + recSecs) * iters,
      iterations:       iters,
      work_seconds:     workSecs > 0 ? workSecs : null,
      recovery_seconds: recSecs  > 0 ? recSecs  : null,
    };
  });
}

function buildSections(seance: Seance): WorkoutSectionConfig[] {
  // Priorité : workout_steps structuré généré par l'IA
  if (seance.workout_steps && seance.workout_steps.length > 0) {
    return sectionsFromWorkoutSteps(seance.workout_steps);
  }
  // Fallback : parsing heuristique (séances anciennes sans workout_steps)
  const durations = estimateSectionDurations(seance.sections, seance.duree_minutes);
  return seance.sections.map((s, i) => {
    const { workSeconds, recoverySeconds } = parseWorkRecovery(s.contenu);
    const iterations = detectIterations(s.contenu);
    const kind = classifySection(s.titre);
    return {
      titre:            s.titre,
      step_type:        kind === 'warmup' ? 'warmup' : kind === 'cooldown' ? 'cooldown' : 'interval',
      duree_seconds:    durations[i] ?? 0,
      iterations,
      work_seconds:     workSeconds,
      recovery_seconds: recoverySeconds,
    };
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function isWorkoutKitAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !TibFitWorkoutKit) return false;
  try {
    const state = await TibFitWorkoutKit.getAuthorizationState();
    return state !== 'unavailable';
  } catch {
    return false;
  }
}

export async function getWorkoutKitAuthState() {
  if (Platform.OS !== 'ios' || !TibFitWorkoutKit) return 'unavailable' as const;
  try {
    return await TibFitWorkoutKit.getAuthorizationState();
  } catch {
    return 'unavailable' as const;
  }
}

// Crée et planifie l'entrainement sur Apple Watch
export async function createWorkoutOnWatch(
  seance: Seance,
  sport: string | null | undefined,
): Promise<string | 'unsupported_activity' | null> {
  if (Platform.OS !== 'ios' || !TibFitWorkoutKit) return null;
  try {
    const sections = buildSections(seance);
    const config: WorkoutConfig = {
      displayName:  seance.emoji ? `${seance.emoji} ${seance.titre}` : seance.titre,
      activityType: sport ?? 'other',
      dateISO:      seance.date,
      sections,
    };

    const result = await TibFitWorkoutKit.scheduleWorkout(config);
    return result.success ? result.id : null;
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'UNSUPPORTED_ACTIVITY') return 'unsupported_activity';
    console.warn('[WorkoutKit] createWorkout a échoué :', e);
    return null;
  }
}

export async function listScheduledWorkouts(): Promise<ScheduledWorkout[]> {
  if (Platform.OS !== 'ios' || !TibFitWorkoutKit) return [];
  try {
    return await TibFitWorkoutKit.listWorkouts();
  } catch {
    return [];
  }
}

export async function scheduleWorkoutOnWatch(
  seance: Seance,
  sport: string | null | undefined,
): Promise<string | null> {
  if (Platform.OS !== 'ios' || !TibFitWorkoutKit) return null;
  try {
    const sections = buildSections(seance);
    const config: WorkoutConfig = {
      displayName:  seance.emoji ? `${seance.emoji} ${seance.titre}` : seance.titre,
      activityType: sport ?? 'other',
      dateISO:      seance.date,
      sections,
    };
    const result = await TibFitWorkoutKit.scheduleWorkout(config);
    return result.success ? result.id : null;
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'UNSUPPORTED_ACTIVITY') return 'unsupported_activity';
    console.warn('[WorkoutKit] scheduleWorkout a échoué :', e);
    return null;
  }
}

export async function removeScheduledWorkout(workoutId: string): Promise<boolean> {
  if (Platform.OS !== 'ios' || !TibFitWorkoutKit) return false;
  try {
    const result = await TibFitWorkoutKit.removeWorkout(workoutId);
    return result.success;
  } catch {
    return false;
  }
}
