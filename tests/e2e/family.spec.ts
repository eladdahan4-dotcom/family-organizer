/**
 * Full end-to-end: two people (Elad and Shira) on two phones, using the real app,
 * the real security rules (emulator) and the real AI. Screenshots of every step are
 * saved to tests/e2e/shots for review.
 */
import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const SHOTS = path.join(__dirname, "shots");
fs.mkdirSync(SHOTS, { recursive: true });
let n = 0;
const shot = (p: Page, name: string) => p.screenshot({ path: path.join(SHOTS, `${String(++n).padStart(2, "0")}-${name}.png`), fullPage: true });

const EMU = "http://127.0.0.1:8080/v1/projects/demo-family/databases/(default)/documents";
async function stored(code: string, col: "tasks" | "shop") {
  const r = await fetch(`${EMU}/families/${code}/${col}`, { headers: { Authorization: "Bearer owner" } });
  const j: any = await r.json();
  return (j.documents || []).map((d: any) => {
    const f = d.fields || {};
    const v = (k: string) => f[k]?.stringValue;
    return { kind: v("kind"), title: v("title"), name: v("name"), cat: v("cat"), date: v("date"), time: v("time"), endTime: v("endTime"), location: v("location"), done: f.done?.booleanValue, source: v("source") };
  });
}

const GAN_TEXT =
  "רותי הגננת: הורים יקרים, ביום חמישי הקרוב יתקיים יום פיג'מות. נא להעביר 25 ₪ לטיול עד יום שלישי.\n" +
  "ועד הורים: למסיבת סוכות כל ילד מביא בקבוק מיץ ושקית במבה";

// Unless REAL_AI=1, answer AI requests with responses recorded from the real model,
// so routine test runs don't use up the family's small free daily AI quota.
const REAL_AI = process.env.REAL_AI === "1";
const rel = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const RECORDED_TEXT = {
  tasks: [
    { kind: "task", title: "פיג'מה ובובה אהובה לגן", date: rel(2), time: "", cat: "gan" },
    { kind: "task", title: "להעביר 25 ₪ לטיול לחוות החיות", date: rel(7), time: "", cat: "gan" },
  ],
  shopping: [{ name: "בקבוק מיץ", qty: "1" }, { name: "שקית במבה", qty: "1" }],
};
const RECORDED_IMAGE = {
  tasks: [
    { kind: "task", title: "חולצה לבנה וכובע לסיור בגן הבוטני", date: rel(1), time: "", cat: "school" },
    { kind: "task", title: "להחזיר טופס אישור חתום", date: rel(6), time: "", cat: "school" },
    { kind: "event", title: "אסיפת הורים בכיתה", date: rel(5), time: "18:30", endTime: "19:30", location: "בכיתה", cat: "school" },
  ],
  shopping: [],
};
async function useRecordedAi(p: Page) {
  if (REAL_AI) return;
  await p.route("**/firebasevertexai.googleapis.com/**", async (route) => {
    const hasImage = (route.request().postData() || "").includes("inlineData");
    const answer = hasImage ? RECORDED_IMAGE : RECORDED_TEXT;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }),
    });
  });
}

const tab = (p: Page, re: RegExp) => p.getByText(re).first().click();
const row = (p: Page, title: string | RegExp) =>
  p.getByText(title).first().locator('xpath=ancestor::div[.//*[@role="checkbox"]][1]');

