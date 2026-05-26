// Façade iOS — délègue vers HealthKit
export {
  isHealthKitAvailable as isHealthDataAvailable,
  isAuthorized,
  canReadWorkoutMetrics,
  requestPermissions,
  openHealthSettings,
  readWorkoutMetrics,
  readFitnessMetrics,
  saveWorkout,
} from './healthKit';

export type { WorkoutMetrics, FitnessMetrics } from './healthKit';
