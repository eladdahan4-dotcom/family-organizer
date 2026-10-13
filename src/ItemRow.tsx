import React from "react";
import { View, Pressable } from "react-native";
import { T, Check, Tag, s } from "./ui";
import { useTheme } from "./theme";
import { fmtDate } from "./dates";
import { timeLabel } from "./items";
import { CAT_LABEL, kindOf, type Task } from "./types";

/** One task or meeting in a list. Tapping the text opens it for editing. */
export default function ItemRow({
  t,
  me,
  first,
  showDate = true,
  onToggle,
  onOpen,
}: {
  t: Task;
  me: string;
  first?: boolean;
  showDate?: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const th = useTheme();
  const isEvent = kindOf(t) === "event";
  const who = t.who === "both" ? "שנינו" : t.who === me ? t.who + " (אני)" : t.who;
  const when = [showDate && t.date ? fmtDate(t.date) : "", timeLabel(t)].filter(Boolean).join(" · ");
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: th.line,
      }}
    >
      {isEvent ? (
        <View
          accessibilityLabel="פגישה"
          style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: th.soft, alignItems: "center", justifyContent: "center" }}
        >
          <T size={14}>📅</T>
        </View>
      ) : (
        <Check on={t.done} onPress={onToggle} />
      )}
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityHint="עריכה" style={{ flex: 1, gap: 3 }}>
        <T bold style={t.done ? { textDecorationLine: "line-through", color: th.muted } : undefined}>{t.title}</T>
        <View style={[s.row, { gap: 8 }]}>
          <Tag label={CAT_LABEL[t.cat] || "אחר"} color={th.cat[t.cat] || th.cat.other} />
          {when ? <T muted size={13}>{when}</T> : null}
          {isEvent && t.location ? <T muted size={13}>{"📍 " + t.location}</T> : null}
          {t.who ? <T muted size={13}>{"👤 " + who}</T> : null}
        </View>
      </Pressable>
      <T muted size={18} style={{ paddingHorizontal: 4 }} onPress={onOpen} accessibilityLabel="עריכה">
        ✎
      </T>
    </View>
  );
}

export function ListBox({ children }: { children: React.ReactNode }) {
  const th = useTheme();
  return (
    <View style={{ backgroundColor: th.surface, borderColor: th.line, borderWidth: 1, borderRadius: 12, overflow: "hidden" }}>
      {children}
    </View>
  );
}
