export const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DL = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

const pad = (n: number) => String(n).padStart(2, "0");

export function iso(d: Date): string {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dayDiff(s: string): number {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((parseIso(s).getTime() - t.getTime()) / 864e5);
}

export function fmtDate(s: string): string {
  const d = parseIso(s);
  return "יום " + DL[d.getDay()] + " " + d.getDate() + "." + (d.getMonth() + 1);
}

export function todayLabel(): string {
  const n = new Date();
  return "יום " + DAYS[n.getDay()] + ", " + n.getDate() + "." + (n.getMonth() + 1) + "." + n.getFullYear();
}

export function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || "");
}

export function isTime(s: string) {
  return /^\d{2}:\d{2}$/.test(s || "");
}

/** Accepts "15.10", "15/10/2026", "2026-10-15"; returns YYYY-MM-DD or "". */
export function parseUserDate(s: string): string {
  const t = (s || "").trim();
  if (!t) return "";
  if (isIsoDate(t)) return t;
  const m = t.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (!m) return "";
  const now = new Date();
  let y = m[3] ? Number(m[3]) : now.getFullYear();
  if (y < 100) y += 2000;
  const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
  if (!m[3] && d.getTime() < now.getTime() - 60 * 864e5) d.setFullYear(y + 1);
  return iso(d);
}
