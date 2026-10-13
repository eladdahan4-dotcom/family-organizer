import * as FileSystem from "expo-file-system";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] || "");
    r.onerror = () => rej(new Error("read"));
    r.readAsDataURL(blob);
  });
}

/** Reads an image file (shared from another app) as base64. */
export async function readImageBase64(uri: string): Promise<string> {
  const fs: any = FileSystem;
  if (typeof fs.readAsStringAsync === "function") {
    try {
      return await fs.readAsStringAsync(uri, { encoding: "base64" });
    } catch {}
  }
  const r = await fetch(uri);
  return blobToBase64(await r.blob());
}
