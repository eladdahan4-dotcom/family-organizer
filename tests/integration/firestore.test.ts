/**
 * Runs the app's real data code (src/firebase.ts) against a local Firestore emulator
 * that enforces the real firestore.rules. Checks that every action writes to the right
 * place, that two devices see each other's changes, and that the rules block abuse.
 */
import {
  db,
  createFamily,
  joinFamily,
  watchTasks,
  watchShop,
  watchFamily,
  addTask,
  updateTask,
  deleteTask,
  addShop,
  updateShop,
  deleteShop,
  deleteShopMany,
  addMany,
  newFamilyCode,
} from "../../src/firebase";
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, terminate } from "firebase/firestore";

const EMU = process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR;
if (!EMU) throw new Error("EXPO_PUBLIC_FIRESTORE_EMULATOR must be set (run through `npm run test:integration`)");
const BASE = `http://${EMU}/v1/projects/demo-family/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner" }; // emulator-only: bypasses rules for checking

/** Reads a collection as an administrator, to check what really got stored. */
async function adminList(path: string): Promise<Record<string, any>[]> {
  const r = await fetch(`${BASE}/${path}`, { headers: ADMIN });
  const j: any = await r.json();
  return (j.documents || []).map((d: any) => {
    const out: any = { _id: d.name.split("/").pop() };
    for (const [k, v] of Object.entries<any>(d.fields || {})) {
      out[k] = v.stringValue ?? (v.booleanValue !== undefined ? v.booleanValue : v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue ?? v.arrayValue?.values?.map((x: any) => x.stringValue));
    }
    return out;
  });
}

async function adminWrite(path: string, fields: Record<string, string>) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { stringValue: v }])) };
  await fetch(`${BASE}/${path}`, { method: "PATCH", headers: { ...ADMIN, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

const waitFor = async (fn: () => boolean, ms = 5000) => {
  const t = Date.now();
  while (!fn()) {
    if (Date.now() - t > ms) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 50));
  }
};

const task = (title: string, extra: any = {}) => ({
  title,
  date: "2026-10-15",
  time: "",
  cat: "gan" as const,
  who: "",
  done: false,
  createdBy: "אלעד",
  createdAt: Date.now(),
  source: "manual",
  ...extra,
});

let FAM: string;

beforeEach(async () => {
  FAM = newFamilyCode();
  await createFamily(FAM, "אלעד");
});

afterAll(async () => {
  await terminate(db());
});

describe("family board in the real database", () => {
  test("creating and joining a family records both members", async () => {
    expect(await joinFamily(FAM, "שירה")).toBe(true);
    expect(await joinFamily(FAM, "שירה")).toBe(true); // joining twice does not duplicate
    const fam = await getDoc(doc(db(), "families/" + FAM));
    expect(fam.data()!.members).toEqual(["אלעד", "שירה"]);
  });

  test("joining with a code that does not exist fails", async () => {
    expect(await joinFamily(newFamilyCode(), "שירה")).toBe(false);
  });

  test("a task is stored under families/<code>/tasks with every field", async () => {
    await addTask(FAM, task("להביא 25 ₪ לטיול", { who: "both", time: "08:00" }));
    const rows = await adminList(`families/${FAM}/tasks`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "להביא 25 ₪ לטיול", date: "2026-10-15", time: "08:00", cat: "gan", who: "both", done: false, createdBy: "אלעד", source: "manual" });
    expect(await adminList(`families/${FAM}/shop`)).toHaveLength(0);
  });

  test("mark done and delete a task", async () => {
    await addTask(FAM, task("לחתום"));
    const [{ _id }] = await adminList(`families/${FAM}/tasks`);
    await updateTask(FAM, _id, { done: true, doneAt: 123 });
    expect((await adminList(`families/${FAM}/tasks`))[0]).toMatchObject({ done: true, doneAt: 123 });
    await deleteTask(FAM, _id);
    expect(await adminList(`families/${FAM}/tasks`)).toHaveLength(0);
  });

  test("shopping items go to families/<code>/shop and can be cleared", async () => {
    await addShop(FAM, { name: "חלב", qty: "2", done: false, createdBy: "אלעד", createdAt: 1 });
    await addShop(FAM, { name: "לחם", qty: "", done: false, createdBy: "אלעד", createdAt: 2 });
    let rows = await adminList(`families/${FAM}/shop`);
    expect(rows.map((r) => r.name).sort()).toEqual(["חלב", "לחם"]);
    const milk = rows.find((r) => r.name === "חלב")!;
    await updateShop(FAM, milk._id, { done: true });
    await deleteShopMany(FAM, [milk._id]);
    rows = await adminList(`families/${FAM}/shop`);
    expect(rows.map((r) => r.name)).toEqual(["לחם"]);
    await deleteShop(FAM, rows[0]._id);
    expect(await adminList(`families/${FAM}/shop`)).toHaveLength(0);
    expect(await adminList(`families/${FAM}/tasks`)).toHaveLength(0);
  });

  test("items extracted from a message are split into tasks and shopping in one save", async () => {
    await addMany(
      FAM,
      [task("יום פיג׳מות", { source: "message" }), task("אסיפת הורים", { cat: "school", source: "message" })],
      [{ name: "במבה", qty: "1", done: false, createdBy: "אלעד", createdAt: 1 }]
    );
    const tasks = await adminList(`families/${FAM}/tasks`);
    expect(tasks.map((t) => t.title).sort()).toEqual(["אסיפת הורים", "יום פיג׳מות"]);
    expect(tasks.every((t) => t.source === "message")).toBe(true);
    expect((await adminList(`families/${FAM}/shop`)).map((s) => s.name)).toEqual(["במבה"]);
  });

  test("live updates: a change from the other phone appears immediately", async () => {
    let seenTasks: any[] = [];
    let seenShop: any[] = [];
    let members: string[] = [];
    const u1 = watchTasks(FAM, (t) => (seenTasks = t));
    const u2 = watchShop(FAM, (s) => (seenShop = s));
    const u3 = watchFamily(FAM, (m) => (members = m));
    await adminWrite(`families/${FAM}/tasks/fromOther`, { title: "נוסף מהטלפון של שירה", date: "", cat: "home" });
    await adminWrite(`families/${FAM}/shop/fromOther`, { name: "ביצים" });
    await joinFamily(FAM, "שירה");
    await waitFor(() => seenTasks.some((t) => t.title === "נוסף מהטלפון של שירה"));
    await waitFor(() => seenShop.some((s) => s.name === "ביצים"));
    await waitFor(() => members.includes("שירה"));
    u1();
    u2();
    u3();
  });

  test("families are separate from each other", async () => {
    const other = newFamilyCode();
    await createFamily(other, "משפחה אחרת");
    await addTask(other, task("של משפחה אחרת"));
    expect(await adminList(`families/${FAM}/tasks`)).toHaveLength(0);
  });
});

describe("security rules", () => {
  const denied = async (p: Promise<any>) => {
    await expect(p).rejects.toMatchObject({ code: "permission-denied" });
  };

  test("nobody can list all families", async () => {
    await denied(getDocs(collection(db(), "families")));
  });

  test("a short or guessable code cannot be created", async () => {
    await denied(setDoc(doc(db(), "families/ABC"), { members: ["x"] }));
  });

  test("a family board cannot be deleted from the app", async () => {
    await denied(deleteDoc(doc(db(), "families/" + FAM)));
  });

  test("only tasks and shop lists exist inside a family", async () => {
    await denied(setDoc(doc(db(), `families/${FAM}/secrets/x`), { a: 1 }));
  });

  test("cannot write tasks into a family that does not exist", async () => {
    await denied(setDoc(doc(db(), `families/${newFamilyCode()}/tasks/x`), { title: "spam" }));
  });

  test("with the right code, reading and writing works", async () => {
    await setDoc(doc(db(), `families/${FAM}/tasks/ok`), task("מותר"));
    const s = await getDocs(collection(db(), `families/${FAM}/tasks`));
    expect(s.docs.map((d) => d.id)).toContain("ok");
  });
});
