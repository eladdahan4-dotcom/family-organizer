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

/** Longest wait for one model's answer before moving on to the next model (tests may lower it). */
export const AI_TIMEOUT_MS = 30_000;
export const aiSettings = { timeoutMs: AI_TIMEOUT_MS };

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
    "You extract family to-dos and meetings from Hebrew (or English) messages sent by kindergartens, schools, parent committees, email and WhatsApp.\n" +
    "Today is " + iso(now) + " (יום " + DAYS[now.getDay()] + "). Upcoming days: " + week + ".\n" +
    "Resolve relative dates (מחר, ביום חמישי, שבוע הבא) to YYYY-MM-DD. If a task has a deadline (עד יום X), use the deadline date. Leave date empty if none.\n" +
    "Each item has a kind:\n" +
    "- \"event\": something that happens at a set date (usually a time) that someone attends: parents' meeting (אסיפת הורים), appointment, party, birthday, performance, class, trip day.\n" +
    "- \"task\": something to do, bring, pay, sign, send or prepare.\n" +
    "For events put the start time in time, the end time in endTime and the place in location when the message gives them.\n" +
    "Write each title as a short Hebrew phrase for the parents (e.g. 'לשלוח 15 ₪ לטיול', 'פיג׳מה לגן', 'אסיפת הורים'). Include amounts and items to bring.\n" +
    "Only include things the parents need to do, remember or attend. Skip general information that needs no action.\n" +
    "cat must be one of: gan (kindergarten/מעון/צהרון), school, home, other. Items to buy at the supermarket go in shopping instead of tasks.\n" +
    (hasImage
      ? "An image is attached (a screenshot of a WhatsApp chat or email, a printed school notice, an invitation, a schedule). Read all text in it and extract from it too. Ignore chat UI elements.\n"
      : "") +
    'Return ONLY JSON: {"tasks":[{"kind":"task or event","title":"","date":"","time":"HH:MM or empty","endTime":"HH:MM or empty","location":"","cat":""}],"shopping":[{"name":"","qty":""}]}\n\nMESSAGE:\n' +
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
  constructor(public kind: "quota" | "network" | "timeout" | "setup" | "bad" | "other", msg: string) {
    super(msg);
  }
}

async function post(url: string, payload: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": firebaseConfig.apiKey,
        "X-Firebase-AppId": firebaseConfig.appId,
      },
      body: payload,
      signal: ctrl.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError" || ctrl.signal.aborted) throw new AiError("timeout", "no answer in " + timeoutMs / 1000 + "s");
    throw new AiError("network", String(e?.message || e));
  } finally {
    clearTimeout(timer);
  }
}

export async function extract(
  text: string,
  image?: { base64: string; mimeType: string },
  timeoutMs = aiSettings.timeoutMs
): Promise<Extracted> {
  const parts: any[] = [{ text: buildPrompt(text, !!image) }];
  if (image) parts.push({ inlineData: { mimeType: sniffMime(image.base64, image.mimeType || "image/jpeg"), data: image.base64 } });

  // Less "thinking" makes answers about twice as fast (measured ~25s → ~11s); reading a
  // school message doesn't need deep reasoning. Models that don't accept the setting are
  // asked again without it.
  const make = (fast: boolean) =>
    JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        ...(fast ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
      },
    });

  let res: Response | null = null;
  let body = "";
  let usedModel = "";
  for (let m = 0; m < AI_MODELS.length; m++) {
    const model = AI_MODELS[m];
    const last = m === AI_MODELS.length - 1;
    try {
      res = await post(ENDPOINT(model), make(true), timeoutMs);
      body = await res.text();
      if (res.status === 400) {
        res = await post(ENDPOINT(model), make(false), timeoutMs);
        body = await res.text();
      }
    } catch (e) {
      // A model that doesn't answer at all (seen with the free tier): move on to the next one.
      if (e instanceof AiError && e.kind === "timeout" && !last) continue;
      throw e;
    }
    usedModel = model;
    // Out of daily quota (429) or retired (404): try the next model.
    if (res.status !== 404 && res.status !== 429) break;
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
  return { ...parseExtracted(raw), model: usedModel };
}

/** Finds the lists in the AI's answer, whatever shape it chose (object with keys, plain list, wrapped). */
function lists(j: any): { tasks: any[]; shopping: any[] } {
  if (Array.isArray(j)) {
    return {
      tasks: j.filter((x) => x && (x.title || x.task) && !x.qty),
      shopping: j.filter((x) => x && x.name && !x.title),
    };
  }
  if (!j || typeof j !== "object") return { tasks: [], shopping: [] };
  const tasks = j.tasks ?? j.items ?? j.todos ?? j.events;
  const shopping = j.shopping ?? j.shoppingList ?? j.shopping_list ?? j.groceries;
  if (!Array.isArray(tasks) && !Array.isArray(shopping)) {
    for (const v of Object.values(j)) if (v && typeof v === "object") return lists(v); // e.g. {"result": {...}}
  }
  return { tasks: Array.isArray(tasks) ? tasks : [], shopping: Array.isArray(shopping) ? shopping : [] };
}

export function parseExtracted(raw: string): Extracted {
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch {
    // Sometimes the JSON comes with a sentence around it: take the outermost {...} or [...].
    const m = raw.match(/[\[{][\s\S]*[\]}]/);
    try {
      j = m ? JSON.parse(m[0]) : undefined;
    } catch {}
    if (j === undefined) throw new AiError("bad", "not JSON: " + raw.slice(0, 120));
  }
  const l = lists(j);
  return {
    tasks: l.tasks
      .map((t: any) => (t && !t.title && t.task ? { ...t, title: t.task } : t))
      .filter((t: any) => t && t.title)
      .map((t: any) => {
        const time = isTime(t.time) ? t.time : "";
        const kind = t.kind === "event" ? "event" : "task";
        return {
          kind,
          title: String(t.title),
          date: isIsoDate(t.date) ? t.date : "",
          time,
          endTime: kind === "event" && time && isTime(t.endTime) && t.endTime > time ? t.endTime : "",
          location: kind === "event" && t.location ? String(t.location) : "",
          cat: CATS.includes(t.cat) ? t.cat : "other",
          pick: true,
        };
      }),
    shopping: l.shopping
      .filter((s: any) => s && s.name)
      .map((s: any) => ({ name: String(s.name), qty: s.qty ? String(s.qty) : "", pick: true })),
  };
}
