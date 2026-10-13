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
    return { title: f.title?.stringValue, name: f.name?.stringValue, cat: f.cat?.stringValue, date: f.date?.stringValue, done: f.done?.booleanValue, source: f.source?.stringValue };
  });
}

const GAN_TEXT =
  "רותי הגננת: הורים יקרים, ביום חמישי הקרוב יתקיים יום פיג'מות. נא להעביר 25 ₪ לטיול עד יום שלישי.\n" +
  "ועד הורים: למסיבת סוכות כל ילד מביא בקבוק מיץ ושקית במבה";

const tab = (p: Page, re: RegExp) => p.getByText(re).first().click();
const row = (p: Page, title: string | RegExp) =>
  p.getByText(title).first().locator('xpath=ancestor::div[.//*[@role="checkbox"]][1]');

test("two parents run the family board together", async ({ browser }) => {
  // ---------- Elad creates the board ----------
  const elad = await browser.newPage();
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
  await elad.getByText("הוספה ללוח", { exact: true }).click();
  await expect(elad.getByText(/פיג/).first()).toBeVisible();
  await shot(elad, "text-saved");
  const afterText = await stored(CODE, "tasks");
  expect(afterText.some((t: any) => /פיג/.test(t.title) && t.cat === "gan" && t.source === "message")).toBe(true);
  expect(afterText.some((t: any) => /25/.test(t.title))).toBe(true);

  // ---------- Photo of a school letter → real AI ----------
  await tab(elad, /^\+ הודעה/);
  const chooser = elad.waitForEvent("filechooser");
  await elad.getByText("📷 תמונה מהגלריה", { exact: true }).click();
  await (await chooser).setFiles(path.join(__dirname, "../fixtures/school-notice.jpg"));
  await expect(elad.getByText("הסרת התמונה", { exact: true })).toBeVisible();
  await elad.getByText("חילוץ משימות", { exact: true }).click();
  await expect(elad.getByText("הוספה ללוח", { exact: true })).toBeVisible({ timeout: 90_000 });
  await shot(elad, "image-preview");
  await elad.getByText("הוספה ללוח", { exact: true }).click();
  await expect(elad.getByText(/אסיפ/).first()).toBeVisible();
  await shot(elad, "image-saved");
  const afterImage = await stored(CODE, "tasks");
  expect(afterImage.some((t: any) => /אסיפ/.test(t.title) && t.cat === "school")).toBe(true);
  expect(afterImage.some((t: any) => /סיור|בוטני/.test(t.title))).toBe(true);

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
