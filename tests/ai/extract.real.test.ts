/**
 * Real AI tests: the app's own extract() sends real messages and screenshots to Gemini
 * (the same model and endpoint the phone uses). Each answer is saved to ai-results.json
 * so a person can read exactly what the AI understood.
 */
import fs from "fs";
import path from "path";
import { extract as realExtract, AiError } from "../../src/ai";
import { checkGan, checkSchool, checkEnglish, checkNothing, checkShopping } from "./checks";

jest.retryTimes(2, { logErrorsBeforeRetry: true });

// The free Gemini tier allows only a few requests per minute: space the calls out and,
// if the limit is hit anyway, wait and try again (the app itself shows a "try again" message).
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function extract(...args: Parameters<typeof realExtract>) {
  for (let attempt = 0; ; attempt++) {
    await sleep(8000);
    try {
      return await realExtract(...args);
    } catch (e) {
      if (e instanceof AiError && e.kind === "quota" && attempt < 4) {
        await sleep(30000);
        continue;
      }
      throw e;
    }
  }
}

const results: Record<string, any> = {};
afterAll(() => {
  fs.writeFileSync(path.join(__dirname, "ai-results.json"), JSON.stringify(results, null, 2));
});

const img = (f: string) => fs.readFileSync(path.join(__dirname, "../fixtures", f)).toString("base64");

const GAN_TEXT =
  "רותי הגננת: הורים יקרים, ביום חמישי הקרוב יתקיים יום פיג'מות 🧸 הילדים מוזמנים להגיע בפיג'מה עם בובה אהובה.\n" +
  "נא להעביר 25 ₪ לטיול לחוות החיות עד יום שלישי.\n" +
  "תזכורת: ביום ראשון אין צהרון.\n" +
  "ועד הורים: למסיבת סוכות כל ילד מביא בקבוק מיץ ושקית במבה 🙏";

describe("real Gemini: kindergarten WhatsApp message", () => {
  test("from pasted text", async () => {
    const r = await extract(GAN_TEXT);
    results.ganText = r;
    expect(checkGan(r)).toEqual([]);
  });

  test("from a WhatsApp screenshot (PNG)", async () => {
    const r = await extract("", { base64: img("whatsapp-gan.png"), mimeType: "image/png" });
    results.ganImage = r;
    expect(checkGan(r)).toEqual([]);
  });
});

describe("real Gemini: printed school letter photo (JPEG)", () => {
  test("trip, signed form deadline and parents' meeting with time", async () => {
    const r = await extract("", { base64: img("school-notice.jpg"), mimeType: "image/jpeg" });
    results.schoolNotice = r;
    expect(checkSchool(r)).toEqual([]);
  });
});

describe("real Gemini: other kinds of messages", () => {
  test("English message with a time", async () => {
    const r = await extract("Reminder: swimming lesson this Friday at 16:00, please bring a towel and goggles.");
    results.english = r;
    expect(checkEnglish(r)).toEqual([]);
  });

  test("message with nothing to do returns nothing", async () => {
    const r = await extract("שבת שלום לכולם! 🌸 תודה על שבוע מקסים");
    results.nothing = r;
    expect(checkNothing(r)).toEqual([]);
  });

  test("shopping list message goes to shopping", async () => {
    const r = await extract("תקנה בדרך: 2 חלב, לחם, ביצים");
    results.shopping = r;
    expect(checkShopping(r)).toEqual([]);
  });
});
