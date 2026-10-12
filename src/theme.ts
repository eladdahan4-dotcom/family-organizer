import { useColorScheme } from "react-native";
import type { Cat } from "./types";

const light = {
  bg: "#EDF1EF",
  surface: "#FFFFFF",
  ink: "#15302B",
  muted: "#5E716C",
  line: "#D5DEDA",
  accent: "#0F6E63",
  accentInk: "#FFFFFF",
  soft: "#DCEBE7",
  danger: "#B4372B",
  cat: { gan: "#2E8B57", school: "#2F62C9", shop: "#D9771E", home: "#7B4FB8", other: "#7A8580" } as Record<Cat, string>,
};

const dark: typeof light = {
  bg: "#0F1A18",
  surface: "#172623",
  ink: "#E4EEEB",
  muted: "#93A8A2",
  line: "#2A3D39",
  accent: "#3FB8A6",
  accentInk: "#06201C",
  soft: "#1F3833",
  danger: "#F07A6B",
  cat: { gan: "#5CC48A", school: "#7AA2F2", shop: "#F0A256", home: "#B392E8", other: "#9AA6A1" },
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
