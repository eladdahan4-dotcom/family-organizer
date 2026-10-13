import { screen, fireEvent, waitFor, render } from "@testing-library/react-native";
import React from "react";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { openApp, goTab, FAM, ME, daysFromNow, flush } from "./helpers";
import { tasksOf, shopOf } from "./fakeStore";

const fetchMock = () => global.fetch as jest.Mock;

const gemini = (obj: any) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
});

const SAMPLE = {
  tasks: [
    { kind: "task", title: "יום פיג׳מות בגן", date: daysFromNow(2), time: "", cat: "gan" },
    { kind: "task", title: "לשלוח 25 ₪ לטיול", date: daysFromNow(1), time: "", cat: "gan" },
    { kind: "event", title: "אסיפת הורים", date: daysFromNow(5), time: "18:30", endTime: "19:30", location: "בכיתה", cat: "school" },
  ],
  shopping: [{ name: "בקבוק מיץ", qty: "1" }],
};

const messageBox = () => screen.getByPlaceholderText(/^לדוגמה: הורים יקרים/);
const sentBody = (i = 0) => JSON.parse(fetchMock().mock.calls[i][1].body);

async function openAddTab() {
  await openApp();
  goTab(/^\+ הודעה/);
}

describe("adding from a message", () => {
  test("pasted text → preview → only the ticked items are saved, each in the right list", async () => {
    fetchMock().mockResolvedValueOnce(gemini(SAMPLE));
    await openAddTab();
    fireEvent.changeText(messageBox(), "הורים יקרים, ביום חמישי יום פיג'מות...");
    fireEvent.press(screen.getByText("חילוץ משימות"));

    expect(await screen.findByText("יום פיג׳מות בגן")).toBeTruthy();
    expect(screen.getByText("🛒 בקבוק מיץ")).toBeTruthy();
    const parts = sentBody().contents[0].parts;
    expect(parts).toHaveLength(1);
    expect(parts[0].text).toContain("ביום חמישי יום פיג'מות");

    // Untick the parents' meeting (its checkbox is the third).
    fireEvent.press(screen.getAllByRole("checkbox")[2]);
    fireEvent.press(screen.getByText("הוספה ללוח"));

    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(2));
    const saved = tasksOf(FAM).sort((a: any, b: any) => a.createdAt - b.createdAt);
    expect(saved[0]).toMatchObject({ title: "יום פיג׳מות בגן", date: daysFromNow(2), cat: "gan", done: false, createdBy: ME, source: "message", who: "" });
    expect(saved[1]).toMatchObject({ title: "לשלוח 25 ₪ לטיול", date: daysFromNow(1), cat: "gan" });
    expect(shopOf(FAM)).toEqual([expect.objectContaining({ name: "בקבוק מיץ", qty: "1", done: false })]);

    // Goes back to the tasks tab where the new items are visible.
    expect(await screen.findByText(/^מחר 1/)).toBeTruthy();
    expect(screen.getByText("לשלוח 25 ₪ לטיול")).toBeTruthy();
    expect(screen.getByText(/^קניות 1/)).toBeTruthy();
  });

  test("a large photo is shrunk before sending, so it uploads and reads fast", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///big.png", width: 3000, height: 4000, mimeType: "image/png" }],
    });
    fetchMock().mockResolvedValueOnce(gemini(SAMPLE));
    await openAddTab();
    fireEvent.press(screen.getByText("📷 תמונה מהגלריה"));
    expect(await screen.findByText("הסרת התמונה")).toBeTruthy();

    fireEvent.press(screen.getByText("חילוץ משימות"));
    expect(await screen.findByText("יום פיג׳מות בגן")).toBeTruthy();
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      "file:///big.png",
      [{ resize: { height: 1600 } }],
      expect.objectContaining({ base64: true, compress: 0.7 })
    );
    const parts = sentBody().contents[0].parts;
    expect(parts[1]).toEqual({ inlineData: { mimeType: "image/jpeg", data: "/9j/SMALL" } });
    expect(parts[0].text).toContain("An image is attached");

    fireEvent.press(screen.getByText("הוספה ללוח"));
    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(3));
  });

  test("a small screenshot is only compressed, not resized", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///small.jpg", width: 720, height: 1500 }],
    });
    fetchMock().mockResolvedValueOnce(gemini(SAMPLE));
    await openAddTab();
    fireEvent.press(screen.getByText("📷 תמונה מהגלריה"));
    await screen.findByText("הסרת התמונה");
    fireEvent.press(screen.getByText("חילוץ משימות"));
    await screen.findByText("הוספה ללוח");
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith("file:///small.jpg", [], expect.objectContaining({ base64: true }));
  });

  test("image + text together are both sent", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///p.jpg", width: 800, height: 600, mimeType: "image/jpeg" }],
    });
    fetchMock().mockResolvedValueOnce(gemini(SAMPLE));
    await openAddTab();
    fireEvent.changeText(messageBox(), "ותזכורת: להביא כובע");
    fireEvent.press(screen.getByText("📷 תמונה מהגלריה"));
    await screen.findByText("הסרת התמונה");
    fireEvent.press(screen.getByText("חילוץ משימות"));
    await screen.findByText("הוספה ללוח");
    const parts = sentBody().contents[0].parts;
    expect(parts[0].text).toContain("להביא כובע");
    expect(parts[1].inlineData).toEqual({ mimeType: "image/jpeg", data: "/9j/SMALL" });
  });

  test("if shrinking fails, the original file is sent instead", async () => {
    (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValueOnce(new Error("unsupported"));
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///odd.heic", width: 3000, height: 4000 }],
    });
    fetchMock().mockResolvedValueOnce(gemini(SAMPLE));
    await openAddTab();
    fireEvent.press(screen.getByText("📷 תמונה מהגלריה"));
    await screen.findByText("הסרת התמונה");
    fireEvent.press(screen.getByText("חילוץ משימות"));
    await screen.findByText("הוספה ללוח");
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith("file:///odd.heic", expect.anything());
    expect(sentBody().contents[0].parts[1].inlineData.data).toBe("/9j/FROMFILE");
  });

  test("removing the image sends text only", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///p.jpg", width: 500, height: 500 }],
    });
    fetchMock().mockResolvedValueOnce(gemini(SAMPLE));
    await openAddTab();
    fireEvent.press(screen.getByText("📷 תמונה מהגלריה"));
    fireEvent.press(await screen.findByText("הסרת התמונה"));
    fireEvent.changeText(messageBox(), "טקסט");
    fireEvent.press(screen.getByText("חילוץ משימות"));
    await screen.findByText("הוספה ללוח");
    expect(sentBody().contents[0].parts).toHaveLength(1);
  });

  test("cancelling the gallery changes nothing", async () => {
    await openAddTab();
    fireEvent.press(screen.getByText("📷 תמונה מהגלריה"));
    await flush();
    expect(screen.queryByText("הסרת התמונה")).toBeNull();
  });

  test("camera: photo is used; refused permission shows how to fix", async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///cam.jpg", width: 4000, height: 3000 }],
    });
    await openAddTab();
    fireEvent.press(screen.getByText("צילום"));
    expect(await screen.findByText("הסרת התמונה")).toBeTruthy();

    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    fireEvent.press(screen.getByText("צילום"));
    expect(await screen.findByText("צריך לאשר גישה למצלמה בהגדרות הטלפון.")).toBeTruthy();
  });

  test("nothing to read gives a hint and calls nothing", async () => {
    await openAddTab();
    fireEvent.press(screen.getByText("חילוץ משימות"));
    expect(await screen.findByText("הדביקו טקסט או הוסיפו תמונה.")).toBeTruthy();
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  test("message with nothing to do", async () => {
    fetchMock().mockResolvedValueOnce(gemini({ tasks: [], shopping: [] }));
    await openAddTab();
    fireEvent.changeText(messageBox(), "שבת שלום לכולם");
    fireEvent.press(screen.getByText("חילוץ משימות"));
    expect(await screen.findByText("לא נמצאו משימות בהודעה.")).toBeTruthy();
  });

  test("cancel the preview saves nothing", async () => {
    fetchMock().mockResolvedValueOnce(gemini(SAMPLE));
    await openAddTab();
    fireEvent.changeText(messageBox(), "x");
    fireEvent.press(screen.getByText("חילוץ משימות"));
    fireEvent.press(await screen.findByText("ביטול"));
    await flush();
    expect(screen.queryByText("הוספה ללוח")).toBeNull();
    expect(tasksOf(FAM)).toHaveLength(0);
  });

  test.each([
    ["quota", { ok: false, status: 429, text: async () => "{}" }, /^הגעתם למגבלת השימוש היומית החינמית/],
    ["setup", { ok: false, status: 403, text: async () => "PERMISSION_DENIED" }, /^החילוץ החכם לא מופעל בפרויקט Firebase/],
    ["server", { ok: false, status: 500, text: async () => "oops" }, /^החילוץ לא הצליח\. נסו שוב\./],
  ])("error: %s", async (_n, response, message) => {
    fetchMock().mockResolvedValue(response);
    await openAddTab();
    fireEvent.changeText(messageBox(), "x");
    fireEvent.press(screen.getByText("חילוץ משימות"));
    expect(await screen.findByText(message as any)).toBeTruthy();
    expect(tasksOf(FAM)).toHaveLength(0);
  });

  test("error: no internet", async () => {
    fetchMock().mockRejectedValueOnce(new TypeError("Network request failed"));
    await openAddTab();
    fireEvent.changeText(messageBox(), "x");
    fireEvent.press(screen.getByText("חילוץ משימות"));
    expect(await screen.findByText("אין חיבור לאינטרנט. נסו שוב.")).toBeTruthy();
  });
});

