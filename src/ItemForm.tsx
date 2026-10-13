import React from "react";
import { View } from "react-native";
import { T, Input, Chip, s } from "./ui";
import { useTheme } from "./theme";
import { iso } from "./dates";
import { CAT_LABEL, KIND_LABEL, type Cat, type Kind } from "./types";
import type { Draft } from "./items";

const CATS: Cat[] = ["gan", "school", "home", "shop", "other"];

const shown = (date: string) => (/^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split("-").reverse().slice(0, 2).map(Number).join(".") : date);

/** The fields of a task or meeting. Used to add new items and to edit existing ones. */
export default function ItemForm({
  draft,
  onChange,
  people,
  me,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  people: string[];
  me: string;
}) {
  const th = useTheme();
  const set = (p: Partial<Draft>) => onChange({ ...draft, ...p });
  const today = iso(new Date());
  const tomorrow = iso(new Date(Date.now() + 864e5));
  const isEvent = draft.kind === "event";

  return (
    <View style={{ gap: 10 }}>
      <View style={s.row}>
        {(["task", "event"] as Kind[]).map((k) => (
          <Chip key={k} label={(k === "event" ? "📅 " : "✓ ") + KIND_LABEL[k]} on={draft.kind === k} onPress={() => set({ kind: k })} />
        ))}
      </View>
      <Input
        value={draft.title}
        onChangeText={(v) => set({ title: v })}
        placeholder={isEvent ? "פגישה חדשה, למשל: אסיפת הורים" : "משימה חדשה, למשל: להביא 20 ₪ לטיול"}
      />
      <View style={s.row}>
        <Chip label="היום" on={draft.date === today} onPress={() => set({ date: today })} />
        <Chip label="מחר" on={draft.date === tomorrow} onPress={() => set({ date: tomorrow })} />
        <Input value={shown(draft.date)} onChangeText={(v) => set({ date: v })} placeholder="תאריך 15.10" style={{ flex: 1, minWidth: 100 }} />
      </View>
      <View style={s.row}>
        <Input
          value={draft.time}
          onChangeText={(v) => set({ time: v })}
          placeholder={isEvent ? "משעה 18:00" : "שעה 08:30"}
          style={{ width: 110 }}
          keyboardType="numbers-and-punctuation"
        />
        {isEvent ? (
          <Input
            value={draft.endTime}
            onChangeText={(v) => set({ endTime: v })}
            placeholder="עד 19:30"
            style={{ width: 110 }}
            keyboardType="numbers-and-punctuation"
          />
        ) : null}
      </View>
      {isEvent ? <Input value={draft.location} onChangeText={(v) => set({ location: v })} placeholder="מקום, למשל: בכיתה" /> : null}
      <View style={s.row}>
        {CATS.map((c) => (
          <Chip key={c} label={CAT_LABEL[c]} on={draft.cat === c} onPress={() => set({ cat: c })} color={th.cat[c]} />
        ))}
      </View>
      <View style={s.row}>
        <T muted size={14}>אחראי/ת:</T>
        <Chip label="לא שויך" on={draft.who === ""} onPress={() => set({ who: "" })} />
        <Chip label="שנינו" on={draft.who === "both"} onPress={() => set({ who: "both" })} />
        {people.map((p) => (
          <Chip key={p} label={p === me ? p : p} on={draft.who === p} onPress={() => set({ who: p })} />
        ))}
      </View>
    </View>
  );
}
