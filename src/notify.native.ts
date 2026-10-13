import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { parseIso } from "./dates";
import type { Task } from "./types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let ready: Promise<boolean> | null = null;

function ensure(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("reminders", {
          name: "תזכורות",
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      const cur = await Notifications.getPermissionsAsync();
      if (cur.granted) return true;
      const req = await Notifications.requestPermissionsAsync();
      return req.granted;
    })().catch(() => false);
  }
  return ready;
}

/** When to remind: 1 hour before a set time, otherwise 07:30 on the day. */
function whenFor(t: Task): Date | null {
  if (!t.date || t.done) return null;
  const d = parseIso(t.date);
  if (t.time) {
    const [h, m] = t.time.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    d.setMinutes(d.getMinutes() - 60);
  } else {
    d.setHours(7, 30, 0, 0);
  }
  return d.getTime() > Date.now() + 60_000 ? d : null;
}

let timer: any = null;

/** Re-schedules local reminders for all open tasks with a date (debounced). */
export function syncReminders(tasks: Task[]) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (!(await ensure())) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const upcoming = tasks
      .map((t) => ({ t, at: whenFor(t) }))
      .filter((x) => x.at)
      .sort((a, b) => a.at!.getTime() - b.at!.getTime())
      .slice(0, 50);
    for (const { t, at } of upcoming) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: (t.kind === "event" ? "📅 " : "") + (t.time ? "בעוד שעה: " : "היום: ") + t.title,
          body: [t.time ? "בשעה " + t.time : "תזכורת מלוח המשפחה", t.location ? "📍 " + t.location : ""].filter(Boolean).join(" · "),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at!,
          channelId: "reminders",
        },
      });
    }
  }, 1500);
}