describe("fixing what the AI understood, before saving", () => {
  async function preview() {
    fetchMock().mockResolvedValueOnce(gemini(SAMPLE));
    await openAddTab();
    fireEvent.changeText(messageBox(), "x");
    fireEvent.press(screen.getByText("חילוץ משימות"));
    await screen.findByText("הוספה ללוח");
  }

  test("change title, date, category and who; the fixed version is what gets saved", async () => {
    await preview();
    fireEvent.press(screen.getByText("לשלוח 25 ₪ לטיול"));
    expect(await screen.findByText("תיקון לפני הוספה")).toBeTruthy();
    const title = screen.getByPlaceholderText("משימה חדשה, למשל: להביא 20 ₪ לטיול");
    expect(title.props.value).toBe("לשלוח 25 ₪ לטיול");
    fireEvent.changeText(title, "לשלוח 30 ₪ לטיול לחווה");
    fireEvent.changeText(screen.getByPlaceholderText("תאריך 15.10"), "");
    fireEvent.press(screen.getByText("מחר"));
    fireEvent.press(screen.getAllByText("בית ספר").slice(-1)[0]);
    fireEvent.press(screen.getByText("שנינו"));
    fireEvent.press(screen.getByText("עדכון"));
    expect(await screen.findByText("לשלוח 30 ₪ לטיול לחווה")).toBeTruthy();
    expect(screen.queryByText("לשלוח 25 ₪ לטיול")).toBeNull();

    fireEvent.press(screen.getByText("הוספה ללוח"));
    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(3));
    expect(tasksOf(FAM).find((t: any) => t.title === "לשלוח 30 ₪ לטיול לחווה")).toMatchObject({
      date: daysFromNow(1),
      cat: "school",
      who: "both",
      kind: "task",
    });
  });

  test("turn something the AI saw as a task into a meeting", async () => {
    await preview();
    fireEvent.press(screen.getByText("יום פיג׳מות בגן"));
    fireEvent.press(screen.getByText("📅 פגישה"));
    fireEvent.changeText(screen.getByPlaceholderText("משעה 18:00"), "08:00");
    fireEvent.press(screen.getByText("עדכון"));
    expect(await screen.findByText("📅 יום פיג׳מות בגן")).toBeTruthy();
    fireEvent.press(screen.getByText("הוספה ללוח"));
    await waitFor(() => expect(tasksOf(FAM).find((t: any) => t.title === "יום פיג׳מות בגן")).toMatchObject({ kind: "event", time: "08:00" }));
  });

  test("fix a shopping item", async () => {
    await preview();
    fireEvent.press(screen.getByText("🛒 בקבוק מיץ"));
    fireEvent.changeText(screen.getByPlaceholderText("מה לקנות"), "מיץ ענבים");
    fireEvent.changeText(screen.getAllByPlaceholderText("כמות").slice(-1)[0], "2");
    fireEvent.press(screen.getByText("עדכון"));
    expect(await screen.findByText("🛒 מיץ ענבים")).toBeTruthy();
    fireEvent.press(screen.getByText("הוספה ללוח"));
    await waitFor(() => expect(shopOf(FAM)).toEqual([expect.objectContaining({ name: "מיץ ענבים", qty: "2" })]));
  });

  test("a mistake in the fix is explained and the preview is unchanged", async () => {
    await preview();
    fireEvent.press(screen.getByText("📅 אסיפת הורים"));
    fireEvent.changeText(screen.getByPlaceholderText("עד 19:30"), "17:00");
    fireEvent.press(screen.getByText("עדכון"));
    expect(await screen.findByText("שעת הסיום צריכה להיות אחרי שעת ההתחלה.")).toBeTruthy();
    fireEvent.press(screen.getAllByText("ביטול").slice(-1)[0]);
    await flush();
    expect(screen.getByText("18:30–19:30", { exact: false })).toBeTruthy();
  });

  test("remove a wrong item from the list", async () => {
    await preview();
    fireEvent.press(screen.getByText("📅 אסיפת הורים"));
    fireEvent.press(screen.getByText("להוריד מהרשימה"));
    await flush();
    expect(screen.queryByText("📅 אסיפת הורים")).toBeNull();
    fireEvent.press(screen.getByText("הוספה ללוח"));
    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(2));
  });
});

