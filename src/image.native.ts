import * as FileSystem from "expo-file-system";

/** Reads an image file (picker or shared from another app) as base64. */
export async function readImageBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}
