import AsyncStorage from "@react-native-async-storage/async-storage";

export type Local = { family: string; name: string };

const KEY = "family-board:v1";

export async function loadLocal(): Promise<Local | null> {
  try {
    const s = await AsyncStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export async function saveLocal(v: Local | null) {
  try {
    if (v) await AsyncStorage.setItem(KEY, JSON.stringify(v));
    else await AsyncStorage.removeItem(KEY);
  } catch {}
}
