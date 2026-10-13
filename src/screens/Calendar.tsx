import React, { useMemo, useState } from "react";
import { View, Pressable, Text } from "react-native";
import { T, Btn, Card, s } from "../ui";
import { useTheme } from "../theme";
import { updateTask } from "../firebase";
import { iso, parseIso, fmtDate } from "../dates";
import { itemsOn, monthGrid } from "../items";
import ItemRow, { ListBox } from "../ItemRow";
import EditItem from "../EditItem";
import { kindOf, type Task } from "../types";

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const DOW = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

/** Month view: dots on days with items; tap a day to see and add its items. */
export default function Calendar({
  family,
  me,
  members,
  tasks,
  toast,
}: {
  family: string;
  me: string;
  members: string[];
  tasks: Task[];
  toast: (m: string) => void;
}) {
  const th = useTheme();
  const today = iso(new Date());
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<Task | null>(null);
  const [adding, setAdding] = useState(false);

  const people = useMemo(() => Array.from(new Set([me, ...members].filter(Boolean))), [me, members]);
  const byDay = useMemo(() => {
    const m: Record<string, Task[]> = {};
    tasks.forEach((t) => t.date && (m[t.date] = m[t.date] || []).push(t));
    return m;
  }, [tasks]);

  const weeks = monthGrid(month.y, month.m);
  const move = (n: number) => {
    const d = new Date(month.y, month.m + n, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => {
    const d = new Date();
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(today);
  };

  const dayItems = itemsOn(tasks, selected);
  const events = dayItems.filter((t) => kindOf(t) === "event");
  const todo = dayItems.filter((t) => kindOf(t) !== "event");
  const toggle = (t: Task) =>
    updateTask(family, t.id, { done: !t.done, doneAt: t.done ? 0 : Date.now() }).catch(() => toast("השמירה לא הצליחה."));

  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 8, padding: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => move(-1)} hitSlop={10} accessibilityLabel="החודש הקודם" style={{ padding: 8 }}>
            <T size={20}>›</T>
          </Pressable>
          <Pressable onPress={goToday} accessibilityLabel="חזרה להיום">
            <T bold size={18}>{MONTHS[month.m] + " " + month.y}</T>
          </Pressable>
          <Pressable onPress={() => move(1)} hitSlop={10} accessibilityLabel="החודש הבא" style={{ padding: 8 }}>
            <T size={20}>‹</T>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row" }}>
          {DOW.map((d) => (
            <Text key={d} style={{ flex: 1, textAlign: "center", color: th.muted, fontSize: 13, fontWeight: "600" }}>
              {d}
            </Text>
          ))}
        </View>

        {weeks.map((w, wi) => (
          <View key={wi} style={{ flexDirection: "row" }}>
            {w.map((day, di) => {
              if (!day) return <View key={di} style={{ flex: 1, height: 52 }} />;
              const items = byDay[day] || [];
              const isSel = day === selected;
              const isToday = day === today;
              const dots = items.slice(0, 4);
              return (
                <Pressable
                  key={di}
                  onPress={() => setSelected(day)}
                  accessibilityLabel={"יום " + Number(day.slice(8)) + (items.length ? ", " + items.length + " פריטים" : "")}
                  accessibilityState={{ selected: isSel }}
                  testID={"day-" + day}
                  style={{
                    flex: 1,
                    height: 52,
                    margin: 1,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isSel ? th.accent : "transparent",
                    borderWidth: isToday && !isSel ? 1.5 : 0,
                    borderColor: th.accent,
                  }}
                >
                  <Text style={{ color: isSel ? th.accentInk : th.ink, fontWeight: isToday ? "700" : "500", fontSize: 15, fontVariant: ["tabular-nums"] }}>
                    {Number(day.slice(8))}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 3, height: 7, marginTop: 3 }}>
                    {dots.map((t) => (
                      <View
                        key={t.id}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: kindOf(t) === "event" ? 1 : 3,
                          backgroundColor: isSel ? th.accentInk : th.cat[t.cat] || th.cat.other,
                          opacity: t.done ? 0.35 : 1,
                        }}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
        <T muted size={12} style={{ textAlign: "center" }}>
          נקודה עגולה = משימה · ריבוע = פגישה
        </T>
      </Card>

      <View style={{ gap: 8 }}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <T bold size={17}>{(selected === today ? "היום, " : "") + fmtDate(selected)}</T>
          <Btn label="+ הוספה ליום הזה" ghost onPress={() => setAdding(true)} style={{ paddingVertical: 7 }} />
        </View>
        {dayItems.length ? (
          <>
            {events.length ? (
              <ListBox>
                {events.map((t, i) => (
                  <ItemRow key={t.id} t={t} me={me} first={i === 0} showDate={false} onToggle={() => toggle(t)} onOpen={() => setEditing(t)} />
                ))}
              </ListBox>
            ) : null}
            {todo.length ? (
              <ListBox>
                {todo.map((t, i) => (
                  <ItemRow key={t.id} t={t} me={me} first={i === 0} showDate={false} onToggle={() => toggle(t)} onOpen={() => setEditing(t)} />
                ))}
              </ListBox>
            ) : null}
          </>
        ) : (
          <Card style={{ alignItems: "center", paddingVertical: 18 }}>
            <T muted style={{ textAlign: "center" }}>אין כלום ביום הזה.</T>
          </Card>
        )}
        <T muted size={12}>משימות בלי תאריך מופיעות בלשונית ״משימות״.</T>
      </View>

      <EditItem
        family={family}
        me={me}
        people={people}
        item={editing}
        visible={!!editing}
        onClose={() => setEditing(null)}
        toast={toast}
      />
      <EditItem
        family={family}
        me={me}
        people={people}
        item={null}
        preset={{ date: selected, kind: "event" }}
        visible={adding}
        onClose={() => setAdding(false)}
        toast={toast}
      />
    </View>
  );
}
