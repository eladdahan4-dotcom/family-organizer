import { firebaseConfig, AI_MODELS } from "./config";
import { DAYS, iso, isIsoDate, isTime } from "./dates";
import type { Extracted, Cat } from "./types";

// Calls Gemini through Firebase AI Logic's REST endpoint directly with fetch.
// (The firebase/ai JS SDK relies on browser APIs that the Android runtime lacks.)
const ENDPOINT = (model: string) =>
  "https://firebasevertexai.googleapis.com/v1beta/projects/" +
  firebaseConfig.projectId +
  "/models/" +
  model +
  ":generateContent";

const CATS: Cat[] = ["gan", "school", "home", "other"];

export function buildPrompt(text: string, hasImage: boolean, now = new Date()) {
  const week = [...Array(8)]
    .map((_, i) => {
      const x = new Date(now);
      x.setDate(now.getDate() + i);
      return "יום " + DAYS[x.getDay()] + " = " + iso(x);
    })
    .join("; ");
  return (
    "You extract family to-dos from Hebrew (or English) messages sent by kindergartens, schools, parent committees, email and WhatsApp.\n" +
    "Today is " + iso(now) + " (יום " + DAYS[now.getDay()] + "). Upcoming days: " + week + ".\n" +
    "Resolve relative dates (מחר, ביום חמישי, שבוע הבא) to YYYY-MM-DD. If a task has a deadline (עד יום X), use the deadline date. Leave date empty if none.\n" +
    "Write each task title as a short, actionable Hebrew phrase for the parents (e.g. 'לשלוח 15 ₪ לטיול', 'פיג׳מה לגן'). Include amounts and items to bring.\n" +
    "Only include things the parents need to do, remember or attend. Skip general information that needs no action.\n" +
    "cat must be one of: gan (kindergarten/מעון/צהרון), school, home, other. Items to buy at the supermarket go in shopping instead of tasks.\n" +
    (hasImage
      ? "An image is attached (a screenshot of a WhatsApp chat or email, a printed school notice, an invitation, a schedule). Read all text in it and extract from it too. Ignore chat UI elements.\n"
      : "") +
    'Return ONLY JSON: {"tasks":[{"title":"","date":"","time":"HH:MM or empty","cat":""}],"shopping":[{"name":"","qty":""}]}\n\nMESSAGE:\n' +
    (text || "(no text, see the attached image)")
  );
}

/** Detects the real image type from base64 bytes (pickers don't always report it correctly). */
export function sniffMime(b64: string, fallback = "image/jpeg"): string {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("R0lG")) return "image/gif";
  if (b64.startsWith("UklGR")) return "image/webp";
  // HEIC/HEIF: bytes 4-11 are "ftypheic"/"ftypheix"/"ftypmif1"; in base64 that starts at char 6.
  if (/^.{6}Z0eXB(oZWl|taWYx)/.test(b64)) return "image/heic";
  return fallback;
}

export class AiError extends Error {
  constructor(public kind: "quota" | "network" | "setup" | "bad" | "other", msg: string) {
    super(msg);
  }
}

export async function extract(text: string, image?: { base64: string; mimeType: string }): Promise<Extracted> {
  const parts: any[] = [{ text: buildPrompt(text, !!image) }];
  if (image) parts.push({ inlineData: { mimeType: sniffMime(image.base64, image.mimeType || "image/jpeg"), data: image.base64 } });

  const payload = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });

  let res: Response | null = null;
  let body = "";
  for (const model of AI_MODELS) {
    try {
      res = await fetch(ENDPOINT(model), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": firebaseConfig.apiKey,
          "X-Firebase-AppId": firebaseConfig.appId,
        },
        body: payload,
      });
    } catch (e: any) {
      throw new AiError("network", String(e?.message || e));
    }
    body = await res.text();
    // A retired or unknown model answers 404: try the next one.
    if (res.status !== 404) break;
  }
  if (!res) throw new AiError("other", "no model configured");
  if (!res.ok) {
    const kind = res.status === 429 ? "quota" : res.status === 403 || res.status === 404 ? "setup" : "other";
    throw new AiError(kind, res.status + " " + body.slice(0, 200));
  }

  let raw = "";
  try {
    const j = JSON.parse(body);
    raw = (j.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("").trim();
  } catch {
    throw new AiError("bad", "unreadable response");
  }
  raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return parseExtracted(raw);
}

export function parseExtracted(raw: string): Extracted {
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch {
    throw new AiError("bad", "not JSON: " + raw.slice(0, 120));
  }
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
