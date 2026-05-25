import AsyncStorage from '@react-native-async-storage/async-storage';
import { Plan, Seance } from '../types';
import { patchSeance } from './api';

const PREFIX = 'offline_';
const PENDING_KEY = 'offline_pending';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

interface CacheEntry<T> {
  data: T;
  savedAt: number;
}

export interface PendingAction {
  id: string;
  seanceId: number;
  payload: { completee?: boolean; note?: string };
}

// ─── Cache ─────────────────────────────────────────────────────────────────────

export async function saveToCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, savedAt: Date.now() };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Silently ignore storage failures
  }
}

export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // New format with TTL wrapper
    if (parsed !== null && typeof parsed === 'object' && 'data' in parsed && 'savedAt' in parsed) {
      const entry = parsed as CacheEntry<T>;
      if (Date.now() - entry.savedAt > TTL_MS) {
        await AsyncStorage.removeItem(PREFIX + key);
        return null;
      }
      return entry.data;
    }
    // Legacy format (no TTL wrapper) — return as-is, replaced on next save
    return parsed as T;
  } catch {
    return null;
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(PREFIX));
    if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
  } catch {
    // Ignore
  }
}

export async function updateSeanceInCache(
  seanceId: number,
  updates: Partial<Seance>,
): Promise<void> {
  try {
    const plans = await getFromCache<Plan[]>('plans');
    if (!plans) return;
    for (const plan of plans) {
      const seances = await getFromCache<Seance[]>(`seances_${plan.id}`);
      if (!seances) continue;
      const idx = seances.findIndex((s) => s.id === seanceId);
      if (idx !== -1) {
        seances[idx] = { ...seances[idx], ...updates };
        await saveToCache(`seances_${plan.id}`, seances);
        break;
      }
    }
  } catch {
    // Ignore
  }
}

// ─── Pending queue ─────────────────────────────────────────────────────────────

async function getPendingActions(): Promise<PendingAction[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function savePendingActions(actions: PendingAction[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(actions));
  } catch {
    // Ignore
  }
}

export async function addPendingAction(
  seanceId: number,
  payload: PendingAction['payload'],
): Promise<void> {
  const pending = await getPendingActions();
  // Merge avec l'action existante pour la même séance (dernière valeur gagne)
  const existing = pending.findIndex((a) => a.seanceId === seanceId);
  if (existing !== -1) {
    pending[existing] = {
      ...pending[existing],
      payload: { ...pending[existing].payload, ...payload },
    };
  } else {
    pending.push({ id: `${Date.now()}_${seanceId}`, seanceId, payload });
  }
  await savePendingActions(pending);
}

export async function syncPendingActions(): Promise<void> {
  const pending = await getPendingActions();
  if (pending.length === 0) return;
  const remaining: PendingAction[] = [];
  for (const action of pending) {
    try {
      await patchSeance(action.seanceId, action.payload);
    } catch {
      remaining.push(action);
    }
  }
  await savePendingActions(remaining);
}
