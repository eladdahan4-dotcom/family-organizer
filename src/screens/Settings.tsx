import React, { useState } from "react";
import { View, Share, Platform } from "react-native";
import Constants from "expo-constants";
import { T, Btn, Card } from "../ui";
import { prettyCode } from "../firebase";

export default function Settings({
  family,
  me,
  members,
  onLeave,
}: {
  family: string;
  me: string;
  members: string[];
  onLeave: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const webUrl: string = (Constants.expoConfig?.extra as any)?.webUrl || "";
  const link = webUrl ? webUrl.replace(/\/?$/, "/") + "?family=" + family : "";
  const invite =
    "הצטרפי ללוח המשפחה שלנו 🏠\n" +
    (link ? "פותחים את הקישור (באייפון: שיתוף ← הוספה למסך הבית):\n" + link + "\n\n" : "") +
    "קוד המשפחה: " + prettyCode(family);

  const share = async () => {
    try {
      if (Platform.OS === "web") {
        const nav: any = (globalThis as any).navigator;
        if (nav?.share) await nav.share({ text: invite });
        else if (nav?.clipboard) {
          await nav.clipboard.writeText(invite);
          alert("ההזמנה הועתקה. הדביקו אותה בוואטסאפ.");
        }
      } else {
        await Share.share({ message: invite });
      }
    } catch {}
  };

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <T bold size={17}>מי בלוח</T>
        <T>{members.length ? members.join(", ") : me}</T>
        <T muted size={14}>{"את/ה מחובר/ת בשם: " + me}</T>
      </Card>
      <Card>
        <T bold size={17}>הזמנת בן/בת הזוג</T>
        <T muted>שולחים את ההזמנה בוואטסאפ. באייפון ובמחשב פותחים את הקישור, ובאנדרואיד מתקינים את האפליקציה ומזינים את הקוד.</T>
        <T selectable style={{ textAlign: "left", writingDirection: "ltr", fontSize: 18, letterSpacing: 1 }}>
          {prettyCode(family)}
        </T>
        <Btn label="שליחת הזמנה" onPress={share} />
      </Card>
      <Card>
        <T muted size={14}>מי שיש לו את קוד המשפחה יכול לראות ולערוך את הלוח. שתפו אותו רק עם בני המשפחה.</T>
        {!confirm ? (
          <Btn label="התנתקות מהלוח במכשיר הזה" ghost onPress={() => setConfirm(true)} />
        ) : (
          <>
            <T bold>בטוחים? המשימות נשארות בלוח, ואפשר לחזור עם הקוד.</T>
            <Btn label="כן, להתנתק" onPress={onLeave} />
            <Btn label="ביטול" ghost onPress={() => setConfirm(false)} />
          </>
        )}
      </Card>
    </View>
  );
}
