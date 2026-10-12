import React, { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { T, Btn, Input, Card, Chip, Check, Tag, s } from "../ui";
import { useTheme } from "../theme";
import { addTask, updateTask, deleteTask } from "../firebase";
import { dayDiff, fmtDate, iso, parseUserDate, isTime } from "../dates";
import { CAT_LABEL, type Cat, type Task } from "../types";

const CATS: Cat[] = ["gan", "school", "home", "shop", "other"];
type Filter = "all" | "mine" | Cat;

export default function Tasks({
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
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [cat, setCat] = useState<Cat>("home");
  const [who, setWho] = useState(me);
  const [filter, setFilter] = useState<Filter>("all");
  const [armed, setArmed] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const people = useMemo(() => Array.from(new Set([me, ...members].filter(Boolean))), [me, members]);

  const add = async () => {
    const t = title.trim();
    if (!t) return;
    const d = parseUserDate(date);
    if (date.trim() && !d) return toast("לא הבנתי את התאריך. כתבו למשל 15.10");
    if (time.trim() && !isTime(time.trim())) return toast("כתבו שעה כמו 08:30");
    try {
      await addTask(family, {
        title: t,
        date: d,
        time: time.trim(),
        cat,
        who,
        done: false,
        createdBy: me,
        createdAt: Date.now(),
        source: "manual",
      });
      setTitle("");
      setTime("");
      toast("נוספה משימה");
    } catch {
      toast("השמירה לא הצליחה. בדקו את החיבור.");
    }
  };

  const list = tasks.filter((t) =>
    filter === "all" ? true : filter === "mine" ? t.who === me || t.who === "both" : t.cat === filter
  );
  const open = list.filter((t) => !t.done);
  const done = list.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  const groups: [string, string, Task[]][] = [
    ["late", "באיחור", []],
    ["today", "היום", []],
    ["tom", "מחר", []],
    ["week", "בשבוע הקרוב", []],
    ["later", "בהמשך", []],
    ["none", "בלי תאריך", []],
  ];
  const G = Object.fromEntries(groups.map((g) => [g[0], g[2]])) as Record<string, Task[]>;
  open.forEach((t) => {
    if (!t.date) return G.none.push(t);
    const d = dayDiff(t.date);
    (d < 0 ? G.late : d === 0 ? G.today : d === 1 ? G.tom : d <= 7 ? G.week : G.later).push(t);
  });
  const sorter = (a: Task, b: Task) =>
    (a.date || "9").localeCompare(b.date || "9") ||
    (a.time || "99").localeCompare(b.time || "99") ||
    (a.createdAt || 0) - (b.createdAt || 0);

  const toggle = (t: Task) =>
    updateTask(family, t.id, { done: !t.done, doneAt: t.done ? 0 : Date.now() }).catch(() =>
      toast("השמירה לא הצליחה.")
    );
  const del = (t: Task) => {
    if (armed !== t.id) {
      setArmed(t.id);
      setTimeout(() => setArmed((a) => (a === t.id ? null : a)), 3500);
      return;
    }
    setArmed(null);
    deleteTask(family, t.id).then(() => toast("נמחק"), () => toast("המחיקה לא הצליחה."));
  };
  const nameOf = (w: string) => (w === "both" ? "שנינו" : w === me ? w + " (אני)" : w);

  const Item = ({ t }: { t: Task }) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: th.line }}>
      <Check on={t.done} onPress={() => toggle(t)} />
      <View style={{ flex: 1, gap: 3 }}>
        <T bold style={t.done ? { textDecorationLine: "line-through", color: th.muted } : undefined}>{t.title}</T>
        <View style={[s.row, { gap: 8 }]}>
          <Tag label={CAT_LABEL[t.cat] || "אחר"} color={th.cat[t.cat] || th.cat.other} />
          {t.date ? <T muted size={13}>{fmtDate(t.date) + (t.time ? " · " + t.time : "")}</T> : null}
          {t.who ? <T muted size={13}>{"👤 " + nameOf(t.who)}</T> : null}
        </View>
      </View>
      <Pressable onPress={() => del(t)} style={{ paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: armed === t.id ? th.danger : "transparent" }}>
        <T size={13} style={{ color: armed === t.id ? th.surface : th.muted, fontWeight: "600" }}>
          {armed === t.id ? "למחוק?" : "מחיקה"}
        </T>
      </Pressable>
    </View>
  );

  const ListBox = ({ items }: { items: Task[] }) => (
    <View style={{ backgroundColor: th.surface, borderColor: th.line, borderWidth: 1, borderRadius: 12, overflow: "hidden", marginTop: -1 }}>
      {items.map((t) => (
        <Item key={t.id} t={t} />
      ))}
    </View>
  );

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Input value={title} onChangeText={setTitle} placeholder="משימה חדשה, למשל: להביא 20 ₪ לטיול" onSubmitEditing={add} returnKeyType="done" />
        <View style={s.row}>
          <Chip label="היום" on={date === iso(new Date())} onPress={() => setDate(iso(new Date()))} />
          <Chip
            label="מחר"
            on={date === iso(new Date(Date.now() + 864e5))}
            onPress={() => setDate(iso(new Date(Date.now() + 864e5)))}
          />
          <Input value={date.includes("-") ? date.split("-").reverse().slice(0, 2).join(".") : date} onChangeText={setDate} placeholder="תאריך 15.10" style={{ flex: 1, minWidth: 100 }} />
          <Input value={time} onChangeText={setTime} placeholder="שעה 08:30" style={{ width: 100 }} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={s.row}>
          {CATS.map((c) => (
            <Chip key={c} label={CAT_LABEL[c]} on={cat === c} onPress={() => setCat(c)} color={th.cat[c]} />
          ))}
        </View>
        <View style={s.row}>
          <T muted size={14}>אחראי/ת:</T>
          <Chip label="לא שויך" on={who === ""} onPress={() => setWho("")} />
          <Chip label="שנינו" on={who === "both"} onPress={() => setWho("both")} />
          {people.map((p) => (
            <Chip key={p} label={p} on={who === p} onPress={() => setWho(p)} />
          ))}
        </View>
        <Btn label="הוספה" onPress={add} />
      </Card>

      <View style={s.row}>
        {(["all", "mine", "gan", "school", "home"] as Filter[]).map((f) => (
          <Chip key={f} label={f === "all" ? "הכל" : f === "mine" ? "שלי" : CAT_LABEL[f as Cat]} on={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>

      {groups.map(([k, label]) =>
        G[k].length ? (
          <View key={k} style={{ gap: 8 }}>
            <T bold size={17} style={k === "late" ? { color: th.danger } : undefined}>
              {label} <T muted size={14}>{String(G[k].length)}</T>
            </T>
            <ListBox items={G[k].sort(sorter)} />
          </View>
        ) : null
      )}

      {!open.length ? (
        <Card style={{ alignItems: "center", paddingVertical: 26 }}>
          <T bold size={17} style={{ textAlign: "center" }}>{tasks.length ? "הכל בוצע 🎉" : "עוד אין משימות"}</T>
          <T muted style={{ textAlign: "center" }}>
            {tasks.length
              ? "אין משימות פתוחות בסינון הזה."
              : "הוסיפו משימה למעלה, או שתפו לכאן הודעה מהוואטסאפ של הגן."}
          </T>
        </Card>
      ) : null}

      {done.length ? (
        <View style={{ gap: 8 }}>
          <Pressable onPress={() => setShowDone(!showDone)}>
            <T muted bold>{(showDone ? "▾ " : "◂ ") + "בוצעו (" + done.length + ")"}</T>
          </Pressable>
          {showDone ? <ListBox items={done.slice(0, 40)} /> : null}
        </View>
      ) : null}
    </View>
  );
}
