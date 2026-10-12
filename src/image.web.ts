/** Reads a picked image (blob: or data: URI in the browser) as base64, downscaled to keep requests small. */
export async function readImageBase64(uri: string): Promise<string> {
  if (uri.startsWith("data:")) {
    const b64 = uri.split(",")[1] || "";
    if (b64.length < 3_000_000) return b64;
  }
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("decode"));
    im.src = uri;
  });
  const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}
