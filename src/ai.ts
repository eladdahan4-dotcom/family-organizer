import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { app } from "./firebase";
import { AI_MODEL } from "./config";
import { DAYS, iso, isIsoDate, isTime } from "./dates";
import type { Extracted, Cat } from "./types";

const CATS: Cat[] = ["gan", "school", "home", "other"];

function buildPrompt(text: string, hasImage: boolean) {
  const d = new Date();
  const week = [...Array(8)]
    .map((_, i) => {
      const x = new Date(d);
      x.setDate(d.getDate() + i);
      return "יום " + DAYS[x.getDay()] + " = " + iso(x);
    })
    .join("; ");
  return (
    "You extract family to-dos from Hebrew (or English) messages sent by kindergartens, schools, parent committees, email and WhatsApp.\n" +
    "Today is " + iso(d) + " (יום " + DAYS[d.getDay()] + "). Upcoming days: " + week + ".\n" +
    "Resolve relative dates (מחר, ביום חמישי, שבוע הבא) to YYYY-MM-DD. If a task has a deadline (עד יום X), use the deadline date. Leave date empty if none.\n" +
    "Write each task title as a short, actionable Hebrew phrase for the parents (e.g. 'לשלוח 15 ₪ לטיול', 'פיג׳מה לגן'). Include amounts and items to bring.\n" +
    "cat must be one of: gan (kindergarten/מעון/צהרון), school, home, other. Items to buy at the supermarket go in shopping instead of tasks.\n" +
    (hasImage
      ? "An image is attached (a screenshot of a WhatsApp chat or email, a printed school notice, an invitation, a schedule). Read all text in it and extract from it too. Ignore chat UI elements.\n"
      : "") +
    'Return ONLY JSON: {"tasks":[{"title":"","date":"","time":"HH:MM or empty","cat":""}],"shopping":[{"name":"","qty":""}]}\n\nMESSAGE:\n' +
    (text || "(no text, see the attached image)")
  );
}

export async function extract(
  text: string,
  image?: { base64: string; mimeType: string }
): Promise<Extracted> {
  const ai = getAI(app(), { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    model: AI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });
  const parts: any[] = [buildPrompt(text, !!image)];
  if (image) parts.push({ inlineData: { data: image.base64, mimeType: image.mimeType || "image/jpeg" } });
  const res = await model.generateContent(parts);
  let raw = res.response.text().trim();
  raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const j = JSON.parse(raw);
  return {
    tasks: (j.tasks || [])
      .filter((t: any) => t && t.title)
      .map((t: any) => ({
        title: String(t.title),
        date: isIsoDate(t.date) ? t.date : "",
        time: isTime(t.time) ? t.time : "",
        cat: CATS.includes(t.cat) ? t.cat : "other",
        pick: true,
      })),
    shopping: (j.shopping || [])
      .filter((s: any) => s && s.name)
      .map((s: any) => ({ name: String(s.name), qty: s.qty ? String(s.qty) : "", pick: true })),
  };
}