describe("meetings found in a message", () => {
  test("are marked as meetings in the preview and saved with time range and place", async () => {
    fetchMock().mockResolvedValueOnce(gemini(SAMPLE));
    await openAddTab();
    fireEvent.changeText(messageBox(), "אסיפת הורים ביום ראשון 18:30-19:30 בכיתה");
    fireEvent.press(screen.getByText("חילוץ משימות"));
    expect(await screen.findByText("📅 אסיפת הורים")).toBeTruthy();
    expect(screen.getByText("📍 בכיתה")).toBeTruthy();
    fireEvent.press(screen.getByText("הוספה ללוח"));
    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(3));
    const meeting: any = tasksOf(FAM).find((t: any) => t.title === "אסיפת הורים");
    expect(meeting).toMatchObject({ kind: "event", date: daysFromNow(5), time: "18:30", endTime: "19:30", location: "בכיתה", cat: "school" });
    const task: any = tasksOf(FAM).find((t: any) => t.title === "לשלוח 25 ₪ לטיול");
    expect(task).toMatchObject({ kind: "task", endTime: "", location: "" });
  });
});

describe("a slow AI answer", () => {
  test("stops waiting and explains instead of showing 'reading…' forever", async () => {
    fetchMock().mockImplementation((_u: string, init: any) =>
      new Promise((_res, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))))
    );
    jest.useFakeTimers();
    try {
      await openAddTab();
      fireEvent.changeText(messageBox(), "x");
      fireEvent.press(screen.getByText("חילוץ משימות"));
      expect(screen.getByText("קורא…")).toBeTruthy();
      await jest.advanceTimersByTimeAsync(46_000);
    } finally {
      jest.useRealTimers();
    }
    expect(await screen.findByText("הקריאה לקחה יותר מדי זמן. נסו שוב, או צלמו רק את החלק החשוב בהודעה.")).toBeTruthy();
    expect(screen.getByText("חילוץ משימות")).toBeTruthy(); // button is usable again
  });
});

