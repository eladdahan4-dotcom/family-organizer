import { screen, fireEvent, waitFor } from "@testing-library/react-native";
import { openApp, FAM, ME, daysFromNow, flush } from "./helpers";
import { tasksOf, seedTask, store } from "./fakeStore";
import { parseUserDate } from "../../src/dates";

const TASK_PH = "משימה חדשה, למשל: להביא 20 ₪ לטיול";
const EVENT_PH = "פגישה חדשה, למשל: אסיפת הורים";
const titleInput = () => screen.getAllByPlaceholderText(TASK_PH)[0];
const addBtn = () => screen.getAllByText("הוספה")[0];

describe("tasks tab: adding", () => {
  test("add a task for tomorrow, kindergarten, assigned to both", async () => {
    await openApp();
    fireEvent.changeText(titleInput(), "להביא 20 ₪ לטיול");
    fireEvent.press(screen.getByText("מחר"));
    fireEvent.press(screen.getAllByText("גן")[0]);
    fireEvent.press(screen.getByText("שנינו"));
    fireEvent.press(addBtn());

    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(1));
    expect(tasksOf(FAM)[0]).toMatchObject({
      kind: "task",
      title: "להביא 20 ₪ לטיול",
      date: daysFromNow(1),
      time: "",
      cat: "gan",
      who: "both",
      done: false,
      createdBy: ME,
      source: "manual",
    });
    expect(await screen.findByText(/^מחר 1/)).toBeTruthy();
    expect(screen.getByText("להביא 20 ₪ לטיול")).toBeTruthy();
    expect(titleInput().props.value).toBe("");
  });

  test("typed date and time are saved in the right format", async () => {
    await openApp();
    fireEvent.changeText(titleInput(), "לשלם על החוג");
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
    expect(tasksOf(FAM)[0]).toMatchObject({ kind: "task", date: "", cat: "home", who: ME });
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

  test("partner's name appears as an assignee option", async () => {
    await openApp({ members: [ME, "שירה"] });
    fireEvent.changeText(titleInput(), "לקנות מתנה");
    fireEvent.press(screen.getByText("שירה"));
    fireEvent.press(addBtn());
    await waitFor(() => expect(tasksOf(FAM)[0]?.who).toBe("שירה"));
  });
});

describe("meetings", () => {
  test("add a meeting with start, end and place", async () => {
    await openApp();
    fireEvent.press(screen.getByText("📅 פגישה"));
    fireEvent.changeText(screen.getByPlaceholderText(EVENT_PH), "אסיפת הורים");
    fireEvent.press(screen.getByText("מחר"));
    fireEvent.changeText(screen.getByPlaceholderText("משעה 18:00"), "18:30");
    fireEvent.changeText(screen.getByPlaceholderText("עד 19:30"), "19:30");
    fireEvent.changeText(screen.getByPlaceholderText("מקום, למשל: בכיתה"), "בכיתה");
    fireEvent.press(screen.getAllByText("בית ספר")[0]);
    fireEvent.press(addBtn());

    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(1));
    expect(tasksOf(FAM)[0]).toMatchObject({
      kind: "event",
      title: "אסיפת הורים",
      date: daysFromNow(1),
      time: "18:30",
      endTime: "19:30",
      location: "בכיתה",
      cat: "school",
    });
    expect(await screen.findByText("18:30–19:30")).toBeTruthy();
    expect(screen.getByText("📍 בכיתה")).toBeTruthy();
    expect(screen.getByLabelText("פגישה")).toBeTruthy(); // calendar icon instead of a checkbox
  });

  test("a meeting needs a date, and must end after it starts", async () => {
    await openApp();
    fireEvent.press(screen.getByText("📅 פגישה"));
    fireEvent.changeText(screen.getByPlaceholderText(EVENT_PH), "רופא");
    fireEvent.press(addBtn());
    expect(await screen.findByText("לפגישה צריך תאריך.")).toBeTruthy();
    fireEvent.press(screen.getByText("מחר"));
    fireEvent.changeText(screen.getByPlaceholderText("משעה 18:00"), "10:00");
    fireEvent.changeText(screen.getByPlaceholderText("עד 19:30"), "09:00");
    fireEvent.press(addBtn());
    expect(await screen.findByText("שעת הסיום צריכה להיות אחרי שעת ההתחלה.")).toBeTruthy();
    await flush();
    expect(tasksOf(FAM)).toHaveLength(0);
  });

  test("past meetings are not 'late' and not counted, but can be seen", async () => {
    seedTask(FAM, { kind: "event", title: "אסיפה שהייתה", date: daysFromNow(-2), time: "18:00" });
    seedTask(FAM, { kind: "task", title: "משימה שאיחרה", date: daysFromNow(-2) });
    await openApp();
    expect(screen.getByText(/^באיחור 1/)).toBeTruthy();
    expect(screen.queryByText("אסיפה שהייתה")).toBeNull();
    expect(screen.getByText(/^משימות 1/)).toBeTruthy();
    fireEvent.press(screen.getByText(/פגישות שעברו \(1\)/));
    expect(screen.getByText("אסיפה שהייתה")).toBeTruthy();
  });

  test("filter: meetings only", async () => {
    seedTask(FAM, { kind: "event", title: "חוג", date: daysFromNow(2), time: "16:00" });
    seedTask(FAM, { kind: "task", title: "לשלם", date: daysFromNow(2) });
    await openApp();
    fireEvent.press(screen.getByText("פגישות"));
    expect(screen.getByText("חוג")).toBeTruthy();
    expect(screen.queryByText("לשלם")).toBeNull();
  });
});

