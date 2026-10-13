export type Cat = "gan" | "school" | "home" | "shop" | "other";
export type Kind = "task" | "event";

/** A task (something to do) or an event/meeting (something that happens at a time). */
export type Task = {
  id: string;
  kind?: Kind; // missing on items saved before meetings existed = "task"
  title: string;
  date: string; // YYYY-MM-DD or ""
  time: string; // HH:MM or "" (start time for events)
  endTime?: string; // HH:MM or "" (events only)
  location?: string; // events only
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

export type ExtractedTask = {
  kind: Kind;
  title: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  cat: Cat;
  who?: string; // set when the person picks someone while fixing the preview
  pick?: boolean;
};

export type Extracted = {
  tasks: ExtractedTask[];
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

export const KIND_LABEL: Record<Kind, string> = { task: "משימה", event: "פגישה" };

export const kindOf = (t: { kind?: Kind }): Kind => (t.kind === "event" ? "event" : "task");
