import { Notification } from "scripting"
import { Cycle } from "../common/types"

export async function scheduleCycleEndNotification(cycle: Cycle): Promise<void> {
  const seconds = Math.max(1, Math.ceil((cycle.scheduled_end_ts - Date.now()) / 1000))
  await Notification.schedule({
    title: "胎动计数结束",
    body: "1 小时周期已结束，请查看结果",
    threadIdentifier: "tiny-kick-counter-cycle-end",
    userInfo: {
      type: "cycle_end",
      cycle_id: cycle.cycle_id,
    },
    trigger: new TimeIntervalNotificationTrigger({
      timeInterval: seconds,
      repeats: false,
    }),
  })
}

export async function cancelPendingCycleEndNotifications(): Promise<void> {
  await Notification.removeAllPendingsOfCurrentScript()
}
