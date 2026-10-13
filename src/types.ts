export type Cat = "gan" | "school" | "home" | "shop" | "other";

export type Task = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD or ""
  time: string; // HH:MM or ""
  cat: Cat;
  who: string; // "" | "both" | member name
  done: boolean;
  doneAt?: number;
  createdBy: string;
  createdAt: number;
  source?: string;
};

export type ShopItem = {
  id: string;
  name: string;
  qty: string;
  done: boolean;
  createdBy: string;
  createdAt: number;
};

export type Extracted = {
  tasks: { title: string; date: string; time: string; cat: Cat; pick?: boolean }[];
  shopping: { name: string; qty: string; pick?: boolean }[];
  model?: string;
};

export const CAT_LABEL: Record<Cat, string> = {
  gan: "גן",
  school: "בית ספר",
  home: "בית",
  shop: "סופר",
  other: "אחר",
};
