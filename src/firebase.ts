import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  arrayUnion,
  writeBatch,
  connectFirestoreEmulator,
  Firestore,
} from "firebase/firestore";
import { firebaseConfig, isConfigured } from "./config";
import type { Task, ShopItem } from "./types";

let _db: Firestore | null = null;

// Tests point the app at a local Firestore emulator ("127.0.0.1:8080"); never set in real builds.
const EMULATOR = process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR || "";

export function app() {
  if (getApps().length) return getApp();
  return initializeApp(EMULATOR ? { ...firebaseConfig, projectId: "demo-family" } : firebaseConfig);
}

export function db(): Firestore {
  if (!_db) {
    // Long-polling auto-detect keeps live updates working on Android networks and in WebViews.
    _db = initializeFirestore(app(), { experimentalAutoDetectLongPolling: true });
    if (EMULATOR) {
      const [host, port] = EMULATOR.split(":");
      connectFirestoreEmulator(_db, host, Number(port));
    }
  }
  return _db;
}

export { isConfigured };

const famPath = (fam: string) => "families/" + fam;

export { newFamilyCode, normalizeCode, prettyCode } from "./codes";

export async function createFamily(code: string, name: string) {
  await setDoc(doc(db(), famPath(code)), { createdAt: Date.now(), members: [name] });
}

export async function joinFamily(code: string, name: string): Promise<boolean> {
  const ref = doc(db(), famPath(code));
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  await updateDoc(ref, { members: arrayUnion(name) });
  return true;
}

export function watchFamily(code: string, cb: (members: string[]) => void, onErr?: (e: any) => void) {
  return onSnapshot(
    doc(db(), famPath(code)),
    (s) => cb(((s.data() as any)?.members as string[]) || []),
    onErr
  );
}

export function watchTasks(code: string, cb: (t: Task[]) => void, onErr?: (e: any) => void) {
  return onSnapshot(
    collection(db(), famPath(code) + "/tasks"),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
    onErr
  );
}

export function watchShop(code: string, cb: (t: ShopItem[]) => void, onErr?: (e: any) => void) {
  return onSnapshot(
    collection(db(), famPath(code) + "/shop"),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
    onErr
  );
}

export function addTask(code: string, t: Omit<Task, "id">) {
  return addDoc(collection(db(), famPath(code) + "/tasks"), t);
}

export function updateTask(code: string, id: string, patch: Partial<Task>) {
  return updateDoc(doc(db(), famPath(code) + "/tasks/" + id), patch as any);
}

export function deleteTask(code: string, id: string) {
  return deleteDoc(doc(db(), famPath(code) + "/tasks/" + id));
}

export function addShop(code: string, s: Omit<ShopItem, "id">) {
  return addDoc(collection(db(), famPath(code) + "/shop"), s);
}

export function updateShop(code: string, id: string, patch: Partial<ShopItem>) {
  return updateDoc(doc(db(), famPath(code) + "/shop/" + id), patch as any);
}

export function deleteShop(code: string, id: string) {
  return deleteDoc(doc(db(), famPath(code) + "/shop/" + id));
}

export async function deleteShopMany(code: string, ids: string[]) {
  const b = writeBatch(db());
  ids.forEach((id) => b.delete(doc(db(), famPath(code) + "/shop/" + id)));
  await b.commit();
}

export async function addMany(
  code: string,
  tasks: Omit<Task, "id">[],
  shop: Omit<ShopItem, "id">[]
) {
  const b = writeBatch(db());
  tasks.forEach((t) => b.set(doc(collection(db(), famPath(code) + "/tasks")), t));
  shop.forEach((s) => b.set(doc(collection(db(), famPath(code) + "/shop")), s));
  await b.commit();
}
