export interface Plan {
  id: number;
  titre: string;
  sport?: string | null;
  couleur?: string | null;
  emoji?: string | null;
  created_at: string;
}

export interface SeanceSection {
  titre: string;
  contenu: string;
}

export type WorkoutStepType = 'warmup' | 'cooldown' | 'interval';

export interface WorkoutStep {
  type: WorkoutStepType;
  // warmup / cooldown
  duree_seconds?: number;
  label?: string;
  // interval
  work_seconds?: number;
  work_label?: string;
  iterations?: number;
  recovery_seconds?: number;
  recovery_label?: string;
}

export interface Seance {
  id: number;
  plan_id: number;
  titre: string;
  date: string;
  sport: string;
  duree_minutes: number;
  zone?: string;
  sections: SeanceSection[];
  distance_km?: number | null;
  allure_cible?: string | null;
  rpe_cible?: number | null;
  note?: string | null;
  couleur?: string | null;
  emoji?: string | null;
  completee: boolean;
  hk_workout_id?: string | null;
  workout_steps?: WorkoutStep[] | null;
  streak_increased?: boolean | null;
  plan_streak?: number | null;
  discovery_metric_id?: string | null;
}

import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Dashboard: undefined;
  Plan: { planId?: number };
  Chat: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Session: { seance: Seance; planCouleur?: string; planSport?: string | null };
  Generate: undefined;
  PlanManage: { plan: Plan };
  Profile: undefined;
  Stats: undefined;
  PlanStats: { planId?: number };
  PlanRefresh: { planId: number };
  WorkoutManager: undefined;
  StreakCelebration: { streakCount: number; planCouleur?: string; planId?: number };
  Recalibration: { metricId: string; planId: number; streakCount?: number; planCouleur?: string };
  PlanEnding: { planId: number; suggestedJours?: string[] };
  WeeklyCheckin: undefined;
};
