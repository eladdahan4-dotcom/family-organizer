import React, { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { T, Btn, Card, Chip, s } from "../ui";
import { useTheme } from "../theme";
import { addTask, updateTask } from "../firebase";
import { dayDiff } from "../dates";
import { CAT_LABEL, kindOf, type Cat, type Task } from "../types";
import ItemForm from "../ItemForm";
import ItemRow, { ListBox } from "../ItemRow";
import EditItem from "../EditItem";
import { byWhen, checkDraft, emptyDraft, isPastEvent, type Draft } from "../items";

type Filter = "all" | "mine" | "events" | Cat;

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
  const [draft, setDraft] = useState<Draft>(emptyDraft(me));
  const [filter, setFilter] = useState<Filter>("all");
  const [showDone, setShowDone] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const people = useMemo(() => Array.from(new Set([me, ...members].filter(Boolean))), [me, members]);

  const add = async () => {
    if (!draft.title.trim()) return;
    const c = checkDraft(draft);
    if (!c.ok) return toast(c.msg);
    try {
      await addTask(family, { ...c.fields, done: false, createdBy: me, createdAt: Date.now(), source: "manual" });
      setDraft({ ...draft, title: "", time: "", endTime: "", location: "" });
      toast(c.fields.kind === "event" ? "נוספה פגישה" : "נוספה משימה");
    } catch {
      toast("השמירה לא הצליחה. בדקו את החיבור.");
    }
  };

  const list = tasks.filter((t) =>
    filter === "all"
      ? true
      : filter === "mine"
      ? t.who === me || t.who === "both"
      : filter === "events"
      ? kindOf(t) === "event"
      : t.cat === filter
  );
  const past = list.filter(isPastEvent).sort((a, b) => byWhen(b, a));
  const open = list.filter((t) => !t.done && !isPastEvent(t));
  const done = list.filter((t) => t.done && !isPastEvent(t)).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  const groups: [string, string][] = [
    ["late", "באיחור"],
    ["today", "היום"],
    ["tom", "מחר"],
    ["week", "בשבוע הקרוב"],
    ["later", "בהמשך"],
    ["none", "בלי תאריך"],
  ];
  const G: Record<string, Task[]> = { late: [], today: [], tom: [], week: [], later: [], none: [] };
  open.forEach((t) => {
    if (!t.date) return G.none.push(t);
    const d = dayDiff(t.date);
    (d < 0 ? G.late : d === 0 ? G.today : d === 1 ? G.tom : d <= 7 ? G.week : G.later).push(t);
  });

  const toggle = (t: Task) =>
    updateTask(family, t.id, { done: !t.done, doneAt: t.done ? 0 : Date.now() }).catch(() => toast("השמירה לא הצליחה."));

  const rows = (items: Task[], showDate = true) => (
    <ListBox>
      {items.map((t, i) => (
        <ItemRow key={t.id} t={t} me={me} first={i === 0} showDate={showDate} onToggle={() => toggle(t)} onOpen={() => setEditing(t)} />
      ))}
    </ListBox>
  );

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <ItemForm draft={draft} onChange={setDraft} people={people} me={me} />
        <Btn label="הוספה" onPress={add} />
      </Card>

      <View style={s.row}>
        {(["all", "mine", "events", "gan", "school", "home"] as Filter[]).map((f) => (
          <Chip
            key={f}
            label={f === "all" ? "הכל" : f === "mine" ? "שלי" : f === "events" ? "פגישות" : CAT_LABEL[f as Cat]}
            on={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>

      {groups.map(([k, label]) =>
        G[k].length ? (
          <View key={k} style={{ gap: 8 }}>
            <T bold size={17} style={k === "late" ? { color: th.danger } : undefined}>
              {label} <T muted size={14}>{String(G[k].length)}</T>
            </T>
            {rows(G[k].sort(byWhen), k !== "today" && k !== "tom")}
          </View>
        ) : null
      )}

      {!open.length ? (
        <Card style={{ alignItems: "center", paddingVertical: 26 }}>
          <T bold size={17} style={{ textAlign: "center" }}>{tasks.length ? "הכל בוצע 🎉" : "עוד אין משימות"}</T>
          <T muted style={{ textAlign: "center" }}>
            {tasks.length ? "אין משימות פתוחות בסינון הזה." : "הוסיפו משימה או פגישה למעלה, או שתפו לכאן הודעה מהוואטסאפ של הגן."}
          </T>
        </Card>
      ) : null}

      {done.length ? (
        <View style={{ gap: 8 }}>
          <Pressable onPress={() => setShowDone(!showDone)}>
            <T muted bold>{(showDone ? "▾ " : "◂ ") + "בוצעו (" + done.length + ")"}</T>
          </Pressable>
          {showDone ? rows(done.slice(0, 40)) : null}
        </View>
      ) : null}

      {past.length ? (
        <View style={{ gap: 8 }}>
          <Pressable onPress={() => setShowPast(!showPast)}>
            <T muted bold>{(showPast ? "▾ " : "◂ ") + "פגישות שעברו (" + past.length + ")"}</T>
          </Pressable>
          {showPast ? rows(past.slice(0, 40)) : null}
        </View>
      ) : null}

      <EditItem
        family={family}
        me={me}
        people={people}
        item={editing}
        visible={!!editing}
        onClose={() => setEditing(null)}
        toast={toast}
      />
    </View>
  );
}
