import { screen, fireEvent, waitFor, render } from "@testing-library/react-native";
import React from "react";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
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
    { title: "יום פיג׳מות בגן", date: daysFromNow(2), time: "", cat: "gan" },
    { title: "לשלוח 25 ₪ לטיול", date: daysFromNow(1), time: "", cat: "gan" },
    { title: "אסיפת הורים", date: daysFromNow(5), time: "18:30", cat: "school" },
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

    // Untick the parents' meeting.
    fireEvent.press(screen.getByText("אסיפת הורים"));
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

  test("image from the gallery is sent with its data and real type", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///pic.png", base64: "iVBORw0KGgoPNGDATA", mimeType: "image/png" }],
    });
    fetchMock().mockResolvedValueOnce(gemini(SAMPLE));
    await openAddTab();
    fireEvent.press(screen.getByText("📷 תמונה מהגלריה"));
    expect(await screen.findByText("הסרת התמונה")).toBeTruthy();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ base64: true }));

    fireEvent.press(screen.getByText("חילוץ משימות"));
    expect(await screen.findByText("יום פיג׳מות בגן")).toBeTruthy();
    const parts = sentBody().contents[0].parts;
    expect(parts[1]).toEqual({ inlineData: { mimeType: "image/png", data: "iVBORw0KGgoPNGDATA" } });
    expect(parts[0].text).toContain("An image is attached");

    fireEvent.press(screen.getByText("הוספה ללוח"));
    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(3));
  });

  test("image + text together are both sent", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///p.jpg", base64: "/9j/JPEGDATA", mimeType: "image/jpeg" }],
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
    expect(parts[1].inlineData).toEqual({ mimeType: "image/jpeg", data: "/9j/JPEGDATA" });
  });

  test("when the gallery gives no base64 the file is read from disk", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///nob64.jpg", mimeType: "image/jpeg" }],
    });
    fetchMock().mockResolvedValueOnce(gemini(SAMPLE));
    await openAddTab();
    fireEvent.press(screen.getByText("📷 תמונה מהגלריה"));
    await screen.findByText("הסרת התמונה");
    fireEvent.press(screen.getByText("חילוץ משימות"));
    await screen.findByText("הוספה ללוח");
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith("file:///nob64.jpg", expect.anything());
    expect(sentBody().contents[0].parts[1].inlineData.data).toBe("/9j/FROMFILE");
  });

  test("removing the image sends text only", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///p.jpg", base64: "/9j/X" }],
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
      assets: [{ uri: "file:///cam.jpg", base64: "/9j/CAM" }],
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
    ["quota", { ok: false, status: 429, text: async () => "{}" }, "הגעתם למגבלת השימוש בחילוץ החכם. נסו שוב בעוד כמה דקות."],
    ["setup", { ok: false, status: 403, text: async () => "PERMISSION_DENIED" }, /^החילוץ החכם לא מופעל בפרויקט Firebase/],
    ["server", { ok: false, status: 500, text: async () => "oops" }, /^החילוץ לא הצליח\. נסו שוב\./],
  ])("error: %s", async (_n, response, message) => {
    fetchMock().mockResolvedValueOnce(response);
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
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith("file:///data/user/0/shared.jpg", expect.anything());
    expect(sentBody().contents[0].parts[1].inlineData).toEqual({ mimeType: "image/jpeg", data: "/9j/FROMFILE" });
  });

  test("unreadable shared file gives a clear message", async () => {
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
