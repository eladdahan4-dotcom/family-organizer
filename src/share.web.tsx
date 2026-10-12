import React from "react";

export type Incoming = { text: string; image: { uri: string; mimeType: string } | null };

// Browsers can't receive shares from other apps here; the web version adds images with the picker.
export function ShareRoot({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useIncomingShare(): { incoming: Incoming | null; clear: () => void } {
  return { incoming: null, clear: () => {} };
}
