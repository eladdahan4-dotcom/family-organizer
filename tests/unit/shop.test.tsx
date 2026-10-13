import { screen, fireEvent, waitFor } from "@testing-library/react-native";
import { openApp, goTab, FAM, ME } from "./helpers";
import { shopOf, seedShop, store } from "./fakeStore";

describe("shopping tab", () => {
  test("add an item with quantity", async () => {
    await openApp();
    goTab(/^קניות/);
    fireEvent.changeText(screen.getByPlaceholderText("מה צריך לקנות? למשל: חלב 3%"), "חלב 3%");
    fireEvent.changeText(screen.getByPlaceholderText("כמות"), "2");
    fireEvent.press(screen.getByText("הוספה"));
    await waitFor(() => expect(shopOf(FAM)).toHaveLength(1));
    expect(shopOf(FAM)[0]).toMatchObject({ name: "חלב 3%", qty: "2", done: false, createdBy: ME });
    expect(await screen.findByText("חלב 3%")).toBeTruthy();
    expect(screen.getByText(/^קניות 1/)).toBeTruthy();
  });

  test("tick bought items and clear only them", async () => {
    const a = seedShop(FAM, { name: "לחם" });
    const b = seedShop(FAM, { name: "ביצים" });
    await openApp();
    goTab(/^קניות/);
    fireEvent.press(screen.getAllByRole("checkbox")[0]);
    await waitFor(() => expect(store.shop[FAM][a].done).toBe(true));
    fireEvent.press(await screen.findByText("ניקוי מה שנקנה"));
    await waitFor(() => expect(shopOf(FAM)).toHaveLength(1));
    expect(store.shop[FAM][b]).toBeTruthy();
    expect(store.shop[FAM][a]).toBeUndefined();
  });

  test("empty list explains what to do", async () => {
    await openApp();
    goTab(/^קניות/);
    expect(screen.getByText("הרשימה ריקה")).toBeTruthy();
  });
});
