import React, { useState } from "react";
import { View, ScrollView } from "react-native";
import { T, Btn, Input, Card } from "../ui";
import { useTheme } from "../theme";
import { createFamily, joinFamily, newFamilyCode, normalizeCode, isConfigured } from "../firebase";
import type { Local } from "../storage";

export default function Setup({ initialCode, onDone }: { initialCode?: string; onDone: (l: Local) => void }) {
  const th = useTheme();
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode || "");
  const [mode, setMode] = useState<"pick" | "join">(initialCode ? "join" : "pick");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!isConfigured) {
    return (
      <Card>
        <T bold size={18}>האפליקציה עוד לא מחוברת</T>
        <T muted>צריך למלא את פרטי Firebase בקובץ src/config.ts ולבנות מחדש.</T>
      </Card>
    );
  }

  const create = async () => {
    const n = name.trim();
    if (!n) return setMsg("כתבו קודם את השם שלכם.");
    setBusy(true);
    setMsg("");
    try {
      const c = newFamilyCode();
      await createFamily(c, n);
      onDone({ family: c, name: n });
    } catch (e: any) {
      setMsg("לא הצלחתי ליצור לוח חדש. בדקו את החיבור לאינטרנט ונסו שוב.");
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    const n = name.trim();
    const c = normalizeCode(code);
    if (!n) return setMsg("כתבו קודם את השם שלכם.");
    if (c.length < 16) return setMsg("קוד המשפחה קצר מדי. העתיקו אותו בדיוק כפי שקיבלתם.");
    setBusy(true);
    setMsg("");
    try {
      const ok = await joinFamily(c, n);
      if (!ok) setMsg("לא מצאתי לוח עם הקוד הזה. בדקו שהעתקתם אותו נכון.");
      else onDone({ family: c, name: n });
    } catch (e: any) {
      setMsg("ההצטרפות לא הצליחה. בדקו את החיבור לאינטרנט ונסו שוב.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 40 }}>
      <Card>
        <T bold size={18}>ברוכים הבאים ללוח המשפחה</T>
        <T muted>מקום אחד לכל המשימות של הבית, הגן ובית הספר, משותף לשניכם.</T>
        <T bold>איך קוראים לך?</T>
        <Input value={name} onChangeText={setName} placeholder="למשל: אלעד" autoFocus={!initialCode} />
      </Card>

      {mode === "pick" ? (
        <Card>
          <Btn label="יצירת לוח חדש למשפחה" onPress={create} disabled={busy} />
          <T muted style={{ textAlign: "center" }}>או</T>
          <Btn label="יש לי קוד משפחה, הצטרפות ללוח קיים" ghost onPress={() => setMode("join")} disabled={busy} />
        </Card>
      ) : (
        <Card>
          <T bold>קוד המשפחה</T>
          <Input
            value={code}
            onChangeText={setCode}
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            style={{ textAlign: "left", writingDirection: "ltr" }}
          />
          <T muted size={14}>את הקוד מקבלים ממי שיצר את הלוח, במסך ״הגדרות״ אצלו.</T>
          <Btn label="הצטרפות" onPress={join} disabled={busy} />
          {!initialCode ? <Btn label="חזרה" ghost onPress={() => setMode("pick")} disabled={busy} /> : null}
        </Card>
      )}
      {msg ? (
        <View style={{ backgroundColor: th.soft, borderRadius: 12, padding: 12 }}>
          <T>{msg}</T>
        </View>
      ) : null}
    </ScrollView>
  );
}
