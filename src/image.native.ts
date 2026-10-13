import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";

/** Longest side sent to the AI. Screenshot text stays readable; uploads stay small and fast. */
export const MAX_SIDE = 1600;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] || "");
    r.onerror = () => rej(new Error("read"));
    r.readAsDataURL(blob);
  });
}

/** Reads an image file as-is (fallback when it can't be resized). */
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

/** Shrinks and compresses a photo/screenshot before it is sent to the AI. */
export async function prepareImage(uri: string, width?: number, height?: number): Promise<{ base64: string; mimeType: string }> {
  try {
    let w = width || 0;
    let h = height || 0;
    if (!w || !h) {
      // Size unknown (e.g. shared from another app): read it first.
      const info = await ImageManipulator.manipulateAsync(uri, [], {});
      w = info.width;
      h = info.height;
    }
    const actions: ImageManipulator.Action[] =
      Math.max(w, h) > MAX_SIDE ? [{ resize: w >= h ? { width: MAX_SIDE } : { height: MAX_SIDE } }] : [];
    const r = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (r.base64) return { base64: r.base64, mimeType: "image/jpeg" };
  } catch {}
  return { base64: await readImageBase64(uri), mimeType: "image/jpeg" };
}
