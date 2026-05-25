import Foundation
import WorkoutKit
import HealthKit

typealias RCTPromiseResolveBlock = (Any?) -> Void
typealias RCTPromiseRejectBlock  = (String?, String?, Error?) -> Void

@objc(TibFitWorkoutKit)
class TibFitWorkoutKit: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @available(iOS 17.0, *)
  private static var storedWorkouts: [String: WorkoutPlan] = [:]
  @available(iOS 17.0, *)
  private static var storedScheduledDates: [String: DateComponents] = [:]

  // MARK: - Authorization

  @objc(getAuthorizationState:reject:)
  func getAuthorizationState(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 17.0, *) else {
      resolve("unavailable")
      return
    }
    Task {
      let state = await WorkoutScheduler.shared.authorizationState
      switch state {
      case .notDetermined: resolve("notDetermined")
      case .authorized:    resolve("authorized")
      case .denied:        resolve("denied")
      @unknown default:    resolve("unknown")
      }
    }
  }

  // MARK: - Schedule

  @objc(scheduleWorkout:resolve:reject:)
  func scheduleWorkout(_ config: NSDictionary, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 17.0, *) else {
      reject("UNAVAILABLE", "WorkoutKit requires iOS 17+", nil as Error?)
      return
    }
    guard let displayName    = config["displayName"]  as? String,
          let activityTypeStr = config["activityType"] as? String,
          let sectionsData   = config["sections"]      as? [[String: Any]] else {
      reject("INVALID_PARAMS", "Missing displayName, activityType or sections", nil as Error?)
      return
    }

    let dateISO      = config["dateISO"] as? String
    let scheduledAt  = scheduledDateComponents(from: dateISO)
    let activityType = mapActivityType(activityTypeStr)

    NSLog("[WorkoutKit] ── scheduleWorkout ──────────────────────")
    NSLog("[WorkoutKit] displayName  : %@", displayName)
    NSLog("[WorkoutKit] activityType : %@ → rawValue %lu", activityTypeStr, activityType.rawValue)
    NSLog("[WorkoutKit] dateISO      : %@", dateISO ?? "nil → now+5min")

    Task {
      let authState = await WorkoutScheduler.shared.authorizationState
      NSLog("[WorkoutKit] authorizationState avant schedule : %lu", authState.rawValue)

      if authState == .notDetermined {
        NSLog("[WorkoutKit] Demande d'autorisation WorkoutKit…")
        _ = await WorkoutScheduler.shared.requestAuthorization()
      }

      let currentState = await WorkoutScheduler.shared.authorizationState
      guard currentState == .authorized else {
        NSLog("[WorkoutKit] Autorisation refusée (state=%lu)", currentState.rawValue)
        reject("NOT_AUTHORIZED", "WorkoutKit authorization denied", nil as Error?)
        return
      }

      guard CustomWorkout.supportsActivity(activityType) else {
        NSLog("[WorkoutKit] Activité non supportée par CustomWorkout : %lu", activityType.rawValue)
        reject("UNSUPPORTED_ACTIVITY", "unsupported_activity", nil as Error?)
        return
      }

      let workout = buildCustomWorkout(
        displayName:  displayName,
        activityType: activityType,
        sections:     sectionsData
      )
      NSLog("[WorkoutKit] CustomWorkout construit — warmup=%@ cooldown=%@ intervalBlocks=%d",
            workout.warmup != nil ? "oui" : "non",
            workout.cooldown != nil ? "oui" : "non",
            workout.blocks.count)
      let plan = WorkoutPlan(.custom(workout))
      NSLog("[WorkoutKit] Appel WorkoutScheduler.shared.schedule…")
      await WorkoutScheduler.shared.schedule(plan, at: scheduledAt)
      NSLog("[WorkoutKit] schedule() terminé — plan_id: %@", plan.id.uuidString)

      let key = plan.id.uuidString
      TibFitWorkoutKit.storedWorkouts[key] = plan
      TibFitWorkoutKit.storedScheduledDates[key] = scheduledAt
      resolve(["id": key, "success": true])
    }
  }

  // MARK: - List

  @objc(listWorkouts:reject:)
  func listWorkouts(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 17.0, *) else {
      resolve([])
      return
    }
    Task {
      let scheduled = await WorkoutScheduler.shared.scheduledWorkouts
      let result: [[String: Any]] = scheduled.map { s in
        let plan = s.plan
        let dc   = s.date
        var dateStr = ""
        if let y = dc.year, let m = dc.month, let d = dc.day {
          dateStr = String(format: "%04d-%02d-%02d", y, m, d)
        }
        var displayName = ""
        if case .custom(let workout) = plan.workout {
          displayName = workout.displayName ?? ""
        }
        return ["id": plan.id.uuidString, "displayName": displayName, "date": dateStr]
      }
      resolve(result)
    }
  }

  // MARK: - Remove

  @objc(removeWorkout:resolve:reject:)
  func removeWorkout(_ workoutId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 17.0, *) else {
      reject("UNAVAILABLE", "WorkoutKit requires iOS 17+", nil as Error?)
      return
    }
    Task {
      let scheduled = await WorkoutScheduler.shared.scheduledWorkouts
      guard let match = scheduled.first(where: { $0.plan.id.uuidString == workoutId }) else {
        resolve(["success": false, "reason": "Plan not found"])
        return
      }
      await WorkoutScheduler.shared.remove(match.plan, at: match.date)
      TibFitWorkoutKit.storedWorkouts[workoutId] = nil
      TibFitWorkoutKit.storedScheduledDates[workoutId] = nil
      resolve(["success": true])
    }
  }

  // MARK: - Private helpers

  private func scheduledDateComponents(from iso: String?) -> DateComponents {
    let cal = Calendar.current
    if let iso = iso {
      let formatter = DateFormatter()
      formatter.dateFormat = "yyyy-MM-dd"
      formatter.timeZone = TimeZone.current
      if let date = formatter.date(from: iso) {
        var dc = cal.dateComponents([.year, .month, .day], from: date)
        dc.hour = 9; dc.minute = 0
        return dc
      }
    }
    let soon = Date().addingTimeInterval(5 * 60)
    return cal.dateComponents([.year, .month, .day, .hour, .minute], from: soon)
  }

  @available(iOS 17.0, *)
  private func mapActivityType(_ sport: String) -> HKWorkoutActivityType {
    let s = sport.lowercased()
    if s.contains("running") || s.contains("course") || s.contains("trail") { return .running }
    if s.contains("cycl") || s.contains("vélo") || s.contains("bike")       { return .cycling }
    if s.contains("swim") || s.contains("natation")                          { return .swimming }
    if s.contains("triathlon")                                                { return .swimBikeRun }
    return .other
  }

  @available(iOS 17.0, *)
  private func makeStep(seconds: Int, label: String? = nil) -> WorkoutStep {
    let duration = Double(max(seconds, 1))
    if #available(iOS 18.0, *), let label = label {
      return WorkoutStep(goal: .time(duration, .seconds), displayName: label)
    }
    return WorkoutStep(goal: .time(duration, .seconds))
  }

  @available(iOS 17.0, *)
  private func buildCustomWorkout(
    displayName: String,
    activityType: HKWorkoutActivityType,
    sections: [[String: Any]]
  ) -> CustomWorkout {
    var warmupStep:     WorkoutStep?    = nil
    var cooldownStep:   WorkoutStep?    = nil
    var intervalBlocks: [IntervalBlock] = []

    for section in sections {
      guard let titre        = section["titre"] as? String,
            let dureeSeconds = section["duree_seconds"] as? Int,
            dureeSeconds > 0 else { continue }

      let iterations   = max((section["iterations"] as? Int) ?? 1, 1)
      let workSecs     = (section["work_seconds"]     as? Int).flatMap { $0 > 0 ? $0 : nil }
      let recoverySecs = (section["recovery_seconds"] as? Int).flatMap { $0 > 0 ? $0 : nil }
      let stepType     = section["step_type"] as? String ?? "interval"

      if stepType == "warmup" {
        warmupStep = makeStep(seconds: dureeSeconds, label: titre)
      } else if stepType == "cooldown" {
        cooldownStep = makeStep(seconds: dureeSeconds, label: titre)
      } else if let ws = workSecs, let rs = recoverySecs {
        let workStep     = IntervalStep(.work, step: makeStep(seconds: ws))
        let recoveryStep = IntervalStep(.recovery, step: makeStep(seconds: rs))
        NSLog("[WorkoutKit]   bloc work/recovery — work=%ds recovery=%ds x%d", ws, rs, iterations)
        intervalBlocks.append(IntervalBlock(steps: [workStep, recoveryStep], iterations: iterations))
      } else {
        let stepSecs = max(dureeSeconds / iterations, 1)
        let workStep = IntervalStep(.work, step: makeStep(seconds: stepSecs, label: titre))
        NSLog("[WorkoutKit]   bloc work seul — %ds x%d", stepSecs, iterations)
        intervalBlocks.append(IntervalBlock(steps: [workStep], iterations: iterations))
      }
    }

    return CustomWorkout(
      activity:    activityType,
      location:    .unknown,
      displayName: displayName,
      warmup:      warmupStep,
      blocks:      intervalBlocks,
      cooldown:    cooldownStep
    )
  }
}
