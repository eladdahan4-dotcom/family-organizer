import React, { useMemo } from "react";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";

export type Incoming = { text: string; image: { uri: string; mimeType: string } | null };

/** Wraps the app so content shared from WhatsApp / Gallery / Mail reaches it. */
export function ShareRoot({ children }: { children: React.ReactNode }) {
  return <ShareIntentProvider>{children}</ShareIntentProvider>;
}

export function toIncoming(shareIntent: any): Incoming | null {
  if (!shareIntent) return null;
  const files: any[] = shareIntent.files || [];
  const img = files.find((f) => (f?.mimeType || "").startsWith("image/"));
  let uri = img ? String(img.path || img.uri || "") : "";
  if (uri && !uri.includes("://")) uri = "file://" + uri;
  const text = [shareIntent.text, shareIntent.webUrl].filter(Boolean).join("\n");
  if (!text && !uri) return null;
  return { text, image: img && uri ? { uri, mimeType: img.mimeType || "image/jpeg" } : null };
}

export function useIncomingShare(): { incoming: Incoming | null; clear: () => void } {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  // Same object for the same share, so the app handles each share exactly once.
  const incoming = useMemo(() => (hasShareIntent ? toIncoming(shareIntent) : null), [hasShareIntent, shareIntent]);
  return { incoming, clear: resetShareIntent };
}
