/**
 * Real AI tests: the app's own extract() sends real messages and screenshots to Gemini
 * (the same model and endpoint the phone uses). Each answer is saved to ai-results.json
 * so a person can read exactly what the AI understood.
 */
import fs from "fs";
import path from "path";
import { extract } from "../../src/ai";
import { iso } from "../../src/dates";
import type { Extracted } from "../../src/types";

jest.retryTimes(2, { logErrorsBeforeRetry: true });

const results: Record<string, any> = {};
afterAll(() => {
  fs.writeFileSync(path.join(__dirname, "ai-results.json"), JSON.stringify(results, null, 2));
});

/** Upcoming date(s) for a weekday (0=Sunday). If today is that day, today or next week both count. */
function upcoming(dow: number): string[] {
  const out: string[] = [];
  for (let i = 0; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    if (d.getDay() === dow) out.push(iso(d));
  }
  return out;
}

const img = (f: string) => fs.readFileSync(path.join(__dirname, "../fixtures", f)).toString("base64");
const all = (r: Extracted) => [...r.tasks.map((t) => t.title), ...r.shopping.map((s) => s.name)].join(" | ");
const find = (r: Extracted, re: RegExp) => r.tasks.find((t) => re.test(t.title));

const GAN_TEXT =
  "רותי הגננת: הורים יקרים, ביום חמישי הקרוב יתקיים יום פיג'מות 🧸 הילדים מוזמנים להגיע בפיג'מה עם בובה אהובה.\n" +
  "נא להעביר 25 ₪ לטיול לחוות החיות עד יום שלישי.\n" +
  "תזכורת: ביום ראשון אין צהרון.\n" +
  "ועד הורים: למסיבת סוכות כל ילד מביא בקבוק מיץ ושקית במבה 🙏";

function checkGan(r: Extracted) {
  const pj = find(r, /פיג/);
  expect(pj).toBeDefined();
  expect(upcoming(4)).toContain(pj!.date); // Thursday
  expect(pj!.cat).toBe("gan");

  const pay = find(r, /25/);
  expect(pay).toBeDefined();
  expect(upcoming(2)).toContain(pay!.date); // deadline Tuesday

  // Juice and Bamba must be captured (as shopping or as things to bring).
  expect(all(r)).toMatch(/מיץ/);
  expect(all(r)).toMatch(/במבה/);
}

describe("real Gemini: kindergarten WhatsApp message", () => {
  test("from pasted text", async () => {
    const r = await extract(GAN_TEXT);
    results.ganText = r;
    checkGan(r);
  });

  test("from a WhatsApp screenshot (PNG)", async () => {
    const r = await extract("", { base64: img("whatsapp-gan.png"), mimeType: "image/png" });
    results.ganImage = r;
    checkGan(r);
  });
});

describe("real Gemini: printed school letter photo (JPEG)", () => {
  test("trip, signed form deadline and parents' meeting with time", async () => {
    const r = await extract("", { base64: img("school-notice.jpg"), mimeType: "image/jpeg" });
    results.schoolNotice = r;

    const trip = find(r, /סיור|גן הבוטני/);
    expect(trip).toBeDefined();
    expect(upcoming(3)).toContain(trip!.date); // Wednesday
    expect(trip!.cat).toBe("school");

    const form = find(r, /טופס|אישור/);
    expect(form).toBeDefined();
    expect(upcoming(1)).toContain(form!.date); // Monday

    const meeting = find(r, /אסיפ/);
    expect(meeting).toBeDefined();
    expect(upcoming(0)).toContain(meeting!.date); // Sunday
    expect(meeting!.time).toBe("18:30");
  });
});

describe("real Gemini: other kinds of messages", () => {
  test("English message with a time", async () => {
    const r = await extract("Reminder: swimming lesson this Friday at 16:00, please bring a towel and goggles.");
    results.english = r;
    const swim = r.tasks.find((t) => /שחי|swim/i.test(t.title)) || r.tasks[0];
    expect(swim).toBeDefined();
    expect(upcoming(5)).toContain(swim.date);
    expect(swim.time).toBe("16:00");
  });

  test("message with nothing to do returns nothing", async () => {
    const r = await extract("שבת שלום לכולם! 🌸 תודה על שבוע מקסים");
    results.nothing = r;
    expect(r.tasks).toHaveLength(0);
    expect(r.shopping).toHaveLength(0);
  });

  test("shopping list message goes to shopping", async () => {
    const r = await extract("תקנה בדרך: 2 חלב, לחם, ביצים");
    results.shopping = r;
    const names = r.shopping.map((s) => s.name).join(" ");
    expect(names).toMatch(/חלב/);
    expect(names).toMatch(/לחם/);
    expect(names).toMatch(/ביצים/);
  });
});
