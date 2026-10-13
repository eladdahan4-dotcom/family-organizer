import React, { useEffect, useState } from "react";
import { Modal, View, ScrollView, Pressable } from "react-native";
import { T, Btn } from "./ui";
import { useTheme } from "./theme";
import ItemForm from "./ItemForm";
import { checkDraft, draftFrom, emptyDraft, type Draft } from "./items";
import { addTask, updateTask, deleteTask } from "./firebase";
import type { Task } from "./types";

/**
 * Window for editing an existing task/meeting (item given) or adding a new one
 * (item = null, with optional starting values such as the day picked in the calendar).
 */
export default function EditItem({
  family,
  me,
  people,
  item,
  preset,
  visible,
  onClose,
  toast,
}: {
  family: string;
  me: string;
  people: string[];
  item: Task | null;
  preset?: Partial<Draft>;
  visible: boolean;
  onClose: () => void;
  toast: (m: string) => void;
}) {
  const th = useTheme();
  const [draft, setDraft] = useState<Draft>(emptyDraft(me));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(item ? draftFrom(item) : emptyDraft(me, preset));
    setMsg("");
    setConfirmDelete(false);
  }, [visible, item?.id]);

  const save = async () => {
    const c = checkDraft(draft);
    if (!c.ok) return setMsg(c.msg);
    setBusy(true);
    try {
      if (item) {
        await updateTask(family, item.id, c.fields);
        toast("נשמר");
      } else {
        await addTask(family, { ...c.fields, done: false, createdBy: me, createdAt: Date.now(), source: "manual" });
        toast(c.fields.kind === "event" ? "נוספה פגישה" : "נוספה משימה");
      }
      onClose();
    } catch {
      setMsg("השמירה לא הצליחה. בדקו את החיבור.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await deleteTask(family, item.id);
      toast("נמחק");
      onClose();
    } catch {
      setMsg("המחיקה לא הצליחה.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} accessibilityLabel="סגירה" />
      <View
        style={{
          backgroundColor: th.surface,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          maxHeight: "88%",
          direction: "rtl",
        }}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
          <T bold size={19}>{item ? "עריכה" : "פריט חדש"}</T>
          <ItemForm draft={draft} onChange={setDraft} people={people} me={me} />
          {msg ? (
            <View style={{ backgroundColor: th.soft, borderRadius: 10, padding: 10 }}>
              <T size={14}>{msg}</T>
            </View>
          ) : null}
          <Btn label={item ? "שמירת השינויים" : "הוספה"} onPress={save} disabled={busy} />
          <Btn label="ביטול" ghost onPress={onClose} disabled={busy} />
          {item ? (
            <Btn
              label={confirmDelete ? "בטוח? לחצו שוב למחיקה" : "מחיקה"}
              ghost={!confirmDelete}
              onPress={remove}
              disabled={busy}
              style={confirmDelete ? { backgroundColor: th.danger } : undefined}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
