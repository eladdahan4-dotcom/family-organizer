import { screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { openApp, goTab, ME } from "./helpers";

describe("settings tab", () => {
  test("shows who is on the board and the family code", async () => {
    await openApp({ members: [ME, "שירה"] });
    goTab(/^הגדרות/);
    expect(screen.getByText("אלעד, שירה")).toBeTruthy();
    expect(screen.getByText("ABCDE-FGHJK-23456-78XYZ")).toBeTruthy();
  });

  test("invite sends the code through the phone's share sheet", async () => {
    const spy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as any);
    await openApp();
    goTab(/^הגדרות/);
    fireEvent.press(screen.getByText("שליחת הזמנה"));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls[0][0].message).toContain("קוד המשפחה: ABCDE-FGHJK-23456-78XYZ");
  });

  test("leaving needs confirmation and returns to the welcome screen", async () => {
    await openApp();
    goTab(/^הגדרות/);
    fireEvent.press(screen.getByText("התנתקות מהלוח במכשיר הזה"));
    fireEvent.press(screen.getByText("ביטול"));
    expect(screen.getByText("התנתקות מהלוח במכשיר הזה")).toBeTruthy();
    fireEvent.press(screen.getByText("התנתקות מהלוח במכשיר הזה"));
    fireEvent.press(screen.getByText("כן, להתנתק"));
    expect(await screen.findByText("ברוכים הבאים ללוח המשפחה")).toBeTruthy();
    await waitFor(async () => expect(await AsyncStorage.getItem("family-board:v1")).toBeNull());
  });
});
