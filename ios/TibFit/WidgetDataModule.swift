import Foundation
import WidgetKit

@objc(WidgetDataModule)
class WidgetDataModule: NSObject {

  @objc func setSessionData(_ json: String) {
    UserDefaults(suiteName: "group.com.tibfit.app")?.set(json, forKey: "widget_sessions")
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
