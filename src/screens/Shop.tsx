import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { T, Btn, Input, Card, Check, s } from "../ui";
import { useTheme } from "../theme";
import { addShop, updateShop, deleteShop, deleteShopMany } from "../firebase";
import type { ShopItem } from "../types";

export default function Shop({
  family,
  me,
  items,
  toast,
}: {
  family: string;
  me: string;
  items: ShopItem[];
  toast: (m: string) => void;
}) {
  const th = useTheme();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [armed, setArmed] = useState<string | null>(null);

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    try {
      await addShop(family, { name: n, qty: qty.trim(), done: false, createdBy: me, createdAt: Date.now() });
      setName("");
      setQty("");
    } catch {
      toast("השמירה לא הצליחה. בדקו את החיבור.");
    }
  };

  const open = items.filter((x) => !x.done).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const got = items.filter((x) => x.done);

  const del = (x: ShopItem) => {
    if (armed !== x.id) {
      setArmed(x.id);
      setTimeout(() => setArmed((a) => (a === x.id ? null : a)), 3500);
      return;
    }
    setArmed(null);
    deleteShop(family, x.id).catch(() => toast("המחיקה לא הצליחה."));
  };

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <View style={s.row}>
          <Input value={name} onChangeText={setName} placeholder="מה צריך לקנות? למשל: חלב 3%" style={{ flex: 1, minWidth: 160 }} onSubmitEditing={add} returnKeyType="done" />
          <Input value={qty} onChangeText={setQty} placeholder="כמות" style={{ width: 80 }} />
        </View>
        <Btn label="הוספה" onPress={add} />
      </Card>

      {items.length ? (
        <View style={{ backgroundColor: th.surface, borderColor: th.line, borderWidth: 1, borderRadius: 12, overflow: "hidden" }}>
          {[...open, ...got].map((x, i) => (
            <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: th.line }}>
              <Check on={x.done} onPress={() => updateShop(family, x.id, { done: !x.done }).catch(() => toast("השמירה לא הצליחה."))} />
              <View style={{ flex: 1 }}>
                <T bold style={x.done ? { textDecorationLine: "line-through", color: th.muted } : undefined}>{x.name}</T>
                {x.qty ? <T muted size={13}>{x.qty}</T> : null}
              </View>
              <Pressable onPress={() => del(x)} style={{ paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: armed === x.id ? th.danger : "transparent" }}>
                <T size={13} style={{ color: armed === x.id ? th.surface : th.muted, fontWeight: "600" }}>{armed === x.id ? "למחוק?" : "מחיקה"}</T>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Card style={{ alignItems: "center", paddingVertical: 26 }}>
          <T bold size={17} style={{ textAlign: "center" }}>הרשימה ריקה</T>
          <T muted style={{ textAlign: "center" }}>מוסיפים פריטים למעלה. בסופר מסמנים מה נכנס לעגלה, ושניכם רואים את זה מיד.</T>
        </Card>
      )}

      {got.length ? (
        <Btn
          label="ניקוי מה שנקנה"
          ghost
          onPress={() => deleteShopMany(family, got.map((x) => x.id)).then(() => toast("נוקה"), () => toast("הניקוי לא הצליח."))}
        />
      ) : null}
    </View>
  );
}
