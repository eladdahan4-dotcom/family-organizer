// What a correct reading of each test message must contain. Each check returns a list of
// problems (empty = correct), so failures say in plain words what the AI missed.
import { iso } from "../../src/dates";
import type { Extracted } from "../../src/types";

/** Upcoming date(s) for a weekday (0=Sunday). If today is that day, today or next week both count. */
export function upcoming(dow: number, from = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i <= 7; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    if (d.getDay() === dow) out.push(iso(d));
  }
  return out;
}

const all = (r: Extracted) => [...r.tasks.map((t) => t.title), ...r.shopping.map((s) => s.name)].join(" | ");
const has = (r: Extracted, re: RegExp, ok: (t: Extracted["tasks"][0]) => boolean) => r.tasks.some((t) => re.test(t.title) && ok(t));

export function checkGan(r: Extracted, from = new Date()): string[] {
  const p: string[] = [];
  if (!has(r, /פיג/, (t) => upcoming(4, from).includes(t.date) && t.cat === "gan")) p.push("pyjama day on Thursday (kindergarten)");
  if (!has(r, /25/, (t) => upcoming(2, from).includes(t.date))) p.push("25 ₪ payment by Tuesday");
  if (!/מיץ/.test(all(r))) p.push("juice for the party");
  if (!/במבה/.test(all(r))) p.push("Bamba for the party");
  return p;
}

export function checkSchool(r: Extracted, from = new Date()): string[] {
  const p: string[] = [];
  if (!has(r, /סיור|בוטני|חולצה|כובע/, (t) => upcoming(3, from).includes(t.date) && t.cat === "school")) p.push("trip on Wednesday (school)");
  if (!has(r, /טופס|אישור/, (t) => upcoming(1, from).includes(t.date))) p.push("signed form back by Monday");
  if (!has(r, /אסיפ/, (t) => upcoming(0, from).includes(t.date) && t.time === "18:30")) p.push("parents' meeting Sunday 18:30");
  if (!has(r, /אסיפ/, (t) => t.kind === "event")) p.push("parents' meeting should be a meeting, not a task");
  if (!has(r, /טופס|אישור/, (t) => t.kind === "task")) p.push("returning the form should be a task");
  return p;
}

export function checkEnglish(r: Extracted, from = new Date()): string[] {
  return r.tasks.some((t) => upcoming(5, from).includes(t.date) && t.time === "16:00") ? [] : ["swimming Friday 16:00"];
}

export function checkNothing(r: Extracted): string[] {
  return r.tasks.length || r.shopping.length ? ["should find nothing to do"] : [];
}

export function checkShopping(r: Extracted): string[] {
  const names = r.shopping.map((s) => s.name).join(" ");
  return ["חלב", "לחם", "ביצים"].filter((w) => !names.includes(w)).map((w) => "shopping: " + w);
}

export function checkMeetingRange(r: Extracted, from = new Date()): string[] {
  const p: string[] = [];
  if (!has(r, /כדורגל|חוג/, (t) => t.kind === "event" && upcoming(1, from).includes(t.date) && t.time === "16:00" && t.endTime === "17:00"))
    p.push("football class Monday 16:00–17:00 as a meeting");
  if (!has(r, /כדורגל|חוג/, (t) => /מגרש/.test(t.location))) p.push("place: the town field");
  if (!/מים/.test([...r.tasks.map((t) => t.title), ...r.shopping.map((s) => s.name)].join(" "))) p.push("bring a water bottle");
  return p;
}
