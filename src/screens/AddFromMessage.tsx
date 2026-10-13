import React, { useEffect, useRef, useState } from "react";
import { View, Image, Pressable, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { T, Btn, Input, Card, Check, Tag, s } from "../ui";
import { useTheme } from "../theme";
import { extract, AiError } from "../ai";
import { addMany } from "../firebase";
import { prepareImage } from "../image";
import { fmtDate } from "../dates";
import { timeLabel } from "../items";
import { CAT_LABEL, type Extracted } from "../types";
import type { Incoming } from "../share";
import EditExtracted, { type Target } from "../EditExtracted";

type Img = { uri: string; mimeType: string; width?: number; height?: number };

export default function AddFromMessage({
  family,
  me,
  members,
  incoming,
  onIncomingUsed,
  onAdded,
  toast,
}: {
  family: string;
  me: string;
  members: string[];
  incoming: Incoming | null;
  onIncomingUsed: () => void;
  onAdded: () => void;
  toast: (m: string) => void;
}) {
  const th = useTheme();
  const [text, setText] = useState("");
  const [img, setImg] = useState<Img | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [found, setFound] = useState<Extracted | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [editing, setEditing] = useState<Target | null>(null);
  const people = Array.from(new Set([me, ...members].filter(Boolean)));
  const autoRun = useRef(false);

  // Content shared from WhatsApp / Gallery: fill in and read it right away.
  useEffect(() => {
    if (!incoming) return;
    setText(incoming.text || "");
    setImg(incoming.image);
    setFound(null);
    autoRun.current = true;
    onIncomingUsed();
  }, [incoming]);

  useEffect(() => {
    if (autoRun.current && (text || img)) {
      autoRun.current = false;
      run();
    }
  }, [text, img]);

  const pick = async (camera: boolean) => {
    try {
      if (camera) {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) return setMsg("צריך לאשר גישה למצלמה בהגדרות הטלפון.");
      }
      // The image is shrunk just before sending (prepareImage), so take the original here.
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
      const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled || !r.assets?.length) return;
      const a = r.assets[0];
      setImg({ uri: a.uri, mimeType: a.mimeType || "image/jpeg", width: a.width, height: a.height });
      setFound(null);
      setMsg("התמונה מוכנה. לחצו ״חילוץ משימות״.");
    } catch {
      setMsg("לא הצלחתי לפתוח את התמונה.");
    }
  };

  const run = async () => {
    if (!text.trim() && !img) return setMsg("הדביקו טקסט או הוסיפו תמונה.");
    setBusy(true);
    setMsg("קורא את ההודעה…");
    const started = Date.now();
    setElapsed(0);
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    try {
      let image: { base64: string; mimeType: string } | undefined;
      if (img) {
        try {
          image = await prepareImage(img.uri, img.width, img.height);
        } catch (e: any) {
          setMsg("לא הצלחתי לקרוא את קובץ התמונה. נסו לבחור אותה שוב מהגלריה. (קריאה: " + String(e?.message || e).slice(0, 60) + ")");
          return;
        }
      }
      const r = await extract(text.trim(), image);
      setFound(r);
      setMsg(r.tasks.length || r.shopping.length ? "" : "לא נמצאו משימות בהודעה.");
    } catch (e: any) {
      const m = String(e?.message || e).slice(0, 120);
      const kind = e instanceof AiError ? e.kind : "other";
      setMsg(
        kind === "quota"
          ? "הגעתם למגבלת השימוש היומית החינמית בחילוץ החכם. היא מתאפסת כל לילה. בינתיים אפשר להוסיף משימות ידנית."
          : kind === "network"
          ? "אין חיבור לאינטרנט. נסו שוב."
          : kind === "timeout"
          ? "הקריאה לקחה יותר מדי זמן. נסו שוב, או צלמו רק את החלק החשוב בהודעה."
          : kind === "setup"
          ? "החילוץ החכם לא מופעל בפרויקט Firebase. (" + m + ")"
          : "החילוץ לא הצליח. נסו שוב. (" + m + ")"
      );
    } finally {
      clearInterval(tick);
      setBusy(false);
    }
  };

  const save = async () => {
    if (!found) return;
    const n = Date.now();
    const ts = found.tasks.filter((t) => t.pick);
    const ss = found.shopping.filter((x) => x.pick);
    try {
      await addMany(
        family,
        ts.map((t, i) => ({
          kind: t.kind,
          title: t.title,
          date: t.date,
          time: t.time,
          endTime: t.endTime,
          location: t.location,
          cat: t.cat,
          who: t.who || "",
          done: false,
          createdBy: me,
          createdAt: n + i,
          source: "message",
        })),
        ss.map((x, i) => ({ name: x.name, qty: x.qty, done: false, createdBy: me, createdAt: n + i }))
      );
      toast("נוספו " + (ts.length + ss.length) + " פריטים");
      setFound(null);
      setText("");
      setImg(null);
      setMsg("");
      onAdded();
    } catch {
      toast("השמירה לא הצליחה. בדקו את החיבור.");
    }
  };

  const flip = (kind: "t" | "s", i: number) => {
    if (!found) return;
    const f = { tasks: [...found.tasks], shopping: [...found.shopping] };
    if (kind === "t") f.tasks[i] = { ...f.tasks[i], pick: !f.tasks[i].pick };
    else f.shopping[i] = { ...f.shopping[i], pick: !f.shopping[i].pick };
    setFound(f);
  };

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <T bold>מדביקים הודעה מהגן, מבית הספר או ממייל, או מוסיפים תמונה</T>
        {Platform.OS !== "web" ? (
          <T muted size={14}>טיפ: בוואטסאפ או בגלריה לוחצים ״שתף״ ובוחרים ״לוח המשפחה״, וההודעה מגיעה לכאן לבד.</T>
        ) : null}
        <Input
          value={text}
          onChangeText={setText}
          multiline
          placeholder="לדוגמה: הורים יקרים, ביום חמישי יום פיג'מות. נא לשלוח 15 ₪ עד יום שלישי לטיול."
          style={{ minHeight: 120, textAlignVertical: "top" }}
        />
        <View style={s.row}>
          <Btn label="📷 תמונה מהגלריה" ghost onPress={() => pick(false)} />
          {Platform.OS !== "web" ? <Btn label="צילום" ghost onPress={() => pick(true)} /> : null}
        </View>
        {img ? (
          <View style={s.row}>
            <Image source={{ uri: img.uri }} style={{ width: 110, height: 150, borderRadius: 10, borderWidth: 1, borderColor: th.line }} resizeMode="cover" />
            <Btn label="הסרת התמונה" ghost onPress={() => setImg(null)} />
          </View>
        ) : null}
        <Btn label={busy ? (elapsed >= 2 ? "קורא… " + elapsed + " שנ׳" : "קורא…") : "חילוץ משימות"} onPress={run} disabled={busy} />
        {msg ? <T muted size={14}>{msg}</T> : null}
      </Card>

      {found && (found.tasks.length || found.shopping.length) ? (
        <View style={{ gap: 8 }}>
          <T bold size={17}>
            זה מה שמצאתי <T muted size={14}>לחיצה על פריט לתיקון · ביטול סימון למה שלא צריך</T>
          </T>
          <View style={{ backgroundColor: th.surface, borderColor: th.line, borderWidth: 1, borderRadius: 12, overflow: "hidden" }}>
            {found.tasks.map((t, i) => (
              <View key={"t" + i} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: th.line }}>
                <Check on={!!t.pick} onPress={() => flip("t", i)} />
                <Pressable
                  onPress={() => setEditing({ type: "task", index: i, item: t })}
                  accessibilityRole="button"
                  accessibilityHint="תיקון"
                  style={{ flex: 1, gap: 3, opacity: t.pick ? 1 : 0.5 }}
                >
                  <T bold>{(t.kind === "event" ? "📅 " : "") + t.title}</T>
                  <View style={s.row}>
                    <Tag label={CAT_LABEL[t.cat]} color={th.cat[t.cat]} />
                    <T muted size={13}>{t.date ? fmtDate(t.date) + (t.time ? " · " + timeLabel(t) : "") : "בלי תאריך"}</T>
                    {t.location ? <T muted size={13}>{"📍 " + t.location}</T> : null}
                    {t.who ? <T muted size={13}>{"👤 " + (t.who === "both" ? "שנינו" : t.who)}</T> : null}
                  </View>
                </Pressable>
                <T muted size={18} style={{ paddingHorizontal: 4 }} onPress={() => setEditing({ type: "task", index: i, item: t })} accessibilityLabel="תיקון">
                  ✎
                </T>
              </View>
            ))}
            {found.shopping.map((x, i) => (
              <View key={"s" + i} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: th.line }}>
                <Check on={!!x.pick} onPress={() => flip("s", i)} />
                <Pressable
                  onPress={() => setEditing({ type: "shop", index: i, item: x })}
                  accessibilityRole="button"
                  accessibilityHint="תיקון"
                  style={{ flex: 1, gap: 3, opacity: x.pick ? 1 : 0.5 }}
                >
                  <T bold>{"🛒 " + x.name}</T>
                  <View style={s.row}>
                    <Tag label="קניות" color={th.cat.shop} />
                    {x.qty ? <T muted size={13}>{x.qty}</T> : null}
                  </View>
                </Pressable>
                <T muted size={18} style={{ paddingHorizontal: 4 }} onPress={() => setEditing({ type: "shop", index: i, item: x })} accessibilityLabel="תיקון">
                  ✎
                </T>
              </View>
            ))}
          </View>
          <View style={s.row}>
            <Btn label="הוספה ללוח" onPress={save} />
            <Btn label="ביטול" ghost onPress={() => setFound(null)} />
          </View>
        </View>
      ) : null}

      <EditExtracted
        target={editing}
        people={people}
        me={me}
        onClose={() => setEditing(null)}
        onSaveTask={(i, t) => found && setFound({ ...found, tasks: found.tasks.map((x, j) => (j === i ? t : x)) })}
        onSaveShop={(i, x) => found && setFound({ ...found, shopping: found.shopping.map((y, j) => (j === i ? { ...x, pick: true } : y)) })}
        onRemove={(tg) =>
          found &&
          setFound(
            tg.type === "task"
              ? { ...found, tasks: found.tasks.filter((_, j) => j !== tg.index) }
              : { ...found, shopping: found.shopping.filter((_, j) => j !== tg.index) }
          )
        }
      />
    </View>
  );
}
