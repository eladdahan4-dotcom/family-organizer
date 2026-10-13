import * as Notifications from "expo-notifications";
import { iso } from "../../src/dates";
import type { Task } from "../../src/types";

const day = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const task = (p: Partial<Task>): Task => ({
  id: Math.random().toString(),
  title: "t",
  date: "",
  time: "",
  cat: "home",
  who: "",
  done: false,
  createdBy: "",
  createdAt: 0,
  ...p,
});

function load() {
  let mod: typeof import("../../src/notify.native");
  jest.isolateModules(() => {
    mod = jest.requireActual("../../src/notify.native");
  });
  return mod!;
}

async function run(tasks: Task[]) {
  jest.useFakeTimers();
  const { syncReminders } = load();
  syncReminders(tasks);
  await jest.advanceTimersByTimeAsync(2000);
  jest.useRealTimers();
}

const scheduled = () =>
  (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map((c) => ({
    title: c[0].content.title,
    at: c[0].trigger.date as Date,
    channel: c[0].trigger.channelId,
  }));

beforeEach(() => jest.clearAllMocks());

describe("reminders on the phone", () => {
  test("task with a time: reminder one hour before", async () => {
    await run([task({ title: "חוג", date: day(1), time: "17:00" })]);
    const [r] = scheduled();
    expect(r.title).toBe("בעוד שעה: חוג");
    expect(iso(r.at)).toBe(day(1));
    expect([r.at.getHours(), r.at.getMinutes()]).toEqual([16, 0]);
    expect(r.channel).toBe("reminders");
  });

  test("task without a time: reminder at 07:30 that morning", async () => {
    await run([task({ title: "יום פיג׳מות", date: day(2) })]);
    const [r] = scheduled();
    expect(r.title).toBe("היום: יום פיג׳מות");
    expect(iso(r.at)).toBe(day(2));
    expect([r.at.getHours(), r.at.getMinutes()]).toEqual([7, 30]);
  });

  test("no reminders for done, past or undated tasks", async () => {
    await run([task({ date: day(1), done: true }), task({ date: day(-1) }), task({ date: "" })]);
    expect(scheduled()).toHaveLength(0);
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  });

  test("old reminders are cleared before scheduling, nearest first", async () => {
    await run([task({ title: "רחוק", date: day(9) }), task({ title: "קרוב", date: day(1) })]);
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(scheduled().map((s) => s.title)).toEqual(["היום: קרוב", "היום: רחוק"]);
  });

  test("rapid changes are combined into one update", async () => {
    jest.useFakeTimers();
    const { syncReminders } = load();
    syncReminders([task({ date: day(1) })]);
    syncReminders([task({ date: day(1) }), task({ date: day(2) })]);
    await jest.advanceTimersByTimeAsync(2000);
    jest.useRealTimers();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(scheduled()).toHaveLength(2);
  });

  test("if notifications are not allowed nothing is scheduled", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    await run([task({ date: day(1) })]);
    expect(scheduled()).toHaveLength(0);
  });
});
