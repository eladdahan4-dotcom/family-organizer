// Logic shared by the list, the calendar, the add form and the edit window.
import { dayDiff, iso, parseUserDate, isTime, isIsoDate } from "./dates";
import { kindOf, type Cat, type Kind, type Task } from "./types";

/** What the form holds while someone is typing. */
export type Draft = {
  kind: Kind;
  title: string;
  date: string; // what was typed ("15.10") or YYYY-MM-DD from a chip
  time: string;
  endTime: string;
  location: string;
  cat: Cat;
  who: string;
};

export function emptyDraft(me: string, over: Partial<Draft> = {}): Draft {
  return { kind: "task", title: "", date: "", time: "", endTime: "", location: "", cat: "home", who: me, ...over };
}

export function draftFrom(t: Task): Draft {
  return {
    kind: kindOf(t),
    title: t.title,
    date: t.date,
    time: t.time || "",
    endTime: t.endTime || "",
    location: t.location || "",
    cat: t.cat,
    who: t.who || "",
  };
}

export type Checked = { ok: true; fields: Omit<Task, "id" | "done" | "createdBy" | "createdAt"> } | { ok: false; msg: string };

/** Turns a draft into fields to save, or explains in plain words what to fix. */
export function checkDraft(d: Draft): Checked {
  const title = d.title.trim();
  if (!title) return { ok: false, msg: "כתבו מה צריך לעשות או מה הפגישה." };
  const date = parseUserDate(d.date);
  if (d.date.trim() && !date) return { ok: false, msg: "לא הבנתי את התאריך. כתבו למשל 15.10" };
  const time = d.time.trim();
  if (time && !isTime(time)) return { ok: false, msg: "כתבו שעה כמו 08:30" };
  const isEvent = d.kind === "event";
  if (isEvent && !date) return { ok: false, msg: "לפגישה צריך תאריך." };
  const endTime = isEvent ? d.endTime.trim() : "";
  if (endTime && !isTime(endTime)) return { ok: false, msg: "כתבו שעת סיום כמו 19:30" };
  if (endTime && !time) return { ok: false, msg: "כתבו קודם שעת התחלה." };
  if (endTime && endTime <= time) return { ok: false, msg: "שעת הסיום צריכה להיות אחרי שעת ההתחלה." };
  return {
    ok: true,
    fields: {
      kind: d.kind,
      title,
      date,
      time,
      endTime,
      location: isEvent ? d.location.trim() : "",
      cat: d.cat,
      who: d.who,
    },
  };
}

/** A meeting whose day has passed: shown under "עברו", never as late. */
export const isPastEvent = (t: Task) => kindOf(t) === "event" && !!t.date && dayDiff(t.date) < 0;

/** Order inside a day/group: by date, then meetings and timed items by time, then creation. */
export function byWhen(a: Task, b: Task) {
  return (
    (a.date || "9").localeCompare(b.date || "9") ||
    (a.time || "99").localeCompare(b.time || "99") ||
    (a.createdAt || 0) - (b.createdAt || 0)
  );
}

export function timeLabel(t: Pick<Task, "time" | "endTime">) {
  if (!t.time) return "";
  return t.endTime ? t.time + "–" + t.endTime : t.time;
}

/** Items on one day, for the calendar. */
export function itemsOn(tasks: Task[], day: string) {
  return tasks.filter((t) => t.date === day).sort(byWhen);
}

/** Month grid starting on Sunday: weeks of 7 cells, null = outside the month. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= days; d++) cells.push(iso(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const isDay = (s: string) => isIsoDate(s);
