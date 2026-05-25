import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import i18n from '../i18n';
import { Plan, Seance } from '../types';

// Set EXPO_PUBLIC_API_URL in .env.development or eas.json (production profile)
// For a physical device on local WiFi: EXPO_PUBLIC_API_URL=http://192.168.1.XX
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost';

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('token');
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function extractCode(data: any): string {
  const detail = data?.detail;
  if (detail && typeof detail === 'object' && detail.code) return detail.code as string;
  if (typeof detail === 'string') return detail;
  return 'UNKNOWN_ERROR';
}

// Mutex pour éviter plusieurs refresh simultanés
let _refreshPromise: Promise<string | null> | null = null;

async function _doRefresh(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem('refresh_token');
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    await AsyncStorage.setItem('token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    return data.access_token as string;
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!_refreshPromise) {
    _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null; });
  }
  return _refreshPromise;
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': i18n.language,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      await AsyncStorage.multiRemove(['token', 'refresh_token']);
      throw new Error('SESSION_EXPIRED');
    }
    return fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newToken}`,
        ...(options.headers ?? {}),
      },
    });
  }
  return res;
}

// ─── AUTH ──────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(extractCode(data));
  }
  const data = await safeJson(res);
  await AsyncStorage.setItem('token', data.access_token);
  await AsyncStorage.setItem('refresh_token', data.refresh_token);
  return data.access_token;
}

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(extractCode(data));
  }
  const data = await safeJson(res);
  await AsyncStorage.setItem('token', data.access_token);
  await AsyncStorage.setItem('refresh_token', data.refresh_token);
  return data.access_token;
}

export async function googleSignIn(idToken: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(extractCode(data));
  }
  const data = await safeJson(res);
  await AsyncStorage.setItem('token', data.access_token);
  await AsyncStorage.setItem('refresh_token', data.refresh_token);
  return data.access_token as string;
}

export async function appleSignIn(identityToken: string, fullName?: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/apple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity_token: identityToken, full_name: fullName ?? null }),
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(extractCode(data));
  }
  const data = await safeJson(res);
  await AsyncStorage.setItem('token', data.access_token);
  await AsyncStorage.setItem('refresh_token', data.refresh_token);
  return data.access_token as string;
}

export async function forgotPassword(email: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `email=${encodeURIComponent(email)}`,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function logout(): Promise<void> {
  await AsyncStorage.multiRemove(['token', 'refresh_token']);
}

export async function deleteAccount(): Promise<void> {
  const res = await authFetch('/auth/me', { method: 'DELETE' });
  if (!res.ok) throw new Error('Impossible de supprimer le compte');
  await AsyncStorage.removeItem('token');
}

export async function exportData(): Promise<string> {
  const res = await authFetch('/auth/me/export');
  if (!res.ok) throw new Error("Impossible d'exporter les données");
  const json = await res.json();
  return JSON.stringify(json, null, 2);
}

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  niveau: string | null;
  objectif: string | null;
  streak: number;
  is_premium: boolean;
  poids_kg_actuel: number | null;  // lu depuis user_metrics['poids_corporel']
}

export interface AthleteProfilePayload {
  niveau?: string | null;
  objectif?: string | null;
}

export async function getMe(): Promise<UserProfile> {
  const res = await authFetch('/auth/me');
  if (!res.ok) throw new Error('Impossible de charger le profil');
  return res.json();
}

export async function updateAthleteProfile(payload: AthleteProfilePayload): Promise<UserProfile> {
  const res = await authFetch('/auth/me/profil', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(extractCode(data));
  }
  return res.json();
}

export interface MetricSnapshot {
  id: number;
  recorded_at: string;
  vma: number | null;
  ftp: number | null;
  poids_kg: number | null;
  fc_max: number | null;
}

export async function getMetricsHistory(): Promise<MetricSnapshot[]> {
  const res = await authFetch('/auth/me/metrics/history');
  if (!res.ok) throw new Error("Impossible de charger l'historique des métriques");
  return res.json();
}

export interface PendingRecalibrationInfo {
  metric_id: string;
  plan_id: number;
  plan_titre: string;
  test_seance_date: string;
  nb_seances_a_recalibrer: number;
}

export interface UserMetric {
  id: number;
  metric_id: string;
  value: string;
  source: string;
  updated_at: string;
  pending_recalibration?: PendingRecalibrationInfo | null;
}

export interface CatalogMetric {
  id: string;
  name: string;
  description: string;
  category: string;
  sports: string[];
  unit: string | null;
  type: 'number' | 'scale' | 'enum' | 'text';
  value_range?: { min: number; max: number };
  enum_values?: string[];
  volatility: 'stable' | 'contextual';
  refresh_after_months?: number;
  blocking_for_sports: string[];
  discovery_session?: {
    title: string;
    description: string;
    duration_minutes: number;
    sport: string;
    week_placement: number;
  };
  user_value: string | null;
  user_source: string | null;
  user_updated_at: string | null;
}

export interface CustomMetricDef {
  id: number;
  metric_id: string;
  name: string;
  type: 'number' | 'text' | 'scale';
  unit: string | null;
  created_at: string;
}

export async function getCustomMetrics(): Promise<CustomMetricDef[]> {
  const res = await authFetch('/me/custom-metrics');
  if (!res.ok) throw new Error('Impossible de charger les métriques personnalisées');
  return res.json();
}

export async function createCustomMetric(
  name: string,
  type: 'number' | 'text' | 'scale',
  unit: string | null,
  initialValue: string | null,
): Promise<CustomMetricDef> {
  const res = await authFetch('/me/custom-metrics', {
    method: 'POST',
    body: JSON.stringify({ name, type, unit: unit || null, initial_value: initialValue || null }),
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(extractCode(data));
  }
  return res.json();
}

export async function updateCustomMetric(id: number, name: string, unit: string | null): Promise<CustomMetricDef> {
  const res = await authFetch(`/me/custom-metrics/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, unit: unit || null }),
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(extractCode(data));
  }
  return res.json();
}

