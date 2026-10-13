import { screen, fireEvent, waitFor, within } from "@testing-library/react-native";
import { openApp, FAM, ME, daysFromNow, flush } from "./helpers";
import { tasksOf, seedTask, store } from "./fakeStore";
import { parseUserDate } from "../../src/dates";

const titleInput = () => screen.getByPlaceholderText("משימה חדשה, למשל: להביא 20 ₪ לטיול");
const addBtn = () => screen.getByText("הוספה");

describe("tasks tab", () => {
  test("add a task for tomorrow, kindergarten, assigned to both", async () => {
    await openApp();
    fireEvent.changeText(titleInput(), "להביא 20 ₪ לטיול");
    fireEvent.press(screen.getByText("מחר"));
    fireEvent.press(screen.getAllByText("גן")[0]);
    fireEvent.press(screen.getByText("שנינו"));
    fireEvent.press(addBtn());

    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(1));
    expect(tasksOf(FAM)[0]).toMatchObject({
      title: "להביא 20 ₪ לטיול",
      date: daysFromNow(1),
      time: "",
      cat: "gan",
      who: "both",
      done: false,
      createdBy: ME,
      source: "manual",
    });
    // Shown under the "tomorrow" group, and the form is cleared.
    expect(await screen.findByText(/^מחר 1/)).toBeTruthy();
    expect(screen.getByText("להביא 20 ₪ לטיול")).toBeTruthy();
    expect(titleInput().props.value).toBe("");
  });

  test("typed date and time are saved in the right format", async () => {
    await openApp();
    fireEvent.changeText(titleInput(), "אסיפת הורים");
    fireEvent.changeText(screen.getByPlaceholderText("תאריך 15.10"), "15.10");
    fireEvent.changeText(screen.getByPlaceholderText("שעה 08:30"), "18:30");
    fireEvent.press(screen.getAllByText("בית ספר")[0]);
    fireEvent.press(addBtn());
    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(1));
    expect(tasksOf(FAM)[0]).toMatchObject({ date: parseUserDate("15.10"), time: "18:30", cat: "school", who: ME });
  });

  test("default task: no date, category home, assigned to me", async () => {
    await openApp();
    fireEvent.changeText(titleInput(), "לתקן את הברז");
    fireEvent.press(addBtn());
    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(1));
    expect(tasksOf(FAM)[0]).toMatchObject({ date: "", cat: "home", who: ME });
    expect(await screen.findByText(/^בלי תאריך 1/)).toBeTruthy();
  });

  test("bad date or time is refused with a message", async () => {
    await openApp();
    fireEvent.changeText(titleInput(), "משהו");
    fireEvent.changeText(screen.getByPlaceholderText("תאריך 15.10"), "מחרתיים");
    fireEvent.press(addBtn());
    expect(await screen.findByText("לא הבנתי את התאריך. כתבו למשל 15.10")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("תאריך 15.10"), "");
    fireEvent.changeText(screen.getByPlaceholderText("שעה 08:30"), "8");
    fireEvent.press(addBtn());
    expect(await screen.findByText("כתבו שעה כמו 08:30")).toBeTruthy();
    await flush();
    expect(tasksOf(FAM)).toHaveLength(0);
  });

  test("empty title adds nothing", async () => {
    await openApp();
    fireEvent.changeText(titleInput(), "   ");
    fireEvent.press(addBtn());
    await flush();
    expect(tasksOf(FAM)).toHaveLength(0);
  });

  test("tasks are grouped by when they are due", async () => {
    seedTask(FAM, { title: "איחור", date: daysFromNow(-2) });
    seedTask(FAM, { title: "של היום", date: daysFromNow(0) });
    seedTask(FAM, { title: "של מחר", date: daysFromNow(1) });
    seedTask(FAM, { title: "השבוע", date: daysFromNow(4) });
    seedTask(FAM, { title: "רחוק", date: daysFromNow(30) });
    seedTask(FAM, { title: "פתוח", date: "" });
    await openApp();
    for (const h of [/^באיחור 1/, /^היום 1/, /^מחר 1/, /^בשבוע הקרוב 1/, /^בהמשך 1/, /^בלי תאריך 1/]) {
      expect(screen.getByText(h)).toBeTruthy();
    }
    expect(screen.getByText(/^משימות 6/)).toBeTruthy();
  });

  test("mark done and undo", async () => {
    const id = seedTask(FAM, { title: "לחתום על אישור", date: daysFromNow(0) });
    await openApp();
    fireEvent.press(screen.getAllByRole("checkbox")[0]);
    await waitFor(() => expect(store.tasks[FAM][id].done).toBe(true));
    expect(store.tasks[FAM][id].doneAt).toBeGreaterThan(0);
    expect(await screen.findByText("הכל בוצע 🎉")).toBeTruthy();
    fireEvent.press(screen.getByText(/בוצעו \(1\)/));
    fireEvent.press(screen.getAllByRole("checkbox")[0]);
    await waitFor(() => expect(store.tasks[FAM][id].done).toBe(false));
  });

  test("delete needs a second tap to confirm", async () => {
    seedTask(FAM, { title: "למחיקה" });
    await openApp();
    fireEvent.press(screen.getByText("מחיקה"));
    await flush();
    expect(tasksOf(FAM)).toHaveLength(1);
    fireEvent.press(screen.getByText("למחוק?"));
    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(0));
  });

  test("filters: mine and by category", async () => {
    seedTask(FAM, { title: "המשימה שלי", who: ME, cat: "home" });
    seedTask(FAM, { title: "של שנינו", who: "both", cat: "gan" });
    seedTask(FAM, { title: "של שירה", who: "שירה", cat: "school" });
    await openApp({ members: [ME, "שירה"] });
    fireEvent.press(screen.getByText("שלי"));
    expect(screen.queryByText("של שירה")).toBeNull();
    expect(screen.getByText("המשימה שלי")).toBeTruthy();
    expect(screen.getByText("של שנינו")).toBeTruthy();
    fireEvent.press(screen.getAllByText("גן")[1]); // filter chip (the first is in the form)
    expect(screen.queryByText("של שירה")).toBeNull();
    expect(screen.queryByText("המשימה שלי")).toBeNull();
    expect(screen.getByText("של שנינו")).toBeTruthy();
    fireEvent.press(screen.getByText("הכל"));
    expect(screen.getByText("של שירה")).toBeTruthy();
  });

  test("partner's name appears as an assignee option", async () => {
    await openApp({ members: [ME, "שירה"] });
    fireEvent.changeText(titleInput(), "לקנות מתנה");
    fireEvent.press(screen.getByText("שירה"));
    fireEvent.press(addBtn());
    await waitFor(() => expect(tasksOf(FAM)[0]?.who).toBe("שירה"));
  });

  test("empty board shows how to start", async () => {
    await openApp();
    expect(screen.getByText("עוד אין משימות")).toBeTruthy();
  });
});
