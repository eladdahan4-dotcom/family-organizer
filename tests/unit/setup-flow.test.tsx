import AsyncStorage from "@react-native-async-storage/async-storage";
import { screen, fireEvent, waitFor, render } from "@testing-library/react-native";
import React from "react";
import App from "../../App";
import { openApp, FAM } from "./helpers";
import { store, seedFamily } from "./fakeStore";

describe("first launch: creating or joining a family board", () => {
  test("create a new board: stores the family with my name and opens the tabs", async () => {
    await openApp({ signedIn: false });
    fireEvent.changeText(screen.getByPlaceholderText("למשל: אלעד"), "  אלעד  ");
    fireEvent.press(screen.getByText("יצירת לוח חדש למשפחה"));
    await waitFor(() => expect(screen.getByText(/^\+ הודעה/)).toBeTruthy());

    const codes = Object.keys(store.families);
    expect(codes).toHaveLength(1);
    expect(codes[0]).toMatch(/^[A-Z2-9]{20}$/);
    expect(store.families[codes[0]].members).toEqual(["אלעד"]);
    expect(JSON.parse((await AsyncStorage.getItem("family-board:v1"))!)).toEqual({ family: codes[0], name: "אלעד" });
  });

  test("name is required", async () => {
    await openApp({ signedIn: false });
    fireEvent.press(screen.getByText("יצירת לוח חדש למשפחה"));
    expect(await screen.findByText("כתבו קודם את השם שלכם.")).toBeTruthy();
    expect(Object.keys(store.families)).toHaveLength(0);
  });

  test("join an existing board with a code typed with dashes and lowercase", async () => {
    seedFamily(FAM, ["אלעד"]);
    await openApp({ signedIn: false });
    fireEvent.changeText(screen.getByPlaceholderText("למשל: אלעד"), "שירה");
    fireEvent.press(screen.getByText("יש לי קוד משפחה, הצטרפות ללוח קיים"));
    fireEvent.changeText(screen.getByPlaceholderText("XXXXX-XXXXX-XXXXX-XXXXX"), "abcde-fghjk-23456-78xyz");
    fireEvent.press(screen.getByText("הצטרפות"));
    await waitFor(() => expect(screen.getByText(/^\+ הודעה/)).toBeTruthy());
    expect(store.families[FAM].members).toEqual(["אלעד", "שירה"]);
  });

  test("wrong code shows a clear message and does not join", async () => {
    await openApp({ signedIn: false });
    fireEvent.changeText(screen.getByPlaceholderText("למשל: אלעד"), "שירה");
    fireEvent.press(screen.getByText("יש לי קוד משפחה, הצטרפות ללוח קיים"));
    fireEvent.changeText(screen.getByPlaceholderText("XXXXX-XXXXX-XXXXX-XXXXX"), "ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ");
    fireEvent.press(screen.getByText("הצטרפות"));
    expect(await screen.findByText("לא מצאתי לוח עם הקוד הזה. בדקו שהעתקתם אותו נכון.")).toBeTruthy();
  });

  test("too short code is rejected before contacting the server", async () => {
    await openApp({ signedIn: false });
    fireEvent.changeText(screen.getByPlaceholderText("למשל: אלעד"), "שירה");
    fireEvent.press(screen.getByText("יש לי קוד משפחה, הצטרפות ללוח קיים"));
    fireEvent.changeText(screen.getByPlaceholderText("XXXXX-XXXXX-XXXXX-XXXXX"), "ABC");
    fireEvent.press(screen.getByText("הצטרפות"));
    expect(await screen.findByText("קוד המשפחה קצר מדי. העתיקו אותו בדיוק כפי שקיבלתם.")).toBeTruthy();
  });

  test("reopening the app goes straight to the board", async () => {
    await openApp();
    screen.unmount();
    render(<App />);
    await waitFor(() => expect(screen.getByText(/^\+ הודעה/)).toBeTruthy());
    expect(screen.queryByText("ברוכים הבאים ללוח המשפחה")).toBeNull();
  });
});
