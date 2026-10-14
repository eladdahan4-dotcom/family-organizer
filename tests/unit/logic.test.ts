import { iso, parseIso, dayDiff, fmtDate, parseUserDate, isIsoDate, isTime } from "../../src/dates";
import { buildPrompt, parseExtracted, sniffMime } from "../../src/ai";
import { toIncoming } from "../../src/share.native";

import { newFamilyCode, normalizeCode, prettyCode } from "../../src/codes";

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

describe("dates", () => {
  test("iso / parseIso round trip", () => {
    expect(iso(new Date(2026, 9, 5))).toBe("2026-10-05");
    expect(iso(parseIso("2026-02-28"))).toBe("2026-02-28");
  });

  test("dayDiff counts calendar days from today", () => {
    expect(dayDiff(addDays(0))).toBe(0);
    expect(dayDiff(addDays(1))).toBe(1);
    expect(dayDiff(addDays(-1))).toBe(-1);
    expect(dayDiff(addDays(10))).toBe(10);
  });

  test("fmtDate shows Hebrew day letter and day.month", () => {
    expect(fmtDate("2026-10-15")).toBe("יום ה׳ 15.10");
    expect(fmtDate("2026-10-18")).toBe("יום א׳ 18.10");
  });

  test("parseUserDate understands the formats people type", () => {
    expect(parseUserDate("")).toBe("");
    expect(parseUserDate("2026-11-03")).toBe("2026-11-03");
    expect(parseUserDate("3/11/2026")).toBe("2026-11-03");
    expect(parseUserDate("3.11.26")).toBe("2026-11-03");
    expect(parseUserDate("abc")).toBe("");
    expect(parseUserDate("32")).toBe("");
  });

  test("parseUserDate without a year picks the upcoming date", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 5);
    expect(parseUserDate(soon.getDate() + "." + (soon.getMonth() + 1))).toBe(iso(soon));
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 100);
    const r = parseUserDate(longAgo.getDate() + "." + (longAgo.getMonth() + 1));
    expect(parseIso(r).getFullYear()).toBe(longAgo.getFullYear() + 1);
  });

  test("validators", () => {
    expect(isIsoDate("2026-10-13")).toBe(true);
    expect(isIsoDate("13.10")).toBe(false);
    expect(isTime("08:30")).toBe(true);
    expect(isTime("8:30")).toBe(false);
  });
});

