import { checkDraft, emptyDraft, draftFrom, isPastEvent, itemsOn, monthGrid, timeLabel, byWhen } from "../../src/items";
import { iso, parseUserDate } from "../../src/dates";
import type { Task } from "../../src/types";

const day = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const T = (p: Partial<Task>): Task => ({ id: Math.random().toString(), title: "x", date: "", time: "", cat: "home", who: "", done: false, createdBy: "", createdAt: 0, ...p });

describe("checking what was typed in the form", () => {
  const d = (p: any) => checkDraft(emptyDraft("אלעד", p));

  test("a simple task", () => {
    expect(d({ title: " לחתום ", date: "15.10" })).toEqual({
      ok: true,
      fields: { kind: "task", title: "לחתום", date: parseUserDate("15.10"), time: "", endTime: "", location: "", cat: "home", who: "אלעד" },
    });
  });

  test("a meeting with start, end and place", () => {
    const r = d({ kind: "event", title: "אסיפה", date: day(3), time: "18:30", endTime: "19:30", location: " בכיתה " });
    expect(r).toMatchObject({ ok: true, fields: { kind: "event", time: "18:30", endTime: "19:30", location: "בכיתה" } });
  });

  test("tasks never keep meeting-only fields", () => {
    const r = d({ kind: "task", title: "x", time: "10:00", endTime: "11:00", location: "בבית" });
    expect(r).toMatchObject({ ok: true, fields: { endTime: "", location: "" } });
  });

  test.each([
    [{ title: "" }, "כתבו מה צריך לעשות או מה הפגישה."],
    [{ title: "x", date: "מחרתיים" }, "לא הבנתי את התאריך. כתבו למשל 15.10"],
    [{ title: "x", time: "8" }, "כתבו שעה כמו 08:30"],
    [{ kind: "event", title: "x" }, "לפגישה צריך תאריך."],
    [{ kind: "event", title: "x", date: "15.10", endTime: "9" }, "כתבו שעת סיום כמו 19:30"],
    [{ kind: "event", title: "x", date: "15.10", endTime: "19:00" }, "כתבו קודם שעת התחלה."],
    [{ kind: "event", title: "x", date: "15.10", time: "19:00", endTime: "18:00" }, "שעת הסיום צריכה להיות אחרי שעת ההתחלה."],
  ])("refuses %j", (p, msg) => {
    expect(d(p)).toEqual({ ok: false, msg });
  });

  test("editing starts from the saved values", () => {
    const t = T({ kind: "event", title: "חוג", date: "2026-10-20", time: "16:00", endTime: "17:00", location: "מתנ״ס", cat: "other", who: "both" });
    expect(draftFrom(t)).toEqual({ kind: "event", title: "חוג", date: "2026-10-20", time: "16:00", endTime: "17:00", location: "מתנ״ס", cat: "other", who: "both" });
    expect(draftFrom(T({ title: "ישן" })).kind).toBe("task"); // items saved before meetings existed
  });
});

describe("meetings over time", () => {
  test("a meeting whose day passed is 'past', a task is not", () => {
    expect(isPastEvent(T({ kind: "event", date: day(-1) }))).toBe(true);
    expect(isPastEvent(T({ kind: "event", date: day(0) }))).toBe(false);
    expect(isPastEvent(T({ kind: "task", date: day(-1) }))).toBe(false);
  });

  test("time label shows the range", () => {
    expect(timeLabel({ time: "18:00", endTime: "19:30" })).toBe("18:00–19:30");
    expect(timeLabel({ time: "18:00", endTime: "" })).toBe("18:00");
    expect(timeLabel({ time: "", endTime: "" })).toBe("");
  });

  test("a day's items are ordered by time, untimed last", () => {
    const items = [
      T({ title: "בלי שעה", date: day(1), createdAt: 1 }),
      T({ title: "ערב", date: day(1), time: "19:00" }),
      T({ title: "בוקר", date: day(1), time: "08:00" }),
      T({ title: "יום אחר", date: day(2), time: "07:00" }),
    ];
    expect(itemsOn(items, day(1)).map((t) => t.title)).toEqual(["בוקר", "ערב", "בלי שעה"]);
    expect([...items].sort(byWhen).map((t) => t.title)).toEqual(["בוקר", "ערב", "בלי שעה", "יום אחר"]);
  });
});

describe("month grid", () => {
  test("October 2026 starts on Thursday and has 31 days", () => {
    const g = monthGrid(2026, 9);
    expect(g[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    const flat = g.flat().filter(Boolean);
    expect(flat).toHaveLength(31);
    expect(flat[30]).toBe("2026-10-31");
    expect(g.every((w) => w.length === 7)).toBe(true);
  });

  test("February in a leap year", () => {
    expect(monthGrid(2028, 1).flat().filter(Boolean)).toHaveLength(29);
  });
});
