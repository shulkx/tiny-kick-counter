import { AppIntentManager, AppIntentProtocol, Widget } from "scripting"
import { closeCycle, recordMovement } from "./common/model"

export const RecordMovementIntent = AppIntentManager.register({
  name: "RecordMovement",
  protocol: AppIntentProtocol.AppIntent,
  perform: async () => {
    await recordMovement(Date.now(), "widget")
    Widget.reloadAll()
  },
})

export const CloseCycleIntent = AppIntentManager.register({
  name: "CloseCycle",
  protocol: AppIntentProtocol.AppIntent,
  perform: async () => {
    await closeCycle(Date.now(), "widget")
    Widget.reloadAll()
  },
})
