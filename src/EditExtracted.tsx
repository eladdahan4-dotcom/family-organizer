import React, { useEffect, useState } from "react";
import { Modal, View, ScrollView, Pressable } from "react-native";
import { T, Btn, Input, s } from "./ui";
import { useTheme } from "./theme";
import ItemForm from "./ItemForm";
import { checkDraft, emptyDraft, type Draft } from "./items";
import type { ExtractedTask } from "./types";

export type Target =
  | { type: "task"; index: number; item: ExtractedTask & { who?: string } }
  | { type: "shop"; index: number; item: { name: string; qty: string } };

/**
 * Fixes what the AI understood, before anything is saved to the board.
 * Changes go back into the preview list; nothing is written to the database here.
 */
export default function EditExtracted({
  target,
  people,
  me,
  onSaveTask,
  onSaveShop,
  onRemove,
  onClose,
}: {
  target: Target | null;
  people: string[];
  me: string;
  onSaveTask: (index: number, t: ExtractedTask & { who: string }) => void;
  onSaveShop: (index: number, s: { name: string; qty: string }) => void;
  onRemove: (target: Target) => void;
  onClose: () => void;
}) {
  const th = useTheme();
  const [draft, setDraft] = useState<Draft>(emptyDraft(me));
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [msg, setMsg] = useState("");
  // Keep the last target while the window slides closed (target becomes null right away).
  const [shown, setShown] = useState<Target | null>(target);

  useEffect(() => {
    if (!target) return;
    setShown(target);
    setMsg("");
    if (target.type === "task") {
      const t = target.item;
      setDraft({ kind: t.kind, title: t.title, date: t.date, time: t.time, endTime: t.endTime, location: t.location, cat: t.cat, who: t.who || "" });
    } else {
      setName(target.item.name);
      setQty(target.item.qty);
    }
  }, [target]);

  const save = () => {
    if (!target) return;
    if (target.type === "task") {
      const c = checkDraft(draft);
      if (!c.ok) return setMsg(c.msg);
      const f = c.fields;
      onSaveTask(target.index, {
        kind: f.kind || "task",
        title: f.title,
        date: f.date,
        time: f.time,
        endTime: f.endTime || "",
        location: f.location || "",
        cat: f.cat,
        who: f.who,
        pick: true,
      });
    } else {
      if (!name.trim()) return setMsg("כתבו מה לקנות.");
      onSaveShop(target.index, { name: name.trim(), qty: qty.trim() });
    }
    onClose();
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} accessibilityLabel="סגירה" />
      <View style={{ backgroundColor: th.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "88%", direction: "rtl" }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
          <T bold size={19}>תיקון לפני הוספה</T>
          {(target || shown)?.type === "task" ? (
            <ItemForm draft={draft} onChange={setDraft} people={people} me={me} />
          ) : (
            <View style={s.row}>
              <Input value={name} onChangeText={setName} placeholder="מה לקנות" style={{ flex: 1, minWidth: 160 }} />
              <Input value={qty} onChangeText={setQty} placeholder="כמות" style={{ width: 80 }} />
            </View>
          )}
          {msg ? (
            <View style={{ backgroundColor: th.soft, borderRadius: 10, padding: 10 }}>
              <T size={14}>{msg}</T>
            </View>
          ) : null}
          <Btn label="עדכון" onPress={save} />
          <Btn label="ביטול" ghost onPress={onClose} />
          {target ? (
            <Btn
              label="להוריד מהרשימה"
              ghost
              onPress={() => {
                onRemove(target);
                onClose();
              }}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