describe("AI prompt and response parsing", () => {
  test("prompt contains today, the coming week mapping and the message", () => {
    const now = new Date(2026, 9, 13); // Tuesday
    const p = buildPrompt("ביום חמישי יום פיג'מות", false, now);
    expect(p).toContain("Today is 2026-10-13 (יום שלישי)");
    expect(p).toContain("יום חמישי = 2026-10-15");
    expect(p).toContain("ביום חמישי יום פיג'מות");
    expect(p).not.toContain("An image is attached");
  });

  test("prompt mentions the image when one is attached", () => {
    const p = buildPrompt("", true);
    expect(p).toContain("An image is attached");
    expect(p).toContain("(no text, see the attached image)");
  });

  test("parseExtracted keeps valid items and cleans bad fields", () => {
    const r = parseExtracted(
      JSON.stringify({
        tasks: [
          { title: "פיג׳מה לגן", date: "2026-10-15", time: "", cat: "gan" },
          { title: "אסיפה", date: "יום ראשון", time: "18:30", cat: "school" },
          { title: "משהו", date: "", time: "8pm", cat: "banana" },
          { title: "" },
          null,
        ],
        shopping: [{ name: "במבה", qty: "2" }, { name: "" }, { name: "מיץ" }],
      })
    );
    expect(r.tasks).toEqual([
      { kind: "task", title: "פיג׳מה לגן", date: "2026-10-15", time: "", endTime: "", location: "", cat: "gan", pick: true },
      { kind: "task", title: "אסיפה", date: "", time: "18:30", endTime: "", location: "", cat: "school", pick: true },
      { kind: "task", title: "משהו", date: "", time: "", endTime: "", location: "", cat: "other", pick: true },
    ]);
    expect(r.shopping).toEqual([
      { name: "במבה", qty: "2", pick: true },
      { name: "מיץ", qty: "", pick: true },
    ]);
  });

  test("parseExtracted keeps meeting details and drops impossible ones", () => {
    const r = parseExtracted(
      JSON.stringify({
        tasks: [
          { kind: "event", title: "אסיפת הורים", date: "2026-10-18", time: "18:30", endTime: "19:30", location: "בכיתה", cat: "school" },
          { kind: "event", title: "בלי שעה", date: "2026-10-18", time: "", endTime: "19:00", location: "x", cat: "school" },
          { kind: "event", title: "סיום לפני התחלה", date: "2026-10-18", time: "18:00", endTime: "17:00", cat: "school" },
          { kind: "task", title: "משימה עם מקום", location: "בבית", endTime: "10:00", time: "09:00" },
          { kind: "meeting", title: "סוג לא מוכר" },
        ],
      })
    );
    expect(r.tasks.map((t) => [t.kind, t.time, t.endTime, t.location])).toEqual([
      ["event", "18:30", "19:30", "בכיתה"],
      ["event", "", "", "x"],
      ["event", "18:00", "", ""],
      ["task", "09:00", "", ""],
      ["task", "", "", ""],
    ]);
  });

  test("prompt explains meetings vs tasks", () => {
    const p = buildPrompt("x", false);
    expect(p).toContain('"event"');
    expect(p).toContain("endTime");
    expect(p).toContain("location");
  });

  test("parseExtracted understands other answer shapes the AI sometimes uses", () => {
    const list = parseExtracted(JSON.stringify([{ title: "פיג׳מה", date: "2026-10-15", cat: "gan" }, { name: "במבה", qty: "1" }]));
    expect(list.tasks.map((t) => t.title)).toEqual(["פיג׳מה"]);
    expect(list.shopping.map((s) => s.name)).toEqual(["במבה"]);
    const wrapped = parseExtracted(JSON.stringify({ result: { tasks: [{ title: "אסיפה" }], shopping: [] } }));
    expect(wrapped.tasks.map((t) => t.title)).toEqual(["אסיפה"]);
    const other = parseExtracted(JSON.stringify({ items: [{ task: "לחתום" }], shopping_list: [{ name: "חלב" }] }));
    expect(other.tasks.map((t) => t.title)).toEqual(["לחתום"]);
    expect(other.shopping.map((s) => s.name)).toEqual(["חלב"]);
    const chatty = parseExtracted('Here you go: {"tasks":[{"title":"טיול"}],"shopping":[]} hope it helps');
    expect(chatty.tasks.map((t) => t.title)).toEqual(["טיול"]);
  });

  test("parseExtracted handles missing lists and rejects non-JSON", () => {
    expect(parseExtracted("{}")).toEqual({ tasks: [], shopping: [] });
    expect(() => parseExtracted("sorry, I can't")).toThrow();
  });

  test("sniffMime detects the real image type", () => {
    expect(sniffMime("/9j/4AAQSkZJRg")).toBe("image/jpeg");
    expect(sniffMime("iVBORw0KGgoAAAANS")).toBe("image/png");
    expect(sniffMime("R0lGODlh")).toBe("image/gif");
    expect(sniffMime("UklGRiQAAABXRUJQ")).toBe("image/webp");
    expect(sniffMime("AAAAGGZ0eXBoZWljAAAAAG1pZjE")).toBe("image/heic");
    expect(sniffMime("????", "image/png")).toBe("image/png");
  });
});

describe("family codes", () => {
  test("new codes are 20 unambiguous characters and unique", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = newFamilyCode();
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{20}$/);
      codes.add(c);
    }
    expect(codes.size).toBe(200);
  });

  test("codes typed with dashes, spaces or lowercase are normalized", () => {
    expect(normalizeCode(" abcde-fghjk-23456-78xyz ")).toBe("ABCDEFGHJK2345678XYZ");
    expect(prettyCode("ABCDEFGHJK2345678XYZ")).toBe("ABCDE-FGHJK-23456-78XYZ");
  });
});

describe("content shared from other apps", () => {
  test("WhatsApp text", () => {
    expect(toIncoming({ text: "מחר טיול" })).toEqual({ text: "מחר טיול", image: null });
  });
  test("image path without scheme gets file://", () => {
    expect(toIncoming({ files: [{ path: "/data/user/0/x.jpg", mimeType: "image/jpeg" }] })).toEqual({
      text: "",
      image: { uri: "file:///data/user/0/x.jpg", mimeType: "image/jpeg" },
    });
  });
  test("content:// uris are kept, non-images ignored, empty shares dropped", () => {
    expect(toIncoming({ files: [{ path: "content://media/1", mimeType: "image/png" }] })?.image?.uri).toBe("content://media/1");
    expect(toIncoming({ files: [{ path: "/x.pdf", mimeType: "application/pdf" }] })).toBeNull();
    expect(toIncoming(null)).toBeNull();
  });
});