export async function deleteCustomMetric(id: number): Promise<void> {
  const res = await authFetch(`/me/custom-metrics/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('DELETE_CUSTOM_METRIC_FAILED');
}

export async function getUserMetrics(): Promise<UserMetric[]> {
  const res = await authFetch('/me/metrics');
  if (!res.ok) throw new Error('Impossible de charger les métriques');
  return res.json();
}

export async function upsertUserMetric(metric_id: string, value: string, source: string = 'user'): Promise<UserMetric> {
  const res = await authFetch('/me/metrics', {
    method: 'PUT',
    body: JSON.stringify({ metric_id, value, source }),
  });
  if (!res.ok) {
    const data = await safeJson(res);
    const code = extractCode(data);
    console.error('[upsertUserMetric] HTTP', res.status, 'metric_id:', metric_id, 'response:', JSON.stringify(data));
    throw new Error(code);
  }
  return res.json();
}

export async function submitMetricResult(metricId: string, value: string): Promise<UserMetric> {
  return upsertUserMetric(metricId, value, 'test_session');
}

export async function updateUserMetric(id: number, patch: { value?: string; source?: string }): Promise<UserMetric> {
  const res = await authFetch(`/me/metrics/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(extractCode(data));
  }
  return res.json();
}

export async function deleteUserMetric(id: number): Promise<void> {
  const res = await authFetch(`/me/metrics/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(extractCode(data));
  }
}

export async function getPendingRecalibrations(): Promise<PendingRecalibrationInfo[]> {
  const res = await authFetch('/me/metrics/pending-recalibrations');
  if (!res.ok) return [];
  return res.json();
}

export async function recalibratePlanStream(
  metricId: string,
  onChunk: (chunk: string) => void,
  onDone: (planId: number, nbSeances: number) => void,
  onError: (msg: string) => void,
): Promise<void> {
  const token = await getToken();
  await consumeSSEXhr({
    url: `${BASE_URL}/me/metrics/${metricId}/recalibrate-plan`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': i18n.language,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: null,
    onChunk,
    onDone: (planId, nbSeances) => {
      if (planId !== undefined) onDone(planId, nbSeances ?? 0);
    },
    onError,
  });
}

export async function getMetricsCatalog(): Promise<CatalogMetric[]> {
  const res = await authFetch('/metrics/catalog');
  if (!res.ok) throw new Error('CATALOG_FETCH_FAILED');
  return res.json();
}

export async function selectMetricsForPlan(demande: string): Promise<CatalogMetric[]> {
  const res = await authFetch('/plans/select-metrics', {
    method: 'POST',
    body: JSON.stringify({ demande }),
  });
  if (!res.ok) throw new Error('METRICS_SELECT_FAILED');
  const data = await res.json();
  return data.metrics as CatalogMetric[];
}

export async function selectDaysForPlan(demande: string): Promise<{ jours: string[]; semaines: number | null }> {
  const res = await authFetch('/plans/select-days', {
    method: 'POST',
    body: JSON.stringify({ demande }),
  });
  if (!res.ok) throw new Error('DAYS_SELECT_FAILED');
  const data = await res.json();
  return { jours: data.jours as string[], semaines: data.semaines as number | null };
}

export async function updateProfile(name: string): Promise<UserProfile> {
  const res = await authFetch('/auth/me', {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(extractCode(data));
  }
  return res.json();
}

export async function updatePassword(current_password: string, new_password: string): Promise<void> {
  const res = await authFetch('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ current_password, new_password }),
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(extractCode(data));
  }
}

export async function renamePlan(planId: number, titre: string): Promise<Plan> {
  const res = await authFetch(`/plans/${planId}`, {
    method: 'PUT',
    body: JSON.stringify({ titre }),
  });
  if (!res.ok) throw new Error('Impossible de renommer le plan');
  return res.json();
}

// ─── PLANS ────────────────────────────────────────────────────────────────────

export async function canCreatePlan(): Promise<void> {
  const res = await authFetch('/plans/can-create');
  if (res.status === 403) throw new Error('PREMIUM_REQUIRED');
  if (!res.ok) throw new Error('Erreur réseau');
}

export async function getPlans(): Promise<Plan[]> {
  const res = await authFetch('/plans');
  if (!res.ok) throw new Error('Impossible de charger les plans');
  return res.json();
}

export interface PlanScore {
  score: number;
  nb_seances_passees: number;
  nb_completees: number;
  nb_sautees_consecutives: number;
}

export async function getPlanScore(planId: number): Promise<PlanScore> {
  const res = await authFetch(`/plans/${planId}/score`);
  if (!res.ok) throw new Error('Impossible de charger le score');
  return res.json();
}

export interface SemaineSurcharge {
  semaine: string;
  label: string;
  charge: number;
  nb_seances: number;
  en_surcharge: boolean;
}

export interface FormeScore {
  charge_ua: number;
  niveau: string;
  fraicheur: number;    // 0-100 : 100 = top forme, 0 = épuisé
  jours_consecutifs: number;
  surcharge: boolean;
  semaines_a_venir: SemaineSurcharge[];
}

export async function getForme(): Promise<FormeScore> {
  const res = await authFetch('/plans/fatigue');
  if (!res.ok) throw new Error('Impossible de charger le score de forme');
  return res.json();
}

export interface FormeHistoryEntry {
  week_start: string;
  fraicheur: number;
}

export async function getFormeHistory(): Promise<FormeHistoryEntry[]> {
  const res = await authFetch('/auth/me/forme/history');
  if (!res.ok) throw new Error('Impossible de charger l\'historique de forme');
  return res.json();
}


export interface ScoreSnapshot {
  id: number;
  score: number;
  calcule_le: string;
}

export async function getPlanScoreHistory(planId: number): Promise<ScoreSnapshot[]> {
  const res = await authFetch(`/plans/${planId}/score/historique`);
  if (!res.ok) throw new Error('Impossible de charger le score');
  return res.json();
}

export interface PlanStats {
  nb_seances_total: number;
  nb_completees: number;
  taux_completion: number;
  duree_totale_minutes: number;
  duree_completee_minutes: number;
  charge_semaine_courante: number;
  charge_semaine_precedente: number;
  streak: number;
}

export interface PlanStreakEntry {
  streak_length: number;
  started_on: string;
  ended_on: string;
}

export async function getPlanStats(planId: number): Promise<PlanStats> {
  const res = await authFetch(`/plans/${planId}/stats`);
  if (!res.ok) throw new Error('Impossible de charger les stats');
  return res.json();
}

export async function getPlanStreakHistory(planId: number): Promise<PlanStreakEntry[]> {
  const res = await authFetch(`/plans/${planId}/streak-history`);
  if (!res.ok) throw new Error('Impossible de charger l\'historique de streak');
  return res.json();
}

export async function getTotalStreakHistory(): Promise<PlanStreakEntry[]> {
  const res = await authFetch('/auth/me/streak-history');
  if (!res.ok) throw new Error('Impossible de charger l\'historique de streak');
  return res.json();
}

export interface MonthSnapshot {
  nb_seances: number;
  volume_minutes: number;
  distance_km: number;
  rpe_moyen: number | null;
}

export interface PlanComparison {
  current: MonthSnapshot;
  previous: MonthSnapshot;
}

export async function getPlanComparison(planId: number): Promise<PlanComparison> {
  const res = await authFetch(`/plans/${planId}/comparison`);
  if (!res.ok) throw new Error('Impossible de charger la comparaison');
  return res.json();
}

export async function deletePlan(planId: number): Promise<void> {
  const res = await authFetch(`/plans/${planId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Impossible de supprimer le plan');
}

export async function exportPlanPdf(planId: number): Promise<string> {
  let token = await getToken();
  const url = `${BASE_URL}/plans/${planId}/export/pdf`;
  const dest = `${FileSystem.cacheDirectory}plan_${planId}.pdf`;
  let result = await FileSystem.downloadAsync(url, dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (result.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      await AsyncStorage.multiRemove(['token', 'refresh_token']);
      throw new Error('SESSION_EXPIRED');
    }
    result = await FileSystem.downloadAsync(url, dest, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
  }
  if (result.status !== 200) throw new Error(`Erreur PDF (${result.status})`);
  return result.uri;
}

export async function patchPlan(
  planId: number,
  data: { couleur?: string | null; emoji?: string | null },
): Promise<Plan> {
  const res = await authFetch(`/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Impossible de mettre à jour le plan');
  return res.json();
}

// ─── SÉANCES ──────────────────────────────────────────────────────────────────

export async function getSeances(planId: number): Promise<Seance[]> {
  const res = await authFetch(`/plans/${planId}/seances`);
  if (!res.ok) throw new Error('Impossible de charger les séances');
  return res.json();
}

export async function findSeanceById(
  seanceId: number,
): Promise<{ seance: Seance; plan: Plan } | null> {
  const plans = await getPlans();
  for (const plan of plans) {
    const seances = await getSeances(plan.id);
    const found = seances.find((s) => s.id === seanceId);
    if (found) return { seance: found, plan };
  }
  return null;
}

export async function patchSeance(
  seanceId: number,
  data: {
    completee?: boolean;
    note?: string;
    emoji?: string | null;
    hk_workout_id?: string | null;
    wk_workout_id?: string | null;
    hr_mean?: number | null;
    hr_max?: number | null;
    calories_reelles?: number | null;
  },
): Promise<Seance> {
  const res = await authFetch(`/seances/${seanceId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Impossible de sauvegarder');
  return res.json();
}

// ─── GENERATE PLAN (SSE) ──────────────────────────────────────────────────────

export async function generatePlan(
  demande: string,
  onChunk: (chunk: string) => void,
  onDone: (planId: number) => void,
  onError: (msg: string) => void,
  warmupMode?: 'direct_test' | 'base_first' | null,
  missingBlockingMetrics?: string[],
  joursSemaine?: string[] | null,
  dureeSemaines?: number,
): Promise<void> {
  const generationStartedAt = Date.now();
  const token = await getToken();

  const result = await consumeSSEXhr({
    url: `${BASE_URL}/plans`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': i18n.language,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      demande,
      discovery_sessions: [],
      warmup_mode: warmupMode ?? null,
      missing_blocking_metrics: missingBlockingMetrics ?? [],
      jours_semaine: joursSemaine ?? null,
      duree_semaines: dureeSemaines ?? null,
    }),
    onChunk,
    onDone: (planId) => onDone(planId!),
    onError,
  });

  if (result === 'interrupted') {
    try {
      const plans = await getPlans();
      const latest = plans[0];
      const latestCreatedAt = latest ? new Date(latest.created_at).getTime() : 0;
      if (latest && latestCreatedAt >= generationStartedAt - 60_000) {
        onDone(latest.id);
        return;
      }
    } catch { /* ignore */ }
    onError(i18n.t('errors.GENERATION_FAILED'));
  }
}

// ─── REFRESH PLAN (SSE) ───────────────────────────────────────────────────────

export async function refreshPlan(
  planId: number,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
): Promise<void> {
  const token = await getToken();

  const result = await consumeSSEXhr({
    url: `${BASE_URL}/plans/${planId}/actualiser`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': i18n.language,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: null,
    onChunk,
    onDone: () => onDone(),
    onError,
  });

  if (result === 'interrupted') onError(i18n.t('errors.UPDATE_INTERRUPTED'));
}

// ─── CHAT PLAN (JSON) ─────────────────────────────────────────────────────────

export interface ChatPlanResult {
  message: string;
  operations_appliquees: number;
  detail_operations: string[];
}

export async function chatPlan(
  planId: number,
  message: string,
): Promise<ChatPlanResult> {
  const res = await authFetch(`/plans/${planId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  if (res.status === 403) throw new Error('PREMIUM_REQUIRED');
  if (res.status === 429) throw new Error(rateLimitMessage(res.headers.get('Retry-After')));
  if (!res.ok) throw new Error('Erreur du coach IA');
  return res.json();
}

export interface ConversationMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

export async function getConversation(planId: number): Promise<ConversationMessage[]> {
  const res = await authFetch(`/plans/${planId}/conversation`);
  if (!res.ok) throw new Error('Impossible de charger la conversation');
  return res.json();
}

export async function deleteConversation(planId: number): Promise<void> {
  const res = await authFetch(`/plans/${planId}/conversation`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Impossible de réinitialiser la conversation');
}

// ─── CHAT SÉANCE (JSON) ───────────────────────────────────────────────────────

export interface ChatSeanceResult {
  message: string;
  patch: Record<string, unknown>;
}

export async function chatSeance(
  seanceId: number,
  message: string,
): Promise<ChatSeanceResult> {
  const res = await authFetch(`/seances/${seanceId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  if (res.status === 403) throw new Error('PREMIUM_REQUIRED');
  if (res.status === 429) throw new Error(rateLimitMessage(res.headers.get('Retry-After')));
  if (!res.ok) throw new Error('Erreur du coach IA');
  return res.json();
}

// ─── RATE LIMIT ───────────────────────────────────────────────────────────────

function rateLimitMessage(retryAfter: string | null): string {
  const seconds = retryAfter ? parseInt(retryAfter, 10) : NaN;
  if (!isNaN(seconds) && seconds > 0) {
    const minutes = Math.ceil(seconds / 60);
    return i18n.t('errors.rateLimitMinutes', { count: minutes });
  }
  return i18n.t('errors.rateLimit');
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export async function registerPushToken(token: string): Promise<void> {
  const res = await authFetch('/notifications/token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error("Impossible d'enregistrer le token push");
}

export async function revokePushToken(token: string): Promise<void> {
  await authFetch('/notifications/token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}

// ─── Weekly Checkin ────────────────────────────────────────────────────────────

export interface WeeklyCheckinData {
  id: number;
  week_start: string;
  stress_level: number | null;
  sleep_quality: number | null;
  weight_kg: number | null;
  created_at: string;
}

export async function getCurrentWeekCheckin(): Promise<WeeklyCheckinData | null> {
  const res = await authFetch('/me/weekly-checkin');
  if (!res.ok) return null;
  const data = await res.json();
  return data ?? null;
}

export async function submitWeeklyCheckin(payload: {
  stress_level: number | null;
  sleep_quality: number | null;
  weight_kg: number | null;
}): Promise<WeeklyCheckinData> {
  const res = await authFetch('/me/weekly-checkin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('CHECKIN_FAILED');
  return res.json();
}

// ─── Plan extend ──────────────────────────────────────────────────────────────

export interface ExtendTestCheckResult {
  suggest_test: boolean;
  metric_id: string | null;
  metric_label: string | null;
  weeks_since_update: number | null;
  jours_semaine: string[];
}

export async function checkExtendTest(planId: number): Promise<ExtendTestCheckResult> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/plans/${planId}/extend/check-test`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error('check_extend_test_failed');
  return res.json();
}

export async function extendPlanStream(
  planId: number,
  weeks: number,
  onChunk: (chunk: string) => void,
  onDone: (planId: number, nbSeances: number) => void,
  onError: (msg: string) => void,
  joursSemaine?: string[] | null,
  includeDiscoverySession?: boolean,
): Promise<void> {
  const token = await getToken();
  await consumeSSEXhr({
    url: `${BASE_URL}/plans/${planId}/extend`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': i18n.language,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      weeks,
      jours_semaine: joursSemaine ?? null,
      include_discovery_session: includeDiscoverySession ?? false,
    }),
    onChunk,
    onDone: (pid, nbSeances) => {
      if (pid !== undefined) onDone(pid, nbSeances ?? 0);
    },
    onError,
  });
}

export async function upsertPlanReview(
  planId: number,
  rating: 'up' | 'down' | null,
  reasons?: string[],
  freetext?: string,
  phase: 'generation' | 'week1' | 'completion' = 'generation',
): Promise<void> {
  await authFetch(`/plans/${planId}/reviews`, {
    method: 'POST',
    body: JSON.stringify({
      user_rating: rating,
      user_reasons: reasons ?? null,
      user_freetext: freetext ?? null,
      rating_phase: phase,
    }),
  });
}

// ─── SSE HELPER (XHR — ReadableStream non supporté sur React Native iOS) ──────

interface ConsumeSSEXhrOptions {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  onChunk: (chunk: string) => void;
  onDone: (planId?: number, nbSeances?: number) => void;
  onError: (msg: string) => void;
}

function consumeSSEXhr(opts: ConsumeSSEXhrOptions): Promise<'done' | 'error' | 'interrupted'> {
  return new Promise((resolve) => {
    const { url, method, headers, body, onChunk, onDone, onError } = opts;
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

    let offset = 0;
    let lastPlanId: number | undefined;
    let settled = false;

    function settle(result: 'done' | 'error' | 'interrupted') {
      if (!settled) { settled = true; resolve(result); }
    }

    function processNewText(text: string) {
      const lines = text.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        try {
          const json = JSON.parse(payload);
          if (json.event === 'done') {
            lastPlanId = json.plan_id;
            onDone(json.plan_id, json.nb_seances);
            settle('done');
            return;
          }
          if (json.event === 'error') {
            onError(json.message ?? i18n.t('errors.GENERATION_FAILED'));
            settle('error');
            return;
          }
          if (json.token) onChunk(json.token);
        } catch { /* ligne non-JSON, ignorée */ }
      }
    }

    xhr.onprogress = () => {
      const newText = xhr.responseText.slice(offset);
      offset = xhr.responseText.length;
      processNewText(newText);
    };

    xhr.onload = () => {
      // Traiter le reste non encore consommé par onprogress
      const remaining = xhr.responseText.slice(offset);
      if (remaining) processNewText(remaining);

      if (!settled) {
        if (lastPlanId !== undefined) {
          onDone(lastPlanId);
          settle('done');
        } else if (xhr.status >= 200 && xhr.status < 300) {
          settle('interrupted');
        } else {
          onError(xhr.status === 403
            ? 'PREMIUM_REQUIRED'
            : xhr.status === 429
              ? rateLimitMessage(xhr.getResponseHeader('Retry-After'))
              : i18n.t('errors.GENERATION_FAILED'),
          );
          settle('error');
        }
      }
    };

    xhr.onerror = () => { if (!settled) settle('interrupted'); };
    xhr.ontimeout = () => { if (!settled) settle('interrupted'); };

    xhr.send(body);
  });
}