describe("sharing into the app from WhatsApp / Gallery", () => {
  test("shared text opens the message tab and is read automatically, exactly once", async () => {
    (global as any).__share = { hasShareIntent: true, shareIntent: { text: "מחר יום פיג'מות בגן" } };
    fetchMock().mockResolvedValue(gemini(SAMPLE));
    await openApp();
    expect(await screen.findByText("יום פיג׳מות בגן")).toBeTruthy();
    await flush();
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(sentBody().contents[0].parts[0].text).toContain("מחר יום פיג'מות בגן");
    expect((global as any).__resetShare).toHaveBeenCalled();
    fireEvent.press(screen.getByText("הוספה ללוח"));
    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(3));
  });

  test("shared screenshot is read from its file and sent as an image", async () => {
    (global as any).__share = {
      hasShareIntent: true,
      shareIntent: { files: [{ path: "/data/user/0/shared.jpg", mimeType: "image/jpeg" }] },
    };
    fetchMock().mockResolvedValue(gemini(SAMPLE));
    await openApp();
    expect(await screen.findByText("יום פיג׳מות בגן")).toBeTruthy();
    // Size unknown for shared files: measured first, then shrunk.
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith("file:///data/user/0/shared.jpg", [], {});
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      "file:///data/user/0/shared.jpg",
      [{ resize: { height: 1600 } }],
      expect.objectContaining({ base64: true })
    );
    expect(sentBody().contents[0].parts[1].inlineData).toEqual({ mimeType: "image/jpeg", data: "/9j/SMALL" });
  });

  test("unreadable shared file gives a clear message", async () => {
    (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValueOnce(new Error("denied"));
    (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error("denied"));
    (global as any).fetch = jest.fn(async (u: string) => {
      if (String(u).startsWith("file:")) throw new Error("no file");
      return gemini(SAMPLE);
    });
    (global as any).__share = { hasShareIntent: true, shareIntent: { files: [{ path: "/x.jpg", mimeType: "image/jpeg" }] } };
    await openApp();
    expect(await screen.findByText(/^לא הצלחתי לקרוא את קובץ התמונה/)).toBeTruthy();
  });
});
