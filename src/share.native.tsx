import React from "react";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";

export type Incoming = { text: string; image: { uri: string; mimeType: string } | null };

/** Wraps the app so content shared from WhatsApp / Gallery / Mail reaches it. */
export function ShareRoot({ children }: { children: React.ReactNode }) {
  return <ShareIntentProvider>{children}</ShareIntentProvider>;
}

export function useIncomingShare(): { incoming: Incoming | null; clear: () => void } {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  if (!hasShareIntent || !shareIntent) return { incoming: null, clear: resetShareIntent };
  const files: any[] = (shareIntent as any).files || [];
  const img = files.find((f) => (f.mimeType || "").startsWith("image/"));
  let uri = img ? String(img.path || img.uri || "") : "";
  if (uri && !uri.includes("://")) uri = "file://" + uri;
  return {
    incoming: {
      text: [(shareIntent as any).text, (shareIntent as any).webUrl].filter(Boolean).join("\n"),
      image: img && uri ? { uri, mimeType: img.mimeType || "image/jpeg" } : null,
    },
    clear: resetShareIntent,
  };
}
