// In-memory stand-in for src/firebase.ts with the same functions and live listeners,
// so screen tests can check exactly what the app writes and where.
type Kind = "family" | "tasks" | "shop";
type Listener = { kind: Kind; fam: string; cb: (x: any) => void };

export const store = {
  families: {} as Record<string, { members: string[] }>,
  tasks: {} as Record<string, Record<string, any>>,
  shop: {} as Record<string, Record<string, any>>,
  listeners: [] as Listener[],
};

let seq = 0;

export function resetStore() {
  store.families = {};
  store.tasks = {};
  store.shop = {};
  store.listeners = [];
  seq = 0;
}

function snap(kind: Kind, fam: string) {
  if (kind === "family") return store.families[fam]?.members || [];
  const col = (kind === "tasks" ? store.tasks : store.shop)[fam] || {};
  return Object.entries(col).map(([id, d]) => ({ id, ...d }));
}

function emit(kind: Kind, fam: string) {
  store.listeners.filter((l) => l.kind === kind && l.fam === fam).forEach((l) => l.cb(snap(kind, fam)));
}

function col(kind: "tasks" | "shop", fam: string) {
  const root = kind === "tasks" ? store.tasks : store.shop;
  if (!store.families[fam]) throw new Error("family does not exist: " + fam);
  return (root[fam] = root[fam] || {});
}

function watch(kind: Kind) {
  return (fam: string, cb: (x: any) => void) => {
    const l = { kind, fam, cb };
    store.listeners.push(l);
    cb(snap(kind, fam));
    return () => {
      store.listeners = store.listeners.filter((x) => x !== l);
    };
  };
}

/** Seeds a family directly (as if created earlier). */
export function seedFamily(code: string, members: string[] = []) {
  store.families[code] = { members };
}

export function seedTask(fam: string, t: Record<string, any>) {
  const id = "t" + ++seq;
  col("tasks", fam)[id] = { title: "", date: "", time: "", cat: "home", who: "", done: false, createdBy: "", createdAt: seq, ...t };
  return id;
}

export function seedShop(fam: string, s: Record<string, any>) {
  const id = "s" + ++seq;
  col("shop", fam)[id] = { name: "", qty: "", done: false, createdBy: "", createdAt: seq, ...s };
  return id;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

export function makeFakeFirebase(actual: any) {
  return {
    isConfigured: true,
    newFamilyCode: actual.newFamilyCode,
    normalizeCode: actual.normalizeCode,
    prettyCode: actual.prettyCode,
    createFamily: jest.fn(async (code: string, name: string) => {
      await tick();
      store.families[code] = { members: [name] };
      emit("family", code);
    }),
    joinFamily: jest.fn(async (code: string, name: string) => {
      await tick();
      if (!store.families[code]) return false;
      if (!store.families[code].members.includes(name)) store.families[code].members.push(name);
      emit("family", code);
      return true;
    }),
    watchFamily: jest.fn(watch("family")),
    watchTasks: jest.fn(watch("tasks")),
    watchShop: jest.fn(watch("shop")),
    addTask: jest.fn(async (fam: string, t: any) => {
      await tick();
      col("tasks", fam)["t" + ++seq] = { ...t };
      emit("tasks", fam);
    }),
    updateTask: jest.fn(async (fam: string, id: string, patch: any) => {
      await tick();
      Object.assign(col("tasks", fam)[id], patch);
      emit("tasks", fam);
    }),
    deleteTask: jest.fn(async (fam: string, id: string) => {
      await tick();
      delete col("tasks", fam)[id];
      emit("tasks", fam);
    }),
    addShop: jest.fn(async (fam: string, s: any) => {
      await tick();
      col("shop", fam)["s" + ++seq] = { ...s };
      emit("shop", fam);
    }),
    updateShop: jest.fn(async (fam: string, id: string, patch: any) => {
      await tick();
      Object.assign(col("shop", fam)[id], patch);
      emit("shop", fam);
    }),
    deleteShop: jest.fn(async (fam: string, id: string) => {
      await tick();
      delete col("shop", fam)[id];
      emit("shop", fam);
    }),
    deleteShopMany: jest.fn(async (fam: string, ids: string[]) => {
      await tick();
      ids.forEach((id) => delete col("shop", fam)[id]);
      emit("shop", fam);
    }),
    addMany: jest.fn(async (fam: string, tasks: any[], shop: any[]) => {
      await tick();
      tasks.forEach((t) => (col("tasks", fam)["t" + ++seq] = { ...t }));
      shop.forEach((s) => (col("shop", fam)["s" + ++seq] = { ...s }));
      emit("tasks", fam);
      emit("shop", fam);
    }),
  };
}

export const tasksOf = (fam: string) => Object.values(store.tasks[fam] || {});
export const shopOf = (fam: string) => Object.values(store.shop[fam] || {});