test("two parents run the family board together", async ({ browser }) => {
  // ---------- Elad creates the board ----------
  const elad = await browser.newPage();
  await useRecordedAi(elad);
  const aiRequests: string[] = [];
  elad.on("request", (r) => r.url().includes("firebasevertexai") && aiRequests.push(r.postData() || ""));
  // Keep the AI's raw answers in the log, to diagnose any misreading.
  elad.on("response", async (r) => {
    if (!r.url().includes("firebasevertexai")) return;
    try {
      console.log("AI RESPONSE " + r.status() + " " + (await r.text()).slice(0, 1500).replace(/\s+/g, " "));
    } catch {}
  });
  await elad.goto("/");
  await expect(elad.getByText("ברוכים הבאים ללוח המשפחה", { exact: true })).toBeVisible();
  await shot(elad, "welcome");
  await elad.getByPlaceholder("למשל: אלעד").fill("אלעד");
  await elad.getByText("יצירת לוח חדש למשפחה", { exact: true }).click();
  await expect(elad.getByText("עוד אין משימות", { exact: true })).toBeVisible();

  // Family code from the settings screen.
  await tab(elad, /^הגדרות/);
  const codeText = (await elad.getByText(/^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/).textContent())!;
  const CODE = codeText.replace(/-/g, "");
  await shot(elad, "settings-code");

  // ---------- Manual task ----------
  await tab(elad, /^משימות/);
  await elad.getByPlaceholder("משימה חדשה, למשל: להביא 20 ₪ לטיול").fill("לקנות מתנה ליום הולדת");
  await elad.getByText("מחר", { exact: true }).click();
  await elad.getByText("הוספה", { exact: true }).click();
  await expect(elad.getByText("לקנות מתנה ליום הולדת")).toBeVisible();
  await expect(elad.getByText(/^מחר 1/)).toBeVisible();
  await shot(elad, "manual-task");
  expect(await stored(CODE, "tasks")).toEqual([expect.objectContaining({ title: "לקנות מתנה ליום הולדת", cat: "home", done: false })]);

  // ---------- Manual meeting ----------
  await elad.getByText("📅 פגישה", { exact: true }).click();
  await elad.getByPlaceholder("פגישה חדשה, למשל: אסיפת הורים").fill("רופא ילדים");
  await elad.getByText("מחר", { exact: true }).click();
  await elad.getByPlaceholder("משעה 18:00").fill("17:00");
  await elad.getByPlaceholder("עד 19:30").fill("17:30");
  await elad.getByPlaceholder("מקום, למשל: בכיתה").fill("מרפאה");
  await elad.getByText("הוספה", { exact: true }).click();
  await expect(elad.getByText("17:00–17:30")).toBeVisible();
  await shot(elad, "manual-meeting");
  expect((await stored(CODE, "tasks")).find((t: any) => t.title === "רופא ילדים")).toMatchObject({
    kind: "event",
    date: rel(1),
    time: "17:00",
    endTime: "17:30",
    location: "מרפאה",
  });

  // ---------- Shopping ----------
  await tab(elad, /^קניות/);
  await elad.getByPlaceholder("מה צריך לקנות? למשל: חלב 3%").fill("חלב 3%");
  await elad.getByPlaceholder("כמות").fill("2");
  await elad.getByText("הוספה", { exact: true }).click();
  await expect(elad.getByText("חלב 3%")).toBeVisible();
  expect((await stored(CODE, "shop")).map((s: any) => s.name)).toEqual(["חלב 3%"]);
  await shot(elad, "shopping");

  // ---------- Pasted WhatsApp text → real AI ----------
  await tab(elad, /^\+ הודעה/);
  await elad.getByPlaceholder(/^לדוגמה: הורים יקרים/).fill(GAN_TEXT);
  await elad.getByText("חילוץ משימות", { exact: true }).click();
  await expect(elad.getByText("הוספה ללוח", { exact: true })).toBeVisible({ timeout: 90_000 });
  await shot(elad, "text-preview");
  // Fix what the AI understood before saving.
  await elad.getByRole("button").filter({ hasText: /25 ₪/ }).first().click(); // the preview item, not the message box
  await expect(elad.getByText("תיקון לפני הוספה", { exact: true })).toBeVisible();
  await elad.getByPlaceholder("משימה חדשה, למשל: להביא 20 ₪ לטיול").fill("להעביר 30 ₪ לטיול");
  await elad.getByText("עדכון", { exact: true }).click();
  await expect(elad.getByText("להעביר 30 ₪ לטיול", { exact: true })).toBeVisible();
  await shot(elad, "text-preview-fixed");
  await elad.getByText("הוספה ללוח", { exact: true }).click();
  await expect(elad.getByText(/פיג/).first()).toBeVisible();
  await shot(elad, "text-saved");
  const afterText = await stored(CODE, "tasks");
  expect(afterText.some((t: any) => /פיג/.test(t.title) && t.cat === "gan" && t.source === "message")).toBe(true);
  expect(afterText.some((t: any) => t.title === "להעביר 30 ₪ לטיול")).toBe(true);
  expect(afterText.some((t: any) => /25 ₪/.test(t.title))).toBe(false);

  // ---------- Photo of a school letter → real AI ----------
  await tab(elad, /^\+ הודעה/);
  const chooser = elad.waitForEvent("filechooser");
  await elad.getByText("📷 תמונה מהגלריה", { exact: true }).click();
  await (await chooser).setFiles(path.join(__dirname, "../fixtures/school-notice.jpg"));
  await expect(elad.getByText("הסרת התמונה", { exact: true })).toBeVisible();
  await elad.getByText("חילוץ משימות", { exact: true }).click();
  await expect(elad.getByText("הוספה ללוח", { exact: true })).toBeVisible({ timeout: 90_000 });
  await shot(elad, "image-preview");
  // The photo really was sent to the AI as an image.
  expect(aiRequests.some((b) => b.includes('"inlineData"') && b.includes("image/jpeg"))).toBe(true);
  await elad.getByText("הוספה ללוח", { exact: true }).click();
  await expect(elad.getByText(/אסיפ/).first()).toBeVisible();
  await shot(elad, "image-saved");
  const afterImage = await stored(CODE, "tasks");
  expect(afterImage.some((t: any) => /אסיפ/.test(t.title) && t.cat === "school")).toBe(true);
  expect(afterImage.some((t: any) => /סיור|בוטני|חולצה/.test(t.title))).toBe(true);
  expect(afterImage.find((t: any) => /אסיפ/.test(t.title))).toMatchObject({ kind: "event", time: "18:30" });

  // ---------- Calendar: the meeting is on its day; edit it there ----------
  await tab(elad, /^יומן/);
  if (rel(1).slice(5, 7) !== rel(0).slice(5, 7)) await elad.getByLabel("החודש הבא").click();
  await elad.getByTestId("day-" + rel(1)).click();
  await expect(elad.getByText("רופא ילדים", { exact: true })).toBeVisible();
  await shot(elad, "calendar");
  await elad.getByText("רופא ילדים", { exact: true }).click();
  await expect(elad.getByText("עריכה", { exact: true })).toBeVisible();
  await elad.getByPlaceholder("משעה 18:00").fill("16:30");
  await elad.getByText("שמירת השינויים", { exact: true }).click();
  await expect(elad.getByText("16:30–17:30")).toBeVisible();
  await shot(elad, "calendar-edited");
  expect((await stored(CODE, "tasks")).find((t: any) => t.title === "רופא ילדים")).toMatchObject({ time: "16:30", endTime: "17:30" });

  // ---------- Shira joins from the invite link ----------
  const shira = await browser.newPage();
  await shira.goto("/?family=" + CODE);
  await shira.getByPlaceholder("למשל: אלעד").fill("שירה");
  await shira.getByText("הצטרפות", { exact: true }).click();
  await expect(shira.getByText("לקנות מתנה ליום הולדת")).toBeVisible();
  await expect(shira.getByText(/פיג/).first()).toBeVisible();
  await shot(shira, "shira-joined");

  // Elad sees Shira as a member.
  await tab(elad, /^הגדרות/);
  await expect(elad.getByText("אלעד, שירה")).toBeVisible();

  // ---------- Shira ticks a task; Elad sees it live ----------
  await row(shira, "לקנות מתנה ליום הולדת").getByRole("checkbox").click();
  await tab(elad, /^משימות/);
  await expect(elad.getByText(/בוצעו \(1\)/)).toBeVisible();
  await shot(elad, "elad-sees-done");
  expect((await stored(CODE, "tasks")).find((t: any) => t.title === "לקנות מתנה ליום הולדת").done).toBe(true);

  // ---------- Shira ticks the milk in the supermarket; Elad clears it ----------
  await tab(shira, /^קניות/);
  await row(shira, "חלב 3%").getByRole("checkbox").click();
  await tab(elad, /^קניות/);
  await expect(elad.getByText("ניקוי מה שנקנה", { exact: true })).toBeVisible();
  await elad.getByText("ניקוי מה שנקנה", { exact: true }).click();
  await expect(shira.getByText("חלב 3%")).toHaveCount(0);
  await shot(shira, "shira-milk-cleared");
  expect((await stored(CODE, "shop")).map((s: any) => s.name)).not.toContain("חלב 3%");
});
