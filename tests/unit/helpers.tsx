import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import App from "../../App";
import { seedFamily } from "./fakeStore";
import { iso } from "../../src/dates";

export const FAM = "ABCDEFGHJK2345678XYZ";
export const ME = "אלעד";

/** Opens the app already connected to a family (as after first setup). */
export async function openApp(opts: { members?: string[]; signedIn?: boolean } = {}) {
  if (opts.signedIn !== false) {
    seedFamily(FAM, opts.members || [ME]);
    await AsyncStorage.setItem("family-board:v1", JSON.stringify({ family: FAM, name: ME }));
  } else {
    await AsyncStorage.clear();
  }
  const r = render(<App />);
  if (opts.signedIn !== false) await waitFor(() => expect(screen.getByText(/^\+ הודעה/)).toBeTruthy());
  else await waitFor(() => expect(screen.getByText("ברוכים הבאים ללוח המשפחה")).toBeTruthy());
  return r;
}

export function goTab(label: RegExp) {
  fireEvent.press(screen.getByText(label));
}

export const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

export const flush = () => new Promise((r) => setTimeout(r, 10));
