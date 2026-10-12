import React, { useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, Text, Platform, StatusBar as RNStatusBar, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "./src/theme";
import { T } from "./src/ui";
import { todayLabel } from "./src/dates";
import { loadLocal, saveLocal, type Local } from "./src/storage";
import { watchTasks, watchShop, watchFamily, normalizeCode } from "./src/firebase";
import { syncReminders } from "./src/notify";
import { ShareRoot, useIncomingShare, type Incoming } from "./src/share";
import Setup from "./src/screens/Setup";
import Tasks from "./src/screens/Tasks";
import Shop from "./src/screens/Shop";
import AddFromMessage from "./src/screens/AddFromMessage";
import Settings from "./src/screens/Settings";
import type { Task, ShopItem } from "./src/types";

type Tab = "tasks" | "shop" | "add" | "settings";

function linkCode(): string {
  if (Platform.OS !== "web") return "";
  try {
    return normalizeCode(new URLSearchParams((globalThis as any).location.search).get("family") || "");
  } catch {
    return "";
  }
}

function Main() {
  const th = useTheme();
  const [local, setLocal] = useState<Local | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [shop, setShop] = useState<ShopItem[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState("");
  const [err, setErr] = useState("");
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const toastTimer = useRef<any>(null);
  const share = useIncomingShare();
  const fromLink = linkCode();

  useEffect(() => {
    loadLocal().then((l) => setLocal(l && (!fromLink || l.family === fromLink) ? l : null));
  }, []);

  useEffect(() => {
    if (!local) return;
    setErr("");
    const onErr = () => setErr("אין חיבור לנתונים כרגע. בדקו את האינטרנט.");
    const u1 = watchTasks(local.family, (t) => {
      setTasks(t);
      syncReminders(t);
    }, onErr);
    const u2 = watchShop(local.family, setShop, onErr);
    const u3 = watchFamily(local.family, setMembers, onErr);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [local?.family]);

  // Something was shared into the app from WhatsApp / Gallery / Mail.
  useEffect(() => {
    if (share.incoming) {
      setIncoming(share.incoming);
      setTab("add");
    }
  }, [share.incoming]);

  const toast = (m: string) => {
    setToastMsg(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2200);
  };

  const openCount = tasks.filter((t) => !t.done).length;
  const shopCount = shop.filter((x) => !x.done).length;
  const tabs: [Tab, string][] = [
    ["tasks", "משימות" + (openCount ? " " + openCount : "")],
    ["shop", "קניות" + (shopCount ? " " + shopCount : "")],
    ["add", "+ הודעה"],
    ["settings", "הגדרות"],
  ];
  const topPad = Platform.OS === "android" ? (RNStatusBar.currentHeight || 24) + 8 : 12;

  return (
    <View style={{ flex: 1, backgroundColor: th.bg, direction: "rtl" }}>
      <StatusBar style="auto" />
      <View style={{ paddingTop: topPad, paddingHorizontal: 16, paddingBottom: 10, gap: 10, maxWidth: 680, width: "100%", alignSelf: "center" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <T bold size={28}>לוח המשפחה</T>
          <T muted size={14}>{todayLabel()}</T>
        </View>
        {local ? (
          <View style={{ flexDirection: "row", backgroundColor: th.surface, borderColor: th.line, borderWidth: 1, borderRadius: 999, padding: 4, gap: 4 }}>
            {tabs.map(([k, label]) => (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === k }}
                style={{ flex: 1, paddingVertical: 9, borderRadius: 999, backgroundColor: tab === k ? th.accent : "transparent", alignItems: "center" }}
              >
                <Text style={{ color: tab === k ? th.accentInk : th.muted, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {err ? (
          <View style={{ backgroundColor: th.soft, borderRadius: 12, padding: 10 }}>
            <T size={14}>{err}</T>
          </View>
        ) : null}
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, maxWidth: 680, width: "100%", alignSelf: "center" }}
      >
        {local === undefined ? (
          <ActivityIndicator color={th.accent} style={{ marginTop: 40 }} />
        ) : !local ? (
          <Setup
            initialCode={fromLink}
            onDone={(l) => {
              saveLocal(l);
              setLocal(l);
            }}
          />
        ) : tab === "tasks" ? (
          <Tasks family={local.family} me={local.name} members={members} tasks={tasks} toast={toast} />
        ) : tab === "shop" ? (
          <Shop family={local.family} me={local.name} items={shop} toast={toast} />
        ) : tab === "add" ? (
          <AddFromMessage
            family={local.family}
            me={local.name}
            incoming={incoming}
            onIncomingUsed={() => {
              setIncoming(null);
              share.clear();
            }}
            onAdded={() => setTab("tasks")}
            toast={toast}
          />
        ) : (
          <Settings
            family={local.family}
            me={local.name}
            members={members}
            onLeave={() => {
              saveLocal(null);
              setLocal(null);
              setTasks([]);
              setShop([]);
              setTab("tasks");
            }}
          />
        )}
      </ScrollView>

      {toastMsg ? (
        <View pointerEvents="none" style={{ position: "absolute", bottom: 28, left: 0, right: 0, alignItems: "center" }}>
          <View style={{ backgroundColor: th.ink, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999 }}>
            <Text style={{ color: th.surface, fontWeight: "600" }}>{toastMsg}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <ShareRoot>
      <Main />
    </ShareRoot>
  );
}