describe("editing after saving", () => {
  test("tap an item, change its title, date and category, save", async () => {
    const id = seedTask(FAM, { title: "לחתום על אישור", date: daysFromNow(1), cat: "home" });
    await openApp();
    fireEvent.press(screen.getByText("לחתום על אישור"));
    expect(await screen.findByText("עריכה")).toBeTruthy();
    const modalTitle = screen.getAllByPlaceholderText(TASK_PH)[1];
    expect(modalTitle.props.value).toBe("לחתום על אישור");
    fireEvent.changeText(modalTitle, "לחתום על אישור טיול");
    fireEvent.changeText(screen.getAllByPlaceholderText("תאריך 15.10")[1], "");
    fireEvent.press(screen.getAllByText("בית ספר").slice(-1)[0]); // the chip in the edit window
    fireEvent.press(screen.getByText("שמירת השינויים"));
    await waitFor(() => expect(store.tasks[FAM][id]).toMatchObject({ title: "לחתום על אישור טיול", date: "", cat: "school" }));
    await waitFor(() => expect(screen.queryByText("עריכה")).toBeNull());
    expect(screen.getByText("לחתום על אישור טיול")).toBeTruthy();
  });

  test("turn a task into a meeting", async () => {
    const id = seedTask(FAM, { title: "יום הולדת לנועה", date: daysFromNow(4) });
    await openApp();
    fireEvent.press(screen.getByText("יום הולדת לנועה"));
    fireEvent.press(screen.getAllByText("📅 פגישה")[1]);
    fireEvent.changeText(screen.getAllByPlaceholderText("משעה 18:00")[0], "17:00");
    fireEvent.changeText(screen.getAllByPlaceholderText("מקום, למשל: בכיתה")[0], "גן שעשועים");
    fireEvent.press(screen.getByText("שמירת השינויים"));
    await waitFor(() => expect(store.tasks[FAM][id]).toMatchObject({ kind: "event", time: "17:00", location: "גן שעשועים" }));
  });

  test("a mistake while editing is explained and nothing is saved", async () => {
    const id = seedTask(FAM, { title: "משהו", date: daysFromNow(1) });
    await openApp();
    fireEvent.press(screen.getByText("משהו"));
    fireEvent.changeText(screen.getAllByPlaceholderText("שעה 08:30")[1], "25");
    fireEvent.press(screen.getByText("שמירת השינויים"));
    expect(await screen.findByText("כתבו שעה כמו 08:30")).toBeTruthy();
    expect(store.tasks[FAM][id].time).toBe("");
  });

  test("cancel keeps everything as it was", async () => {
    const id = seedTask(FAM, { title: "בלי שינוי" });
    await openApp();
    fireEvent.press(screen.getByText("בלי שינוי"));
    fireEvent.changeText(screen.getAllByPlaceholderText(TASK_PH)[1], "שונה");
    fireEvent.press(screen.getByText("ביטול"));
    await flush();
    expect(store.tasks[FAM][id].title).toBe("בלי שינוי");
  });

  test("delete from the edit window needs a second tap", async () => {
    seedTask(FAM, { title: "למחיקה" });
    await openApp();
    fireEvent.press(screen.getByText("למחיקה"));
    fireEvent.press(screen.getByText("מחיקה"));
    await flush();
    expect(tasksOf(FAM)).toHaveLength(1);
    fireEvent.press(screen.getByText("בטוח? לחצו שוב למחיקה"));
    await waitFor(() => expect(tasksOf(FAM)).toHaveLength(0));
  });
});

describe("tasks tab: list", () => {
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

  test("empty board shows how to start", async () => {
    await openApp();
    expect(screen.getByText("עוד אין משימות")).toBeTruthy();
  });
});
