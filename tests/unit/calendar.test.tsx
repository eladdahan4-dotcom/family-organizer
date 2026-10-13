import { screen, fireEvent, waitFor } from "@testing-library/react-native";
import { openApp, goTab, FAM, daysFromNow, flush } from "./helpers";
import { tasksOf, seedTask, store } from "./fakeStore";
import { fmtDate, iso } from "../../src/dates";

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

/** Another day in the same month as today (so it is visible without moving months). */
function otherDayThisMonth() {
  const d = new Date();
  d.setDate(d.getDate() <= 20 ? d.getDate() + 3 : d.getDate() - 3);
  return iso(d);
}

async function openCalendar(opts?: any) {
  await openApp(opts);
  goTab(/^יומן/);
}

describe("calendar tab", () => {
  test("opens on this month with today selected", async () => {
    await openCalendar();
    const now = new Date();
    expect(screen.getByText(MONTHS[now.getMonth()] + " " + now.getFullYear())).toBeTruthy();
    expect(screen.getByText("היום, " + fmtDate(iso(now)))).toBeTruthy();
    expect(screen.getByText("אין כלום ביום הזה.")).toBeTruthy();
  });

  test("days with items show how many; tapping a day lists meetings first, by time", async () => {
    const day = otherDayThisMonth();
    seedTask(FAM, { title: "להביא עוגה", date: day });
    seedTask(FAM, { kind: "event", title: "מסיבה", date: day, time: "17:00", endTime: "19:00" });
    seedTask(FAM, { kind: "event", title: "חוג בוקר", date: day, time: "09:00" });
    await openCalendar();
    const cell = screen.getByTestId("day-" + day);
    expect(cell.props.accessibilityLabel).toContain("3 פריטים");
    fireEvent.press(cell);
    expect(screen.getByText(fmtDate(day))).toBeTruthy();
    const titles = screen.getAllByText(/^(חוג בוקר|מסיבה|להביא עוגה)$/).map((n) => n.props.children);
    expect(titles).toEqual(["חוג בוקר", "מסיבה", "להביא עוגה"]);
    expect(screen.getByText("17:00–19:00")).toBeTruthy();
  });

  test("items without a date are not on the calendar", async () => {
    seedTask(FAM, { title: "בלי תאריך בכלל" });
    await openCalendar();
    expect(screen.queryByText("בלי תאריך בכלל")).toBeNull();
    expect(screen.getByText("משימות בלי תאריך מופיעות בלשונית ״משימות״.")).toBeTruthy();
  });

  test("move between months and back to today", async () => {
    await openCalendar();
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    fireEvent.press(screen.getByLabelText("החודש הבא"));
    expect(screen.getByText(MONTHS[next.getMonth()] + " " + next.getFullYear())).toBeTruthy();
    fireEvent.press(screen.getByLabelText("חזרה להיום"));
    fireEvent.press(screen.getByLabelText("החודש הקודם"));
    expect(screen.getByText(MONTHS[prev.getMonth()] + " " + prev.getFullYear())).toBeTruthy();
    fireEvent.press(screen.getByLabelText("חזרה להיום"));
    expect(screen.getByText(MONTHS[now.getMonth()] + " " + now.getFullYear())).toBeTruthy();
  });

  test("add a meeting straight onto the chosen day", async () => {
    const day = otherDayThisMonth();
    await openCalendar();
    fireEvent.press(screen.getByTestId("day-" + day));
    fireEvent.press(screen.getByText("+ הוספה ליום הזה"));
    expect(await screen.findByText("פריט חדש")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("פגישה חדשה, למשל: אסיפת הורים"), "רופא שיניים");
    fireEvent.changeText(screen.getByPlaceholderText("משעה 18:00"), "15:30");
    fireEvent.press(screen.getByText("הוספה"));
    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(1));
    expect(tasksOf(FAM)[0]).toMatchObject({ kind: "event", title: "רופא שיניים", date: day, time: "15:30", source: "manual" });
    expect(await screen.findByText("רופא שיניים")).toBeTruthy();
  });

  test("a task can also be added to a day", async () => {
    const day = otherDayThisMonth();
    await openCalendar();
    fireEvent.press(screen.getByTestId("day-" + day));
    fireEvent.press(screen.getByText("+ הוספה ליום הזה"));
    fireEvent.press(screen.getByText("✓ משימה"));
    fireEvent.changeText(screen.getByPlaceholderText("משימה חדשה, למשל: להביא 20 ₪ לטיול"), "לקנות מתנה");
    fireEvent.press(screen.getByText("הוספה"));
    await waitFor(() => expect(tasksOf(FAM)[0]).toMatchObject({ kind: "task", title: "לקנות מתנה", date: day }));
  });

  test("tap an item in the calendar to edit it; moving its date moves it", async () => {
    const id = seedTask(FAM, { kind: "event", title: "אסיפה", date: daysFromNow(0), time: "18:00" });
    await openCalendar();
    fireEvent.press(screen.getByText("אסיפה"));
    expect(await screen.findByText("עריכה")).toBeTruthy();
    fireEvent.press(screen.getByText("מחר"));
    fireEvent.press(screen.getByText("שמירת השינויים"));
    await waitFor(() => expect(store.tasks[FAM][id].date).toBe(daysFromNow(1)));
    await flush();
    expect(screen.queryByText("אסיפה")).toBeNull(); // no longer on today
  });

  test("tick a task as done from the calendar", async () => {
    const id = seedTask(FAM, { title: "לחתום", date: daysFromNow(0) });
    await openCalendar();
    fireEvent.press(screen.getAllByRole("checkbox")[0]);
    await waitFor(() => expect(store.tasks[FAM][id].done).toBe(true));
  });
});
