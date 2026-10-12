import React from "react";
import { Pressable, Text, TextInput, View, StyleSheet, TextInputProps, ViewStyle } from "react-native";
import { useTheme } from "./theme";

// The whole app is laid out right-to-left via `direction: "rtl"` on the root view,
// so "row" flows from the right. Text is aligned right explicitly.

export function T(props: React.ComponentProps<typeof Text> & { muted?: boolean; bold?: boolean; size?: number }) {
  const th = useTheme();
  const { muted, bold, size, style, ...rest } = props;
  return (
    <Text
      {...rest}
      style={[
        { color: muted ? th.muted : th.ink, fontSize: size || 16, textAlign: "right", writingDirection: "rtl" },
        bold && { fontWeight: "700" },
        style,
      ]}
    />
  );
}

export function Btn({
  label,
  onPress,
  ghost,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  ghost?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const th = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          backgroundColor: ghost ? th.soft : th.accent,
          paddingVertical: 11,
          paddingHorizontal: 16,
          borderRadius: 10,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          alignItems: "center",
        },
        style,
      ]}
    >
      <Text style={{ color: ghost ? th.ink : th.accentInk, fontWeight: "700", fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const th = useTheme();
  return (
    <TextInput
      placeholderTextColor={th.muted}
      {...props}
      style={[
        {
          color: th.ink,
          backgroundColor: th.bg,
          borderColor: th.line,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 16,
          textAlign: "right",
          writingDirection: "rtl",
        },
        props.style,
      ]}
    />
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const th = useTheme();
  return (
    <View
      style={[
        { backgroundColor: th.surface, borderColor: th.line, borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Chip({ label, on, onPress, color }: { label: string; on: boolean; onPress: () => void; color?: string }) {
  const th = useTheme();
  const bg = on ? color || th.ink : "transparent";
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: on ? bg : th.line,
        backgroundColor: bg,
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: on ? th.surface : th.ink, fontWeight: "600", fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Check({ on, onPress }: { on: boolean; onPress: () => void }) {
  const th = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: on ? th.accent : th.muted,
        backgroundColor: on ? th.accent : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {on ? <Text style={{ color: th.accentInk, fontWeight: "700", fontSize: 15 }}>✓</Text> : null}
    </Pressable>
  );
}

export function Tag({ label, color }: { label: string; color: string }) {
  const th = useTheme();
  return (
    <View style={{ backgroundColor: color, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
      <Text style={{ color: th.surface, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
});
