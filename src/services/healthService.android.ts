// Façade Android — délègue vers Health Connect
export {
  isHealthConnectAvailable as isHealthDataAvailable,
  isAuthorized,
  canReadWorkoutMetrics,
  requestPermissions,
  openHealthSettings,
  readWorkoutMetrics,
  readFitnessMetrics,
  saveWorkout,
} from './healthConnect';

export type { WorkoutMetrics, FitnessMetrics } from './healthConnect';
